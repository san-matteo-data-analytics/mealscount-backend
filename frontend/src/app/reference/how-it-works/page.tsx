import Link from "next/link";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import PageHeader from "@/components/PageHeader";
import PipelineDiagram from "@/components/PipelineDiagram";
import IspExplorer from "@/components/IspExplorer";

const QUESTIONS = [
  {
    q: "What problem is being solved?",
    a: "Under the USDA's Community Eligibility Provision, a district can serve free meals to every student in a group of schools — no applications, no paperwork, no stigma. Whether a group qualifies depends on the pooled percentage of students already identified as needy. Districts get to choose the groups, and the choice is worth real money.",
  },
  {
    q: "Why does grouping matter so much?",
    a: "Funding saturates at 62.5% ISP. A school at 85% is leaving 22.5 points of surplus on the table, while a school at 40% is only partly funded and one at 20% gets nothing. Put them in the same group and the surplus is no longer wasted — it lifts the weaker school over the line.",
  },
  {
    q: "Why can't a person just do this by hand?",
    a: "For three or four schools you can. The number of possible groupings is the Bell number of the school count: 5 schools give 52 options, 10 give 115,975, and 20 give more than 51 trillion. Meanwhile the objective is dollars, not percentages, so it depends on how many meals each school actually serves.",
  },
  {
    q: "What does the tool actually return?",
    a: "A recommended set of groups, the estimated daily reimbursement, and the full result of every strategy it tried. The recommendation is auditable: you can see what the runner-up proposed and by how much it lost.",
  },
];

export default function Home() {
  return (
    <Box>
      <PageHeader
        eyebrow="How it works"
        title="School data in, a funding-optimal grouping out"
        lede="MealsCount takes a district's schools, tries many different ways of grouping them into USDA Community Eligibility Provision groups, and returns the one that brings in the most federal meal reimbursement — proving it optimal where the district is small enough. This page explains what that means end to end."
      />

      <PipelineDiagram />

      <Alert severity="info" sx={{ mb: 5 }}>
        <AlertTitle>The short version</AlertTitle>
        Grouping high-poverty schools together with lower-poverty ones can qualify <em>both</em> for
        free meals. The optimizer searches for the grouping that maximizes reimbursement — or, if you
        prefer, the one that covers the most students.
      </Alert>

      <Box sx={{ mb: 5 }}>
        <IspExplorer />
      </Box>

      <Typography variant="h2" gutterBottom>
        The four questions people ask first
      </Typography>
      <Stack spacing={2} sx={{ mb: 5 }}>
        {QUESTIONS.map((item) => (
          <Paper key={item.q} variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="h4" gutterBottom>
              {item.q}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
              {item.a}
            </Typography>
          </Paper>
        ))}
      </Stack>

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
            Run it on your district
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            Upload your own CSV or Excel file, or start from the downloadable template. The optimizer
            posts to the same <code>/api/districts/optimize/</code> endpoint the production site uses.
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
