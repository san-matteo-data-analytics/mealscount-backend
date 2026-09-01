import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import PageHeader from "@/components/PageHeader";
import CodeBlock from "@/components/CodeBlock";
import { STRATEGIES } from "@/lib/content";

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
        eyebrow="Strategies"
        title="Every way it knows to draw a district"
        lede="For districts up to 16 schools, Exact settles the question outright — it proves which grouping is best, and the heuristics become a way to see how much the optimization is actually worth. Above that size no algorithm wins everywhere, so MealsCount runs several and keeps the best."
      />

      <Alert severity="info" sx={{ mb: 4 }}>
        <AlertTitle>How the winner is picked</AlertTitle>
        Every strategy is scored on the same objective (<code>evaluate_by</code>: reimbursement or
        coverage). Any strategy producing more than <code>max_groups</code> groups is disqualified first.
        The highest remaining score wins and lands in <code>best_strategy</code>. Ties go to a strategy
        that can prove optimality, so a proven result is reported as proven — check{" "}
        <code>best_is_optimal</code> in the response.
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
                <Chip size="small" label={`${s.cost} to run`} color={COST_COLOR[s.cost]} variant="outlined" />
                <Chip
                  size="small"
                  label={s.autoRun === "always" ? "always run" : "large districts only"}
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
            <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.7 }}>
              <strong>When it wins: </strong>
              {s.when}
            </Typography>

            {s.params && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="overline" color="text.secondary">
                  Tunable parameters
                </Typography>
                <Table size="small" sx={{ mt: 0.5 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Effect</TableCell>
                      <TableCell>Default</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {s.params.map((p) => (
                      <TableRow key={p.name}>
                        <TableCell sx={{ fontFamily: "monospace" }}>{p.name}</TableCell>
                        <TableCell>{p.meaning}</TableCell>
                        <TableCell sx={{ fontFamily: "monospace", whiteSpace: "nowrap" }}>{p.default}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}

            <Divider sx={{ my: 2 }} />
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
              <Typography variant="caption" color="text.secondary">
                Request key
              </Typography>
              <Chip size="small" label={s.key} sx={{ fontFamily: "monospace" }} />
              <Typography variant="caption" color="text.secondary">
                Source
              </Typography>
              <Chip size="small" variant="outlined" label={s.source} sx={{ fontFamily: "monospace" }} />
            </Stack>
          </Paper>
        ))}
      </Stack>

      <Typography variant="h2" gutterBottom>
        Choosing them yourself
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2, maxWidth: 820 }}>
        The server picks a sensible default set — the six cheap strategies always, plus{" "}
        <code>NYCMODA</code> and <code>GreedyLP</code> once a district exceeds 11 schools. Pass{" "}
        <code>strategies_to_run</code> to override, using query-string syntax for parameters.
      </Typography>
      <CodeBlock
        caption="Overriding the strategy set"
        code={`{
  "state_code": "ca",
  "schools": [ ... ],
  "strategies_to_run": [
    "OneToOne",
    "Pairs",
    "Binning?isp_width=0.05",
    "NYCMODA?fresh_starts=200&iterations=5000&ngroups=6&evaluate_by=coverage"
  ]
}`}
      />
    </Box>
  );
}
