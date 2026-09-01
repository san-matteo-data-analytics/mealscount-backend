"use client";

import * as React from "react";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import VerifiedIcon from "@mui/icons-material/Verified";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import { SERVING_DAYS_PER_YEAR, num, pct, usd } from "@/lib/cep";
import type { OptimizeResponse, StrategyOutput } from "@/lib/types";

function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <Paper
      variant={highlight ? "elevation" : "outlined"}
      elevation={highlight ? 3 : 0}
      sx={{
        p: 2.5,
        flex: "1 1 190px",
        minWidth: 0,
        bgcolor: highlight ? "primary.main" : "background.paper",
        color: highlight ? "common.white" : "text.primary",
      }}
    >
      <Typography variant="overline" sx={{ opacity: highlight ? 0.85 : 1 }} color={highlight ? "inherit" : "text.secondary"}>
        {label}
      </Typography>
      <Typography variant="h3" sx={{ mt: 0.5, wordBreak: "break-word" }}>
        {value}
      </Typography>
      {sub && (
        <Typography variant="caption" sx={{ opacity: highlight ? 0.85 : 1 }} color={highlight ? "inherit" : "text.secondary"}>
          {sub}
        </Typography>
      )}
    </Paper>
  );
}

export default function ResultsView({ result }: { result: OptimizeResponse }) {
  const strategies = result.strategies ?? [];
  const winner: StrategyOutput | undefined =
    result.best_index == null ? undefined : strategies[result.best_index];
  const baseline = strategies.find((s) => s.name === "OneToOne");
  const reimbursements = strategies.map((s) => s.reimbursement);
  const maxReimbursement = Math.max(...reimbursements, 1);
  const minReimbursement = reimbursements.length ? Math.min(...reimbursements) : 0;
  const spread = Math.max(maxReimbursement - minReimbursement, 1);
  const lift = baseline && winner ? winner.reimbursement - baseline.reimbursement : 0;
  const schoolsByCode = React.useMemo(
    () => new Map(result.schools.map((s) => [s.school_code, s])),
    [result.schools],
  );

  if (!winner) {
    return <Alert severity="error">The optimizer returned no usable strategy for this district.</Alert>;
  }

  return (
    <Box>
      <Typography variant="h2" gutterBottom>
        Results
      </Typography>

      {result.best_is_optimal ? (
        <Alert severity="success" icon={<VerifiedIcon />} sx={{ mb: 3 }}>
          <AlertTitle>This grouping is provably optimal</AlertTitle>
          No other way of grouping these schools earns more.{" "}
          {result.optimality_basis ? (
            <Typography variant="body2" component="span" color="text.secondary">
              ({result.optimality_basis})
            </Typography>
          ) : null}
        </Alert>
      ) : (
        <Alert severity="info" sx={{ mb: 3 }}>
          <AlertTitle>Best result found</AlertTitle>
          This district is too large to prove optimality by search, so this is the best grouping the
          strategies found — not a guarantee that nothing beats it.
        </Alert>
      )}

      <Stack direction="row" flexWrap="wrap" useFlexGap spacing={2} sx={{ mb: 3 }}>
        <StatCard
          label="Recommended grouping"
          value={winner.name.split("?")[0]}
          sub={`${winner.groups.length} group${winner.groups.length === 1 ? "" : "s"} across ${result.school_count} schools`}
          highlight
        />
        <StatCard label="Per serving day" value={usd(winner.reimbursement)} sub="Estimated federal reimbursement" />
        <StatCard
          label={`Annualized (${SERVING_DAYS_PER_YEAR} days)`}
          value={usd(winner.reimbursement * SERVING_DAYS_PER_YEAR)}
          sub="Daily figure × serving days"
        />
        <StatCard
          label="Students covered"
          value={num(winner.covered_students)}
          sub={`${pct(winner.covered_students / Math.max(result.total_enrolled, 1), 0)} of ${num(result.total_enrolled)} enrolled`}
        />
        <StatCard
          label="Gain over doing nothing"
          value={lift > 0 ? `+${usd(lift * SERVING_DAYS_PER_YEAR)}` : usd(0)}
          sub="Per year, vs. every school on its own"
        />
      </Stack>

      {lift <= 0 && baseline && (
        <Alert severity="info" sx={{ mb: 3 }}>
          No grouping beat the school-by-school baseline here. That is a real answer: in districts with
          uniform ISP there is no surplus to move around.
        </Alert>
      )}

      <Typography variant="h3" gutterBottom sx={{ mt: 4 }}>
        The recommended groups
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        This is the actionable output — which schools to file together.
      </Typography>

      <Stack spacing={2} sx={{ mb: 4 }}>
        {winner.groups.map((g, gi) => (
          <Paper
            key={`${g.name}-${gi}`}
            variant="outlined"
            sx={{ p: 2.5, borderLeft: 5, borderLeftColor: g.cep_eligible ? "success.main" : "grey.400" }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ sm: "center" }}
              spacing={1}
              sx={{ mb: 1.5 }}
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                {g.cep_eligible ? <CheckCircleIcon color="success" /> : <CancelIcon sx={{ color: "grey.500" }} />}
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="h4">Group {gi + 1}</Typography>
                  {/* Strategies name their groups inconsistently — Exhaustive uses bare
                      integers, Binning uses ISP ranges. Show it, but never as the heading. */}
                  <Typography variant="caption" color="text.secondary" noWrap component="div">
                    API name: <code>{g.name}</code>
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Tooltip title="Pooled identified student percentage" arrow>
                  <Chip size="small" label={`ISP ${pct(g.isp)}`} />
                </Tooltip>
                <Tooltip title="Share of meals paid at the free rate: min(ISP × 1.6, 100%)" arrow>
                  <Chip
                    size="small"
                    color={g.free_rate === 1 ? "success" : g.free_rate > 0 ? "warning" : "default"}
                    label={`Free rate ${pct(g.free_rate)}`}
                  />
                </Tooltip>
                <Chip size="small" variant="outlined" label={`${usd(g.est_reimbursement)}/day`} />
              </Stack>
            </Stack>

            {!g.cep_eligible && (
              <Alert severity="warning" variant="outlined" sx={{ mb: 1.5, py: 0 }}>
                Below the {pct(g.isp_threshold, 0)} threshold — this group earns nothing under CEP.
              </Alert>
            )}

            <TableContainer sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>School</TableCell>
                    <TableCell align="right">Enrolled</TableCell>
                    <TableCell align="right">Identified</TableCell>
                    <TableCell align="right">Own ISP</TableCell>
                    <TableCell align="right">Reimbursement / day</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {g.school_codes.map((code) => {
                    const school = schoolsByCode.get(code);
                    const money = g.school_reimbursements.find((r) => r[0] === code)?.[1] ?? 0;
                    return (
                      <TableRow key={code}>
                        <TableCell>{school?.school_name ?? code}</TableCell>
                        <TableCell align="right">{num(school?.total_enrolled ?? 0)}</TableCell>
                        <TableCell align="right">{num(school?.total_eligible ?? 0)}</TableCell>
                        <TableCell align="right">{pct(school?.isp ?? 0, 0)}</TableCell>
                        <TableCell align="right">{usd(money, 2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        ))}
      </Stack>

      <Typography variant="h3" gutterBottom sx={{ mt: 4 }}>
        Every strategy that ran
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        The optimizer returns all of them, not just the winner — so the recommendation can be checked
        rather than trusted.
      </Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 4, overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Strategy</TableCell>
              <TableCell align="right">Groups</TableCell>
              <TableCell align="right">Students covered</TableCell>
              <TableCell align="right">Per day</TableCell>
              <TableCell align="right">Gap to best</TableCell>
              <TableCell sx={{ width: "22%" }}>
                <Tooltip title="Scaled between the lowest- and highest-scoring strategy, so small differences stay visible" arrow>
                  <span>Spread</span>
                </Tooltip>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {[...strategies]
              .sort((a, b) => b.reimbursement - a.reimbursement)
              .map((s) => {
                const isWinner = s === winner;
                const gap = winner.reimbursement - s.reimbursement;
                return (
                  <TableRow key={s.name} hover selected={isWinner}>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {isWinner && <EmojiEventsIcon fontSize="small" color="primary" />}
                        {s.optimal && (
                          <Tooltip title={s.optimality_basis ?? "Proven optimal"} arrow>
                            <VerifiedIcon fontSize="small" color="success" />
                          </Tooltip>
                        )}
                        <Typography variant="body2" sx={{ fontWeight: isWinner ? 700 : 400 }}>
                          {s.name.split("?")[0]}
                        </Typography>
                        {s.groups.length === 0 && (
                          <Tooltip title={s.optimality_basis ?? "This strategy did not produce a grouping"} arrow>
                            <Chip size="small" label="did not run" variant="outlined" />
                          </Tooltip>
                        )}
                        {s.groups.length > (result.max_groups ?? 10) && (
                          <Tooltip title="Disqualified: more groups than max_groups allows" arrow>
                            <Chip size="small" label="over cap" variant="outlined" />
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell align="right">{s.groups.length}</TableCell>
                    <TableCell align="right">{num(s.covered_students)}</TableCell>
                    <TableCell align="right">{usd(s.reimbursement)}</TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color={isWinner ? "success.main" : "text.secondary"}>
                        {isWinner ? "—" : gap < 0.005 ? "tied" : `-${usd(gap)}`}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <LinearProgress
                        variant="determinate"
                        value={((s.reimbursement - minReimbursement) / spread) * 100}
                        sx={{
                          height: 8,
                          borderRadius: 4,
                          // The bar needs to contrast with its own track, otherwise
                          // every row reads as full.
                          "& .MuiLinearProgress-bar": {
                            bgcolor: isWinner ? "primary.main" : "primary.light",
                          },
                        }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </TableContainer>

      <Accordion variant="outlined" disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h5">Raw API response</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            Exactly what <code>POST /api/districts/optimize/</code> returned
            {result.optimization_info ? ` in ${result.optimization_info.time.toFixed(2)}s` : ""}.
          </Typography>
          <Divider sx={{ mb: 1.5 }} />
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 2,
              maxHeight: 480,
              overflow: "auto",
              bgcolor: "#1e2422",
              color: "#e6f0ea",
              borderRadius: 1,
              fontSize: "0.75rem",
            }}
          >
            {JSON.stringify(result, null, 2)}
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
