import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PageHeader from "@/components/PageHeader";
import FieldTable from "@/components/FieldTable";
import CodeBlock from "@/components/CodeBlock";
import { DISTRICT_INPUT_FIELDS, SCHOOL_INPUT_FIELDS } from "@/lib/content";

const REQUEST_EXAMPLE = `POST /api/districts/optimize/
Content-Type: application/json

{
  "name": "Sample Unified School District",
  "code": "SAMPLE-01",
  "state_code": "ca",
  "isp_threshold": 0.25,
  "sfa_certified": true,
  "hhfka_sixty": "more",
  "max_groups": 10,
  "evaluate_by": "reimbursement",
  "schools": [
    {
      "school_code": "1001",
      "school_name": "Lincoln Elementary",
      "school_type": "Elementary",
      "total_enrolled": 520,
      "total_eligible": 447,
      "daily_breakfast_served": 291,
      "daily_lunch_served": 411,
      "severe_need": true,
      "active": true
    }
  ]
}`;

const CSV_EXAMPLE = `District Code,District Name,School Code,School Name,total_enrolled,total_eligible,direct_cert,foster,homeless,migrant,unduplicated_frpm
02189,Banning Unified,33669853330214,BANNING HIGH,1021,194,180,4,8,2,610
02189,Banning Unified,33669856031603,CABAZON ELEMENTARY,341,93,88,1,3,1,244`;

const ENTRY_POINTS = [
  {
    title: "A spreadsheet, through the optimizer",
    endpoint: "Upload a .csv / .xlsx on the optimizer page",
    body: "The easiest route. Column names are matched loosely against the aliases below, rows the API would silently drop are reported instead, and you can download a filled-in template to start from.",
  },
  {
    title: "One district, interactively",
    endpoint: "POST /api/districts/optimize/",
    body: "Runs the strategies synchronously and returns the full result. This is what the web UI and the optimizer on this site use.",
  },
  {
    title: "One district, in the background",
    endpoint: "POST /api/districts/optimize-async/",
    body: "Same payload, but hands the job to AWS Lambda and returns a URL on S3 where the result will appear. Used for districts large enough to time out a web request. Falls back to the synchronous path when AWS credentials are absent.",
  },
  {
    title: "A whole state, from CSV",
    endpoint: "python cep_estimatory.py data/ca/latest.csv <strategies...>",
    body: "The command-line path. Reads one CSV row per school, groups rows into districts by District Code, and writes JSON plus a summary table.",
  },
];

export default function InputsPage() {
  return (
    <Box>
      <PageHeader
        eyebrow="Inputs"
        title="Everything you have to supply"
        lede="Two kinds of input: a row per school with enrollment, identified students, and meals served; and a handful of district-level settings that select the USDA rate table and define what 'best' means."
      />

      <Typography variant="h2" gutterBottom>
        Four ways in
      </Typography>
      <Stack spacing={2} sx={{ mb: 5 }}>
        {ENTRY_POINTS.map((e) => (
          <Paper key={e.endpoint} variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="h4" gutterBottom>
              {e.title}
            </Typography>
            <Chip label={e.endpoint} size="small" sx={{ fontFamily: "monospace", mb: 1.5, maxWidth: "100%" }} />
            <Typography variant="body2" color="text.secondary">
              {e.body}
            </Typography>
          </Paper>
        ))}
      </Stack>

      <Typography variant="h2" gutterBottom>
        Per-school fields
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2, maxWidth: 820 }}>
        Enrollment and identified students determine <em>eligibility</em>; meals served determine{" "}
        <em>dollars</em>. Supply only the first pair and the optimizer will still group your schools
        correctly, but every reimbursement figure comes back as zero.
      </Typography>
      <Box sx={{ mb: 5 }}>
        <FieldTable fields={SCHOOL_INPUT_FIELDS} />
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        <AlertTitle>Column names are matched loosely on upload</AlertTitle>
        Headers are compared case- and punctuation-insensitively, so{" "}
        <code>School Code</code>, <code>school_code</code> and <code>School ID</code> all resolve to the
        same field; <code>Total Enrollment</code> and <code>total_enrolled</code> likewise. If{" "}
        <code>total_eligible</code> is absent but <code>direct_cert</code> is present, the latter is used
        — the same fallback <code>CEPSchool</code> applies on the Python side.
      </Alert>

      <Alert severity="warning" sx={{ mb: 5 }}>
        <AlertTitle>Rows can disappear silently</AlertTitle>
        The server skips any school missing <code>school_code</code> or <code>total_enrolled</code> without
        raising an error. If a school is absent from your results, check the <code>schools</code> array in
        the response before suspecting the algorithms. The upload on the optimizer page lists these rows
        explicitly rather than dropping them quietly.
      </Alert>

      <Typography variant="h2" gutterBottom>
        District-level settings
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2, maxWidth: 820 }}>
        These are the knobs that change the answer without changing the data.
      </Typography>
      <Box sx={{ mb: 5 }}>
        <FieldTable fields={DISTRICT_INPUT_FIELDS} />
      </Box>

      <Typography variant="h2" gutterBottom>
        What a request looks like
      </Typography>
      <Stack spacing={3} sx={{ mb: 5 }}>
        <CodeBlock caption="JSON API — one district" code={REQUEST_EXAMPLE} />
        <CodeBlock caption="CSV — statewide batch, one row per school" code={CSV_EXAMPLE} />
      </Stack>

      <Alert severity="info">
        <AlertTitle>Where does &quot;identified students&quot; come from?</AlertTitle>
        Directly certified students (SNAP, TANF, Medicaid where applicable) plus foster, homeless, migrant,
        and Head Start children. In California this arrives via the CALPADS unduplicated pupil count file;
        state data feeds live in <code>data/&lt;state&gt;/latest.csv</code>.
      </Alert>
    </Box>
  );
}
