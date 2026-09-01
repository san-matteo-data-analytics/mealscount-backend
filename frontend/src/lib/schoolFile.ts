/**
 * Reading school rosters out of CSV / XLSX, and writing the sample back out.
 *
 * Real district files never use exactly the column names the API wants, so header
 * matching is alias-based and case/punctuation-insensitive. Rows the API would
 * silently drop are reported instead — that silent drop is the single most common
 * source of "why is my school missing" confusion.
 */
import type * as XLSXTypes from "xlsx";
import type { SchoolInput } from "./types";
import { SAMPLE_SCHOOLS } from "./sample";

/** Canonical field -> accepted header spellings. Compared after normalisation. */
const ALIASES: Record<string, string[]> = {
  school_code: ["school code", "schoolcode", "school_code", "code", "cds code", "school id"],
  school_name: ["school name", "schoolname", "school_name", "school", "site name"],
  school_type: ["school type", "schooltype", "school_type", "type", "grade span"],
  total_enrolled: ["total enrolled", "total_enrolled", "totalenrolled", "enrolled", "enrollment", "total enrollment"],
  total_eligible: ["total eligible", "total_eligible", "totaleligible", "eligible", "identified students", "identified", "isp count"],
  daily_breakfast_served: ["daily breakfast served", "daily_breakfast_served", "breakfast served", "breakfasts", "breakfasts/day", "avg daily breakfast", "breakfast"],
  daily_lunch_served: ["daily lunch served", "daily_lunch_served", "lunch served", "lunches", "lunches/day", "avg daily lunch", "lunch"],
  severe_need: ["severe need", "severe_need", "severeneed"],
  active: ["active", "include", "include_in_mealscount", "included"],
  // Fallback for total_eligible, mirroring CEPSchool in strategies/base.py.
  direct_cert: ["direct cert", "direct_cert", "directcert", "directly certified"],
};

/** SheetJS is large and only needed once a file is actually read or written. */
const loadXLSX = () => import("xlsx");

const normalise = (h: string) =>
  String(h).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Build a map of canonical field -> the actual header used in this file. */
function mapHeaders(headers: string[]): Record<string, string> {
  const found: Record<string, string> = {};
  for (const header of headers) {
    const n = normalise(header);
    for (const [field, aliases] of Object.entries(ALIASES)) {
      if (found[field]) continue;
      if (aliases.some((a) => normalise(a) === n)) {
        found[field] = header;
        break;
      }
    }
  }
  return found;
}

/** "1,234" / " 1234 " / 1234 -> 1234. Anything unparseable -> 0. */
function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value) : 0;
  if (value == null) return 0;
  const cleaned = String(value).replace(/[,$\s]/g, "");
  if (cleaned === "") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function toBool(value: unknown, fallback: boolean): boolean {
  if (value == null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const s = String(value).trim().toLowerCase();
  if (["true", "yes", "y", "1", "x"].includes(s)) return true;
  if (["false", "no", "n", "0"].includes(s)) return false;
  return fallback;
}

export interface SkippedRow {
  /** 1-based row number as it appears in the user's spreadsheet, header included. */
  row: number;
  label: string;
  reason: string;
}

export interface ImportResult {
  schools: SchoolInput[];
  skipped: SkippedRow[];
  /** Canonical fields we could not find a column for. */
  missingColumns: string[];
  /** Canonical fields we did find, for the "we understood this as…" summary. */
  matchedColumns: Record<string, string>;
  sheetName?: string;
}

const REQUIRED = ["school_code", "school_name", "total_enrolled", "total_eligible"];

/**
 * Parse an uploaded CSV or XLSX file into school rows.
 * Throws only when the file itself is unreadable or has no recognisable columns.
 */
export async function parseSchoolFile(file: File): Promise<ImportResult> {
  const XLSX = await loadXLSX();
  const buffer = await file.arrayBuffer();

  let workbook: XLSXTypes.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "array" });
  } catch {
    throw new Error(
      `Could not read "${file.name}". Expected a .csv, .xlsx or .xls file.`,
    );
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error(`"${file.name}" contains no sheets.`);

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (rows.length === 0) throw new Error(`"${file.name}" has no data rows.`);

  const headers = Object.keys(rows[0]);
  const matched = mapHeaders(headers);

  const missingRequired = REQUIRED.filter((f) => !matched[f]);
  // total_eligible can be stood in for by direct_cert, as CEPSchool does.
  if (missingRequired.includes("total_eligible") && matched.direct_cert) {
    missingRequired.splice(missingRequired.indexOf("total_eligible"), 1);
  }
  if (missingRequired.length === REQUIRED.length) {
    throw new Error(
      `No recognisable columns in "${file.name}". Found: ${headers.slice(0, 8).join(", ")}. ` +
        `Download the template to see the expected headers.`,
    );
  }

  const get = (row: Record<string, unknown>, field: string) =>
    matched[field] ? row[matched[field]] : undefined;

  const schools: SchoolInput[] = [];
  const skipped: SkippedRow[] = [];

  rows.forEach((row, i) => {
    const rowNumber = i + 2; // +1 for zero-index, +1 for the header row
    const code = String(get(row, "school_code") ?? "").trim();
    const name = String(get(row, "school_name") ?? "").trim();
    const enrolled = toNumber(get(row, "total_enrolled"));

    const label = name || code || `Row ${rowNumber}`;

    // Mirror the server's two silent drops, but say so out loud.
    if (!code) {
      skipped.push({ row: rowNumber, label, reason: "No school code — the optimizer would drop this row" });
      return;
    }
    if (enrolled <= 0) {
      skipped.push({ row: rowNumber, label, reason: "Enrollment is 0 or blank — the optimizer would drop this row" });
      return;
    }

    const eligibleRaw = matched.total_eligible
      ? toNumber(get(row, "total_eligible"))
      : toNumber(get(row, "direct_cert"));

    schools.push({
      school_code: code,
      school_name: name || code,
      school_type: String(get(row, "school_type") ?? "").trim(),
      total_enrolled: enrolled,
      // The API clamps this anyway; clamping here keeps the on-screen ISP honest.
      total_eligible: Math.min(eligibleRaw, enrolled),
      daily_breakfast_served: toNumber(get(row, "daily_breakfast_served")),
      daily_lunch_served: toNumber(get(row, "daily_lunch_served")),
      severe_need: toBool(get(row, "severe_need"), false),
      active: toBool(get(row, "active"), true),
    });
  });

  const optional = ["daily_breakfast_served", "daily_lunch_served", "school_type", "severe_need"];
  const missingColumns = [...REQUIRED, ...optional].filter((f) => !matched[f]);

  return { schools, skipped, missingColumns, matchedColumns: matched, sheetName };
}

/** Column order for anything we write out. Matches what parseSchoolFile expects back. */
const TEMPLATE_HEADERS = [
  "school_code",
  "school_name",
  "school_type",
  "total_enrolled",
  "total_eligible",
  "daily_breakfast_served",
  "daily_lunch_served",
  "severe_need",
] as const;

function toSheetRows(schools: SchoolInput[]) {
  return schools.map((s) => ({
    school_code: s.school_code,
    school_name: s.school_name,
    school_type: s.school_type ?? "",
    total_enrolled: Number(s.total_enrolled) || 0,
    total_eligible: Number(s.total_eligible) || 0,
    daily_breakfast_served: Number(s.daily_breakfast_served) || 0,
    daily_lunch_served: Number(s.daily_lunch_served) || 0,
    severe_need: s.severe_need ? "TRUE" : "FALSE",
  }));
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the download has actually started.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export type SchoolFileFormat = "csv" | "xlsx";

/** Write a set of schools out as CSV or XLSX, for use as a starting template. */
export async function downloadSchools(
  schools: SchoolInput[],
  format: SchoolFileFormat,
  basename = "mealscount-schools",
) {
  const XLSX = await loadXLSX();
  const sheet = XLSX.utils.json_to_sheet(toSheetRows(schools), {
    header: [...TEMPLATE_HEADERS],
  });

  if (format === "csv") {
    const csv = XLSX.utils.sheet_to_csv(sheet);
    triggerDownload(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${basename}.csv`);
    return;
  }

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Schools");
  const out = XLSX.write(book, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  triggerDownload(
    new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${basename}.xlsx`,
  );
}

/** The worked example, offered as a download rather than pre-filled into the table. */
export function downloadSampleDistrict(format: SchoolFileFormat) {
  return downloadSchools(SAMPLE_SCHOOLS, format, "mealscount-sample-district");
}
