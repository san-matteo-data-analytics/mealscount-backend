"use client";

import * as React from "react";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DownloadIcon from "@mui/icons-material/Download";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { parseSchoolFile, downloadSampleDistrict, type ImportResult } from "@/lib/schoolFile";
import type { SchoolInput } from "@/lib/types";

const ACCEPT = ".csv,.xlsx,.xls";

const FIELD_LABELS: Record<string, string> = {
  school_code: "school_code",
  school_name: "school_name",
  school_type: "school_type",
  total_enrolled: "total_enrolled",
  total_eligible: "total_eligible",
  daily_breakfast_served: "daily_breakfast_served",
  daily_lunch_served: "daily_lunch_served",
  severe_need: "severe_need",
};

export default function SchoolImport({
  onImport,
  onAddBlank,
  hasSchools,
}: {
  onImport: (schools: SchoolInput[]) => void;
  onAddBlank: () => void;
  hasSchools: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<(ImportResult & { fileName: string }) | null>(null);
  const [menuAnchor, setMenuAnchor] = React.useState<null | HTMLElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const parsed = await parseSchoolFile(file);
      if (parsed.schools.length === 0) {
        setError(
          `No usable rows in "${file.name}". ${parsed.skipped.length} row(s) were skipped — every row needs a school code and a non-zero enrollment.`,
        );
        setResult(null);
        return;
      }
      setResult({ ...parsed, fileName: file.name });
      onImport(parsed.schools);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setResult(null);
    } finally {
      setBusy(false);
      // Allow re-selecting the same file after a correction.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <Box>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <Paper
        variant="outlined"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        sx={{
          p: { xs: 3, md: 4 },
          textAlign: "center",
          borderStyle: "dashed",
          borderWidth: 2,
          borderColor: dragging ? "primary.main" : "divider",
          bgcolor: dragging ? "action.hover" : "background.paper",
          transition: "border-color 120ms, background-color 120ms",
        }}
      >
        <UploadFileIcon sx={{ fontSize: 40, color: "primary.main", mb: 1 }} />
        <Typography variant="h3" gutterBottom>
          {hasSchools ? "Replace the schools" : "Start with your district's schools"}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, maxWidth: 560, mx: "auto" }}>
          Drop a <strong>CSV</strong> or <strong>Excel</strong> file here, or browse for one. Column
          names are matched loosely, so <code>School Code</code>, <code>school_code</code> and{" "}
          <code>School ID</code> all work.
        </Typography>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="center" flexWrap="wrap" useFlexGap>
          <Button
            variant="contained"
            size="large"
            startIcon={<UploadFileIcon />}
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {busy ? "Reading…" : "Choose a file"}
          </Button>
          <Button
            variant="outlined"
            size="large"
            startIcon={<DownloadIcon />}
            onClick={(e) => setMenuAnchor(e.currentTarget)}
          >
            Download a template
          </Button>
          {!hasSchools && (
            <Button size="large" startIcon={<AddIcon />} onClick={onAddBlank}>
              Enter schools by hand
            </Button>
          )}
        </Stack>

        <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
          <MenuItem
            onClick={() => {
              downloadSampleDistrict("xlsx");
              setMenuAnchor(null);
            }}
          >
            Excel workbook (.xlsx)
          </MenuItem>
          <MenuItem
            onClick={() => {
              downloadSampleDistrict("csv");
              setMenuAnchor(null);
            }}
          >
            Comma-separated values (.csv)
          </MenuItem>
        </Menu>

        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
          The template is a worked example district — fill in your own rows, or edit it to see how
          grouping changes the answer.
        </Typography>
      </Paper>

      <Collapse in={Boolean(error)}>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
            <AlertTitle>Could not import that file</AlertTitle>
            {error}
          </Alert>
        )}
      </Collapse>

      <Collapse in={Boolean(result)}>
        {result && (
          <Alert
            severity={result.skipped.length > 0 ? "warning" : "success"}
            icon={result.skipped.length > 0 ? undefined : <CheckCircleIcon />}
            sx={{ mt: 2 }}
            onClose={() => setResult(null)}
          >
            <AlertTitle>
              Imported {result.schools.length} school{result.schools.length === 1 ? "" : "s"} from{" "}
              {result.fileName}
              {result.sheetName ? ` (sheet "${result.sheetName}")` : ""}
            </AlertTitle>

            {result.skipped.length > 0 && (
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="body2" gutterBottom>
                  <strong>{result.skipped.length} row(s) skipped.</strong> The optimizer drops these
                  silently, so they are listed here instead:
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                  {result.skipped.slice(0, 8).map((s) => (
                    <Typography component="li" variant="body2" key={`${s.row}-${s.label}`}>
                      Row {s.row} — {s.label}: {s.reason}
                    </Typography>
                  ))}
                  {result.skipped.length > 8 && (
                    <Typography component="li" variant="body2" color="text.secondary">
                      …and {result.skipped.length - 8} more
                    </Typography>
                  )}
                </Box>
              </Box>
            )}

            {result.missingColumns.length > 0 && (
              <Box>
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2" gutterBottom>
                  No column found for these — they defaulted to blank:
                </Typography>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  {result.missingColumns.map((c) => (
                    <Chip key={c} size="small" variant="outlined" label={FIELD_LABELS[c] ?? c} sx={{ fontFamily: "monospace" }} />
                  ))}
                </Stack>
                {(result.missingColumns.includes("daily_lunch_served") ||
                  result.missingColumns.includes("daily_breakfast_served")) && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Without meals-served figures the grouping still computes, but every reimbursement
                    comes back as <strong>$0</strong>. Add them in the table below to get dollar
                    estimates.
                  </Typography>
                )}
              </Box>
            )}

            <Divider sx={{ my: 1 }} />
            <Typography variant="caption" color="text.secondary">
              Check the rows below before optimizing.{" "}
              <Link component="button" type="button" onClick={() => inputRef.current?.click()}>
                Import a different file
              </Link>
              .
            </Typography>
          </Alert>
        )}
      </Collapse>
    </Box>
  );
}
