"use client";

import * as React from "react";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
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
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import VerifiedIcon from "@mui/icons-material/Verified";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import { SERVING_DAYS_PER_YEAR, num, pct, usd } from "@/lib/cep";
import { strategyLabel } from "@/lib/content";
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
    return (
      <Alert severity="error">
        <AlertTitle>No workable grouping came back</AlertTitle>
        Nothing the optimizer tried fit inside your maximum number of groups. Try raising that limit
        in the district settings and running it again.
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h2" gutterBottom>
        Results
      </Typography>

      {result.best_is_optimal ? (
        <Alert severity="success" icon={<VerifiedIcon />} sx={{ mb: 3 }}>
          <AlertTitle>This is the best grouping there is</AlertTitle>
          Every possible way of grouping these schools was accounted for, and none of them earns more
          than this one. You can file this with confidence.
        </Alert>
      ) : (
        <Alert severity="info" sx={{ mb: 3 }}>
          <AlertTitle>The best grouping found</AlertTitle>
          Your district has too many schools to check every possible combination, so this is the best
          grouping the search turned up. It is a strong answer, but not a guarantee that nothing beats
          it.
        </Alert>
      )}

      <Stack direction="row" flexWrap="wrap" useFlexGap spacing={2} sx={{ mb: 3 }}>
        <StatCard
          label="Recommended grouping"
          value={strategyLabel(winner.name)}
          sub={`${winner.groups.length} group${winner.groups.length === 1 ? "" : "s"} across ${result.school_count} schools`}
          highlight
        />
        <StatCard label="Per serving day" value={usd(winner.reimbursement)} sub="Estimated federal reimbursement" />
        <StatCard
          label={`Per year (${SERVING_DAYS_PER_YEAR} days)`}
          value={usd(winner.reimbursement * SERVING_DAYS_PER_YEAR)}
          sub="Typical school year of serving days"
        />
        <StatCard
          label="Students covered"
          value={num(winner.covered_students)}
          sub={`${pct(winner.covered_students / Math.max(result.total_enrolled, 1), 0)} of ${num(result.total_enrolled)} enrolled`}
        />
        <StatCard
          label="Gained by grouping"
          value={lift > 0 ? `+${usd(lift * SERVING_DAYS_PER_YEAR)}` : usd(0)}
          sub="Per year, vs. leaving every school on its own"
        />
      </Stack>

      {lift <= 0 && baseline && (
        <Alert severity="info" sx={{ mb: 3 }}>
          No grouping did better than leaving every school on its own. That is a real answer, not a
          failure: when need is about the same at every school there is no surplus to move around.
        </Alert>
      )}

      <Typography variant="h3" gutterBottom sx={{ mt: 4 }}>
        The recommended groups
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        These are the groups to file — which of your schools belong together on the application.
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
                  <Typography variant="caption" color="text.secondary" component="div">
                    {g.school_codes.length} school{g.school_codes.length === 1 ? "" : "s"}
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Tooltip title="The group\u2019s combined identified student percentage" arrow>
                  <Chip size="small" label={`ISP ${pct(g.isp)}`} />
                </Tooltip>
                <Tooltip title="Share of this group\u2019s meals the USDA pays at the free rate" arrow>
                  <Chip
                    size="small"
                    color={g.free_rate === 1 ? "success" : g.free_rate > 0 ? "warning" : "default"}
                    label={`${pct(g.free_rate)} of meals free`}
                  />
                </Tooltip>
                <Chip size="small" variant="outlined" label={`${usd(g.est_reimbursement)}/day`} />
              </Stack>
            </Stack>

            {!g.cep_eligible && (
              <Alert severity="warning" variant="outlined" sx={{ mb: 1.5, py: 0 }}>
                Below the {pct(g.isp_threshold, 0)} eligibility threshold, so this group earns nothing under
                CEP. These schools could not be carried over the line by any grouping.
              </Alert>
            )}

            <TableContainer sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>School</TableCell>
                    <TableCell align="right">Enrolled</TableCell>
                    <TableCell align="right">Identified</TableCell>
                    <TableCell align="right">ISP on its own</TableCell>
                    <TableCell align="right">Earns per day</TableCell>
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
        Everything else it tried
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Every grouping the optimizer considered, and what each one would have been worth — so you can
        see how the recommendation compares instead of taking it on faith.
      </Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 4, overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Grouping</TableCell>
              <TableCell align="right">Groups</TableCell>
              <TableCell align="right">Students covered</TableCell>
              <TableCell align="right">Per day</TableCell>
              <TableCell align="right">Behind the best</TableCell>
              <TableCell sx={{ width: "22%" }}>
                <Tooltip title="Each bar is scaled between the weakest and strongest result, so small differences stay visible" arrow>
                  <span>How they compare</span>
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
                          <Tooltip title="No other grouping beats this one" arrow>
                            <VerifiedIcon fontSize="small" color="success" />
                          </Tooltip>
                        )}
                        <Typography variant="body2" sx={{ fontWeight: isWinner ? 700 : 400 }}>
                          {strategyLabel(s.name)}
                        </Typography>
                        {s.groups.length === 0 && (
                          <Tooltip title="This approach does not apply to a district of this size" arrow>
                            <Chip size="small" label="not applicable" variant="outlined" />
                          </Tooltip>
                        )}
                        {s.groups.length > (result.max_groups ?? 10) && (
                          <Tooltip title="Set aside — it needs more groups than you are willing to administer" arrow>
                            <Chip size="small" label="too many groups" variant="outlined" />
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

    </Box>
  );
}
