import Link from "next/link";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import PageHeader from "@/components/PageHeader";
import FieldTable from "@/components/FieldTable";
import { DISTRICT_INPUT_FIELDS, SCHOOL_INPUT_FIELDS } from "@/lib/content";

const WAYS_IN = [
  {
    title: "Upload a spreadsheet",
    body: "The usual route. Drop a CSV or Excel file on the optimizer page — one row per school. Column headings are matched loosely, so you rarely have to rename anything, and any row that cannot be used is listed for you rather than quietly disappearing.",
  },
  {
    title: "Start from the template",
    body: "Download the filled-in example district, replace the rows with your own schools, and upload it back. This is the fastest way to see the right column headings.",
  },
  {
    title: "Type the schools in",
    body: "For a small district, or for a quick what-if, you can add schools by hand on the optimizer page and edit every number in place.",
  },
];

const EXAMPLE_ROWS = [
  ["1001", "Lincoln Elementary", "520", "447", "291", "411"],
  ["1002", "Roosevelt Elementary", "610", "439", "305", "470"],
  ["1003", "Chavez Middle", "480", "302", "182", "348"],
];

const EXAMPLE_HEADERS = [
  "school_code",
  "school_name",
  "total_enrolled",
  "total_eligible",
  "daily_breakfast_served",
  "daily_lunch_served",
];

export default function InputsPage() {
  return (
    <Box>
      <PageHeader
        eyebrow="What you provide"
        title="The numbers the optimizer needs from you"
        lede="Two things: a row for each school with its enrollment, its identified students, and the meals it serves on a typical day — plus a few district-wide settings that pick the right USDA meal rates and define what a 'best' grouping means for you."
      />

      <Typography variant="h2" gutterBottom>
        Three ways to get your schools in
      </Typography>
      <Stack spacing={2} sx={{ mb: 5 }}>
        {WAYS_IN.map((w) => (
          <Paper key={w.title} variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="h4" gutterBottom>
              {w.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {w.body}
            </Typography>
          </Paper>
        ))}
      </Stack>

      <Typography variant="h2" gutterBottom>
        What a school file looks like
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2, maxWidth: 820 }}>
        One row per school. These six columns are enough to get a full answer; everything else is
        optional.
      </Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 5, overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {EXAMPLE_HEADERS.map((h) => (
                <TableCell key={h} sx={{ fontFamily: "monospace", whiteSpace: "nowrap" }}>
                  {h}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {EXAMPLE_ROWS.map((row) => (
              <TableRow key={row[0]}>
                {row.map((cell, i) => (
                  <TableCell key={i} align={i > 1 ? "right" : "left"}>
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="h2" gutterBottom>
        School by school
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2, maxWidth: 820 }}>
        Enrollment and identified students decide <em>who qualifies</em>; meals served decide{" "}
        <em>how much money</em>. Give only the first pair and your schools will still be grouped
        correctly, but every dollar figure comes back as zero.
      </Typography>
      <Box sx={{ mb: 5 }}>
        <FieldTable fields={SCHOOL_INPUT_FIELDS} />
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        <AlertTitle>You do not have to rename your columns</AlertTitle>
        Headings are matched ignoring case, spaces and punctuation, so <code>School Code</code>,{" "}
        <code>school_code</code> and <code>School ID</code> all land in the same place, as do{" "}
        <code>Total Enrollment</code> and <code>total_enrolled</code>. If there is no identified
        students column but there is a directly certified one, that is used instead.
      </Alert>

      <Alert severity="warning" sx={{ mb: 5 }}>
        <AlertTitle>Rows without a code or an enrollment count are dropped</AlertTitle>
        A school with no code, or with blank or zero enrollment, cannot be grouped. The upload tells
        you exactly which rows those were and why, so you can fix them and try again. If a school is
        missing from your results, that list is the first place to look.
      </Alert>

      <Typography variant="h2" gutterBottom>
        District-wide settings
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2, maxWidth: 820 }}>
        These change the answer without changing any school data. You set them on the optimizer page,
        above the school table.
      </Typography>
      <Box sx={{ mb: 5 }}>
        <FieldTable fields={DISTRICT_INPUT_FIELDS} />
      </Box>

      <Alert severity="info" sx={{ mb: 5 }}>
        <AlertTitle>Where &quot;identified students&quot; comes from</AlertTitle>
        Students directly certified through SNAP, TANF, or Medicaid where your state allows it, plus
        foster, homeless, migrant, and Head Start students. In California this comes from your CALPADS
        unduplicated pupil count.
      </Alert>

      <Paper
        sx={{
          p: { xs: 3, md: 4 },
          bgcolor: "primary.main",
          color: "common.white",
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          alignItems: { md: "center" },
          gap: 3,
        }}
      >
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h3" gutterBottom>
            Ready when you are
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            Bring your own file, or download the example district and edit it.
          </Typography>
        </Box>
        <Button
          component={Link}
          href="/"
          variant="contained"
          color="inherit"
          size="large"
          endIcon={<ArrowForwardIcon />}
          sx={{ color: "primary.main", bgcolor: "common.white", flexShrink: 0 }}
        >
          Open the optimizer
        </Button>
      </Paper>
    </Box>
  );
}
