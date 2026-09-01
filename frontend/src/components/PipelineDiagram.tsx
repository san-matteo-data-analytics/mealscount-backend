import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import InputIcon from "@mui/icons-material/Input";
import SettingsSuggestIcon from "@mui/icons-material/SettingsSuggest";
import TableChartIcon from "@mui/icons-material/TableChart";

const STAGES = [
  {
    icon: <InputIcon />,
    kicker: "INPUT",
    title: "A district's schools",
    body: "One row per school: how many students are enrolled, how many are already identified as needy, and how many meals get served each day. Plus a handful of district-level settings.",
    items: ["total_enrolled", "total_eligible", "daily_lunch_served", "daily_breakfast_served", "state_code", "isp_threshold"],
    color: "primary.main",
  },
  {
    icon: <SettingsSuggestIcon />,
    kicker: "PROCESS",
    title: "Eight grouping strategies, run in parallel",
    body: "Each strategy proposes a different way to partition the schools into CEP groups. Every proposal is scored end to end, then the highest-scoring one that respects max_groups wins.",
    items: ["OneToOne", "OneGroup", "Pairs", "Spread", "Binning", "Exhaustive", "NYCMODA", "GreedyLP"],
    color: "secondary.main",
  },
  {
    icon: <TableChartIcon />,
    kicker: "OUTPUT",
    title: "A recommended grouping, with the runners-up",
    body: "The winning strategy's groups, the estimated daily reimbursement, and the full results of every other strategy so the recommendation can be checked rather than trusted.",
    items: ["best_strategy", "est_reimbursement", "groups[]", "school_reimbursements", "strategies[]"],
    color: "success.main",
  },
];

export default function PipelineDiagram() {
  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      spacing={0}
      alignItems="stretch"
      sx={{ mb: 2 }}
    >
      {STAGES.map((stage, idx) => (
        <Stack key={stage.kicker} direction={{ xs: "column", md: "row" }} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
          <Paper
            variant="outlined"
            sx={{
              p: 2.5,
              flex: 1,
              width: "100%",
              minWidth: 0,
              borderTop: 4,
              borderTopColor: stage.color,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ color: stage.color, mb: 1 }}>
              {stage.icon}
              <Typography variant="overline">{stage.kicker}</Typography>
            </Stack>
            <Typography variant="h4" gutterBottom>
              {stage.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, flexGrow: 1 }}>
              {stage.body}
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
              {stage.items.map((i) => (
                <Chip
                  key={i}
                  label={i}
                  size="small"
                  variant="outlined"
                  sx={{ fontFamily: "monospace", fontSize: "0.72rem" }}
                />
              ))}
            </Box>
          </Paper>
          {idx < STAGES.length - 1 && (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", p: 1.5, color: "text.disabled" }}>
              <Box sx={{ display: { xs: "none", md: "block" } }}>
                <ArrowForwardIcon />
              </Box>
              <Box sx={{ display: { xs: "block", md: "none" } }}>
                <ArrowDownwardIcon />
              </Box>
            </Box>
          )}
        </Stack>
      ))}
    </Stack>
  );
}
