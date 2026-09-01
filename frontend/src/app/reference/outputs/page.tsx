import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PageHeader from "@/components/PageHeader";
import FieldTable from "@/components/FieldTable";
import CodeBlock from "@/components/CodeBlock";
import { OUTPUT_FIELDS } from "@/lib/content";

const RESPONSE_EXAMPLE = `{
  "name": "Sample Unified School District",
  "code": "SAMPLE-01",
  "total_enrolled": 4435,
  "overall_isp": 0.4980834272829763,
  "school_count": 8,

  // -- The recommendation ------------------------------
  "best_strategy": "Exhaustive?evaluate_by=reimbursement",
  "est_reimbursement": 14340.41,   // dollars per serving day
  "best_index": 2,

  // -- Every strategy that ran, winner included --------
  "strategies": [
    {
      "name": "OneToOne",              // the do-nothing baseline
      "reimbursement": 12785.02,
      "covered_students": 3960,        // two schools qualify for nothing alone
      "groups": [ /* one per school */ ]
    },
    {
      "name": "Exhaustive?evaluate_by=reimbursement",
      "reimbursement": 14340.41,
      "covered_students": 4435,        // now every student is covered
      "groups": [
        {
          "name": "162",               // strategies name groups inconsistently
          "school_codes": ["1002", "1005", "1003", "1001", "1004"],
          "isp": 0.6185,
          "free_rate": 0.9896,         // 0.6185 x 1.6, just short of the cap
          "paid_rate": 0.0104,
          "cep_eligible": true,
          "est_reimbursement": 11481.37,
          "school_reimbursements": [["1004", 1711.61], ["1001", 2554.6],
                                    ["1002", 2846.18], ["1003", 1907.75],
                                    ["1005", 2461.23]]
        },
        {
          "name": "91",
          "school_codes": ["1006", "1007", "1008"],
          "isp": 0.2997,
          "free_rate": 0.47952,        // above the 25% floor, so partly funded
          "cep_eligible": true,
          "est_reimbursement": 2859.04,
          "school_reimbursements": [["1008", 149.88], ["1006", 2053.86],
                                    ["1007", 655.3]]
        }
      ]
    }
  ],

  // -- The inputs as parsed, for checking ---------------
  "schools": [
    { "school_code": "1001", "school_name": "Lincoln Elementary",
      "total_enrolled": 520, "total_eligible": 447, "isp": 0.8596,
      "severe_need": true,
      "rates": { "free_lunch": 4.27, "paid_lunch": 0.42,
                 "free_bfast": 2.73, "paid_bfast": 0.38 } }
  ],

  "optimization_info": { "timestamp": "2026-09-01 14:22:07", "time": 0.69 }
}`;

const READING_ORDER = [
  {
    step: "1",
    title: "Read best_strategy and est_reimbursement",
    body: "That pair is the recommendation: this grouping, worth this many dollars per serving day. Multiply by roughly 180 serving days for an annual figure.",
  },
  {
    step: "2",
    title: "Open strategies[best_index].groups",
    body: "This is the actionable output — which school codes belong in which group. It is what a nutrition director would actually file with the state.",
  },
  {
    step: "3",
    title: "Compare against OneToOne",
    body: "OneToOne is the do-nothing baseline: every school on its own. The gap between it and the winner is the value the optimization created.",
  },
  {
    step: "4",
    title: "Check groups[].cep_eligible",
    body: "A group with cep_eligible: false fell below the ISP threshold and earns nothing. Seeing one in the winning strategy usually means those schools could not be rescued by any grouping.",
  },
];

export default function OutputsPage() {
  return (
    <Box>
      <PageHeader
        eyebrow="Outputs"
        title="What comes back, and how to read it"
        lede="The response is a district object carrying a recommendation plus its own evidence. Every strategy that ran is returned in full, so the recommendation can be checked rather than taken on faith."
      />

      <Typography variant="h2" gutterBottom>
        Read it in this order
      </Typography>
      <Stack spacing={2} sx={{ mb: 5 }}>
        {READING_ORDER.map((r) => (
          <Paper key={r.step} variant="outlined" sx={{ p: 2.5, display: "flex", gap: 2.5 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                flexShrink: 0,
                borderRadius: "50%",
                bgcolor: "primary.main",
                color: "common.white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
              }}
            >
              {r.step}
            </Box>
            <Box>
              <Typography variant="h4" gutterBottom>
                {r.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {r.body}
              </Typography>
            </Box>
          </Paper>
        ))}
      </Stack>

      <Typography variant="h2" gutterBottom>
        The shape of the response
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2, maxWidth: 820 }}>
        A real response from the sample district in the downloadable template, abridged (comments added,
        six of the eight strategies elided). Run it yourself and these are the numbers you get.
      </Typography>
      <Box sx={{ mb: 5 }}>
        <CodeBlock caption="POST /api/districts/optimize/ — 200 OK" code={RESPONSE_EXAMPLE} />
      </Box>

      <Typography variant="h2" gutterBottom>
        Field by field
      </Typography>
      <Box sx={{ mb: 5 }}>
        <FieldTable fields={OUTPUT_FIELDS} />
      </Box>

      <Alert severity="warning" sx={{ mb: 3 }}>
        <AlertTitle>Reimbursement is per serving day, not per year</AlertTitle>
        <code>est_reimbursement</code> is a daily figure derived from average daily meals served. An
        annual estimate means multiplying by your district&apos;s serving-day count — commonly around 180.
      </Alert>

      <Alert severity="info">
        <AlertTitle>It is an estimate, and it says so</AlertTitle>
        Every strategy carries <code>&quot;basis&quot;: &quot;estimated&quot;</code>. Accuracy depends
        entirely on the meals-served numbers you supplied; the eligibility side of the calculation
        (ISP, thresholds, group composition) is exact.
      </Alert>
    </Box>
  );
}
