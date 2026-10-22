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
    kicker: "YOU PROVIDE",
    title: "Your district's schools",
    body: "One row per school: students enrolled, students already identified as eligible, and meals served on a typical day — plus a few district-wide settings.",
    items: ["Enrollment", "Identified students", "Lunches per day", "Breakfasts per day", "State", "Eligibility threshold"],
    color: "primary.main",
  },
  {
    icon: <SettingsSuggestIcon />,
    kicker: "THE TOOL DOES",
    title: "Tries many ways to group them",
    body: "Each approach draws up the district differently — pairing schools, spreading surplus around, banding by need. Every version is priced out end to end, and the best one that stays within your group limit wins. Up to 16 schools, the tool can work out the single best grouping there is, so the answer is not just a good guess.",
    items: ["Each school alone", "One district-wide group", "Paired schools", "Shared surplus", "Grouped by need band", "Best possible grouping"],
    color: "secondary.main",
  },
  {
    icon: <TableChartIcon />,
    kicker: "YOU GET BACK",
    title: "A recommended grouping, with the runners-up",
    body: "Which schools to file together, what it is estimated to earn per day and per year, how many students it covers, and what every other grouping would have earned instead.",
    items: ["Recommended groups", "Estimated reimbursement", "Students covered", "Gain over doing nothing"],
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
                  sx={{ fontSize: "0.72rem" }}
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
