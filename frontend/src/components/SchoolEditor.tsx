"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import DownloadIcon from "@mui/icons-material/Download";
import ClearAllIcon from "@mui/icons-material/ClearAll";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { FULL_FUNDING_ISP, pct } from "@/lib/cep";
import { EMPTY_SCHOOL } from "@/lib/sample";
import { downloadSchools } from "@/lib/schoolFile";
import type { SchoolInput } from "@/lib/types";

const n = (v: number | string) => (typeof v === "number" ? v : Number(v) || 0);

/** Native number spinners eat horizontal space and clip 4-digit values. */
const numberFieldSx = {
  width: "100%",
  "& input[type=number]": { MozAppearance: "textfield" },
  "& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button": {
    WebkitAppearance: "none",
    margin: 0,
  },
} as const;

/** Colour a school's own ISP by which funding zone it lands in on its own. */
function ispChip(isp: number, threshold: number) {
  if (isp >= FULL_FUNDING_ISP) return { color: "success" as const, title: "Fully funded alone — has surplus ISP to share" };
  if (isp >= threshold) return { color: "warning" as const, title: "Partially funded alone" };
  return { color: "default" as const, title: "Earns nothing alone — needs a group" };
}

const HEADERS: { label: string; hint: string; width?: number }[] = [
  { label: "", hint: "Include this school in grouping", width: 52 },
  { label: "School", hint: "Name and code — the code identifies it in the results" },
  { label: "Enrolled", hint: "Denominator of ISP", width: 128 },
  { label: "Identified", hint: "Numerator of ISP: directly certified, foster, homeless, migrant", width: 124 },
  { label: "ISP", hint: "identified ÷ enrolled, computed live", width: 92 },
  { label: "Breakfasts/day", hint: "Average daily breakfasts served", width: 130 },
  { label: "Lunches/day", hint: "Average daily lunches served", width: 130 },
  { label: "Severe need", hint: "Qualifies for the higher free breakfast rate", width: 100 },
  { label: "", hint: "Remove", width: 52 },
];

export default function SchoolEditor({
  schools,
  onChange,
  ispThreshold,
  districtName,
}: {
  schools: SchoolInput[];
  onChange: (schools: SchoolInput[]) => void;
  ispThreshold: number;
  districtName?: string;
}) {
  const [exportAnchor, setExportAnchor] = React.useState<null | HTMLElement>(null);
  const update = (idx: number, patch: Partial<SchoolInput>) =>
    onChange(schools.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

  const totals = schools.reduce(
    (acc, s) => {
      if (s.active === false) return acc;
      acc.enrolled += n(s.total_enrolled);
      acc.eligible += n(s.total_eligible);
      return acc;
    },
    { enrolled: 0, eligible: 0 },
  );
  const districtIsp = totals.enrolled > 0 ? totals.eligible / totals.enrolled : 0;
  const basename =
    (districtName ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ||
    "mealscount-schools";

  return (
    <Paper variant="outlined">
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        alignItems={{ sm: "center" }}
        justifyContent="space-between"
        sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}
      >
        <Box>
          <Typography variant="h4">Schools</Typography>
          <Typography variant="caption" color="text.secondary">
            {schools.filter((s) => s.active !== false).length} active ·{" "}
            {totals.enrolled.toLocaleString()} students · district-wide ISP {pct(districtIsp)}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button size="small" startIcon={<DownloadIcon />} onClick={(e) => setExportAnchor(e.currentTarget)}>
            Export
          </Button>
          <Button size="small" color="inherit" startIcon={<ClearAllIcon />} onClick={() => onChange([])}>
            Clear
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() =>
              onChange([
                ...schools,
                { ...EMPTY_SCHOOL, school_code: String(1000 + schools.length + 1), school_name: "New school" },
              ])
            }
          >
            Add school
          </Button>
          <Menu anchorEl={exportAnchor} open={Boolean(exportAnchor)} onClose={() => setExportAnchor(null)}>
            <MenuItem
              onClick={() => {
                downloadSchools(schools, "xlsx", basename);
                setExportAnchor(null);
              }}
            >
              Download as Excel (.xlsx)
            </MenuItem>
            <MenuItem
              onClick={() => {
                downloadSchools(schools, "csv", basename);
                setExportAnchor(null);
              }}
            >
              Download as CSV (.csv)
            </MenuItem>
          </Menu>
        </Stack>
      </Stack>

      {/* Horizontal overflow only — a vertical cap here would swallow page scroll. */}
      <TableContainer sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {HEADERS.map((h, i) => (
                <TableCell key={i} sx={{ width: h.width }}>
                  <Tooltip title={h.hint} arrow>
                    <span>{h.label}</span>
                  </Tooltip>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {schools.map((s, idx) => {
              const enrolled = n(s.total_enrolled);
              const isp = enrolled > 0 ? n(s.total_eligible) / enrolled : 0;
              const chip = ispChip(isp, ispThreshold);
              const inactive = s.active === false;
              return (
                <TableRow key={idx} hover sx={{ opacity: inactive ? 0.45 : 1 }}>
                  <TableCell>
                    <Checkbox
                      size="small"
                      checked={s.active !== false}
                      onChange={(e) => update(idx, { active: e.target.checked })}
                      inputProps={{ "aria-label": `Include ${s.school_name}` }}
                    />
                  </TableCell>
                  <TableCell>
                    <Stack spacing={0.5}>
                      <TextField
                        size="small"
                        variant="standard"
                        value={s.school_name}
                        onChange={(e) => update(idx, { school_name: e.target.value })}
                        placeholder="School name"
                        sx={{ minWidth: 170 }}
                      />
                      <TextField
                        size="small"
                        variant="standard"
                        value={s.school_code}
                        onChange={(e) => update(idx, { school_code: e.target.value })}
                        placeholder="code"
                        slotProps={{ input: { sx: { fontSize: "0.75rem", color: "text.secondary" } } }}
                      />
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      type="number"
                      value={s.total_enrolled}
                      onChange={(e) => update(idx, { total_enrolled: e.target.value })}
                      sx={numberFieldSx}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      type="number"
                      value={s.total_eligible}
                      onChange={(e) => update(idx, { total_eligible: e.target.value })}
                      sx={numberFieldSx}
                      error={n(s.total_eligible) > enrolled}
                      helperText={n(s.total_eligible) > enrolled ? "clamped to enrolled" : undefined}
                    />
                  </TableCell>
                  <TableCell>
                    <Tooltip title={chip.title} arrow>
                      <Chip size="small" label={pct(isp, 0)} color={chip.color} variant="filled" />
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      type="number"
                      value={s.daily_breakfast_served}
                      onChange={(e) => update(idx, { daily_breakfast_served: e.target.value })}
                      sx={numberFieldSx}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      type="number"
                      value={s.daily_lunch_served}
                      onChange={(e) => update(idx, { daily_lunch_served: e.target.value })}
                      sx={numberFieldSx}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Checkbox
                      size="small"
                      checked={Boolean(s.severe_need)}
                      onChange={(e) => update(idx, { severe_need: e.target.checked })}
                      inputProps={{ "aria-label": `Severe need for ${s.school_name}` }}
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      aria-label={`Remove ${s.school_name}`}
                      onClick={() => onChange(schools.filter((_, i) => i !== idx))}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
