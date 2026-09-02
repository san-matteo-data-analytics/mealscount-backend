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
    q: "What problem is this solving?",
    a: "Under the USDA's Community Eligibility Provision, a district can serve free breakfast and lunch to every student in a group of schools — no applications, no household forms, no unpaid meal debt, no stigma. Whether a group qualifies depends on the combined share of its students who are already identified as eligible. Districts get to choose the groups, and that choice is worth real money.",
  },
  {
    q: "Why does the grouping matter so much?",
    a: "Funding stops climbing at 62.5%. A school at 85% is 22.5 points past the point where more need earns more money, while a school at 40% is only partly funded and one at 20% earns nothing at all. Put them in the same group and that wasted surplus lifts the weaker school over the line.",
  },
  {
    q: "Why not just work it out by hand?",
    a: "With three or four schools you can. The number of ways to group a district grows faster than almost anyone expects: 5 schools have 52 possible groupings, 10 schools have about 116,000, and 20 schools have more than 51 trillion. And the answer is measured in dollars, not percentages, so it also depends on how many meals each school actually serves.",
  },
  {
    q: "What do I get at the end?",
    a: "A recommended set of groups — which schools to file together — the estimated reimbursement it earns, and what every other grouping the tool tried would have earned instead. You can see the runner-up and how much it lost by, so the recommendation is something you can check rather than something you have to trust.",
  },
];

export default function Home() {
  return (
    <Box>
      <PageHeader
        eyebrow="How it works"
        title="Your school data in, the best grouping out"
        lede="MealsCount takes your district's schools, tries many different ways of grouping them for the Community Eligibility Provision, and gives you back the one that brings in the most federal meal reimbursement. For most districts it can go further and tell you that no other grouping does better. This page walks through what that means."
      />

      <PipelineDiagram />

      <Alert severity="info" sx={{ mb: 5 }}>
        <AlertTitle>The short version</AlertTitle>
        Grouping high-poverty schools together with lower-poverty ones can qualify <em>both</em> for
        free meals. The optimizer looks for the grouping that brings in the most money — or, if you
        prefer, the one that feeds the most students.
      </Alert>

      <Box sx={{ mb: 5 }}>
        <IspExplorer />
      </Box>

      <Typography variant="h2" gutterBottom>
        The questions people ask first
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
            Upload your own spreadsheet, or start from the downloadable example district — then edit
            any number on screen to see how the answer moves.
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
