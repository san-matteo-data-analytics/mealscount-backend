import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PageHeader from "@/components/PageHeader";
import { COST_LABEL, STRATEGIES } from "@/lib/content";

const COST_COLOR: Record<string, "success" | "info" | "warning" | "error"> = {
  trivial: "success",
  cheap: "success",
  moderate: "warning",
  expensive: "error",
};

export default function StrategiesPage() {
  return (
    <Box>
      <PageHeader
        eyebrow="How the groupings are chosen"
        title="Every way it knows to draw up your district"
        lede="For districts of 16 schools or fewer, the optimizer can settle the question outright: it works out the single best grouping, and the other approaches just show you how much that grouping is worth compared with simpler ideas. Above that size no single approach wins every time, so several are tried and the best result is kept."
      />

      <Alert severity="info" sx={{ mb: 4 }}>
        <AlertTitle>How the winner is picked</AlertTitle>
        Every approach is scored the same way — either total dollars or total students covered,
        whichever you chose. Any grouping that needs more groups than you are willing to administer is
        set aside first. The highest score among what is left becomes your recommendation, and if that
        grouping is a guaranteed best, your results say so.
      </Alert>

      <Stack spacing={2.5} sx={{ mb: 5 }}>
        {STRATEGIES.map((s) => (
          <Paper key={s.key} variant="outlined" sx={{ p: { xs: 2.5, md: 3 } }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              justifyContent="space-between"
              alignItems={{ sm: "center" }}
              sx={{ mb: 1 }}
            >
              <Typography variant="h3">{s.label}</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip size="small" label={COST_LABEL[s.cost]} color={COST_COLOR[s.cost]} variant="outlined" />
                <Chip
                  size="small"
                  label={s.autoRun === "always" ? "tried every time" : "large districts only"}
                  variant="outlined"
                />
              </Stack>
            </Stack>

            <Typography variant="subtitle1" color="primary.main" sx={{ fontWeight: 600, mb: 1.5 }}>
              {s.tagline}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.7 }}>
              {s.how}
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
              <strong>When it wins: </strong>
              {s.when}
            </Typography>
          </Paper>
        ))}
      </Stack>

      <Alert severity="info">
        <AlertTitle>You do not have to choose</AlertTitle>
        The optimizer decides which of these are worth trying for your district and runs them for you.
        Your results list every one that ran and what it would have earned, so you can see the
        recommendation next to the alternatives instead of taking it on faith.
      </Alert>
    </Box>
  );
}
