"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CheckIcon from "@mui/icons-material/Check";
import StopIcon from "@mui/icons-material/Stop";
import { usd } from "@/lib/cep";
import type { EvaluateBy } from "@/lib/types";

/** One strategy the server has finished, in the order it finished. */
export interface CompletedStrategy {
  name: string;
  time: number;
  reimbursement: number;
  students_covered: number;
  groups: number;
}

export interface RunProgress {
  /** Raw strategy strings from the "start" record. Null until it arrives. */
  strategies: string[] | null;
  /** Index of the strategy currently running. */
  currentIndex: number | null;
  completed: CompletedStrategy[];
  /** False once we know we fell back to the blocking endpoint — no progress to show. */
  streaming: boolean;
  evaluateBy: EvaluateBy;
  maxGroups: number;
}

/** Strategy names arrive as "Exact?evaluate_by=…"; only the head is meaningful here. */
const label = (name: string) => name.split("?")[0];

/**
 * After this long on a single strategy, say so — the searching strategies run
 * for tens of seconds and silence reads as a hang.
 */
const SLOW_STRATEGY_SECONDS = 6;

const formatElapsed = (seconds: number) => {
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  return `${Math.floor(seconds / 60)}m ${String(Math.floor(seconds % 60)).padStart(2, "0")}s`;
};

export default function OptimizeProgress({
  progress,
  startedAt,
  onCancel,
}: {
  progress: RunProgress;
  /** performance.now() at the moment the request went out. */
  startedAt: number;
  onCancel: () => void;
}) {
  const elapsed = useElapsed(startedAt);
  const { strategies, currentIndex, completed } = progress;

  const total = strategies?.length ?? null;
  const percent = total ? (completed.length / total) * 100 : 0;

  // Time spent on the strategy still running, so we can flag a slow one.
  const spentOnCompleted = completed.reduce((sum, c) => sum + c.time, 0);
  const onCurrent = elapsed - spentOnCompleted;

  // Mirror the server's ranking so the leader shown here is the one that wins:
  // strategies over max_groups are disqualified (server.py evaluate_strategies).
  const score = (c: CompletedStrategy) =>
    progress.evaluateBy === "coverage" ? c.students_covered : c.reimbursement;
  const eligible = completed.filter((c) => c.groups <= progress.maxGroups);
  const leader = eligible.reduce<CompletedStrategy | null>(
    (best, c) => (best === null || score(c) > score(best) ? c : best),
    null,
  );

  return (
    <Paper variant="outlined" sx={{ p: 2.5, mb: 4 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ sm: "center" }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Box sx={{ flexGrow: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 0.5 }}>
            <Typography variant="h4" sx={{ m: 0 }}>
              Optimizing
            </Typography>
            <Chip label={formatElapsed(elapsed)} size="small" variant="outlined" />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {!progress.streaming
              ? "This API has no progress endpoint, so there is nothing to report until it finishes."
              : total === null
                ? "Waiting for the optimizer to start…"
                : currentIndex !== null && currentIndex < total
                  ? `Strategy ${currentIndex + 1} of ${total} — running ${label(strategies![currentIndex])}`
                  : `${completed.length} of ${total} strategies done — scoring the results`}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          color="inherit"
          onClick={onCancel}
          startIcon={<StopIcon />}
          sx={{ flexShrink: 0 }}
        >
          Stop
        </Button>
      </Stack>

      <LinearProgress
        variant={progress.streaming && total !== null ? "determinate" : "indeterminate"}
        value={percent}
        sx={{ height: 6, borderRadius: 1 }}
      />

      {progress.streaming && currentIndex !== null && onCurrent > SLOW_STRATEGY_SECONDS && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
          {label(strategies![currentIndex])} has been searching for {formatElapsed(onCurrent)}. The
          searching strategies take tens of seconds on a large district — this is expected, not a
          hang. Stopping keeps whatever you had before.
        </Typography>
      )}

      {completed.length > 0 && (
        <Box sx={{ mt: 2 }}>
          {completed.map((c) => {
            const isLeader = leader?.name === c.name;
            const disqualified = c.groups > progress.maxGroups;
            return (
              <Stack
                key={c.name}
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{ py: 0.4, borderTop: 1, borderColor: "divider" }}
              >
                <CheckIcon fontSize="small" color="disabled" />
                <Typography variant="body2" sx={{ flexGrow: 1, fontWeight: isLeader ? 600 : 400 }}>
                  {label(c.name)}
                </Typography>
                {disqualified && (
                  <Chip
                    label={`${c.groups} groups — over the cap`}
                    size="small"
                    variant="outlined"
                  />
                )}
                {isLeader && <Chip label="best so far" size="small" color="primary" />}
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontVariantNumeric: "tabular-nums", minWidth: 56, textAlign: "right" }}
                >
                  {c.time < 0.05 ? "<0.1s" : formatElapsed(c.time)}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ fontVariantNumeric: "tabular-nums", minWidth: 96, textAlign: "right" }}
                >
                  {usd(c.reimbursement)}
                </Typography>
              </Stack>
            );
          })}
        </Box>
      )}
    </Paper>
  );
}

/** Seconds since `startedAt`, ticking about twice a second. */
function useElapsed(startedAt: number): number {
  const [elapsed, setElapsed] = React.useState(0);
  React.useEffect(() => {
    setElapsed((performance.now() - startedAt) / 1000);
    const id = setInterval(() => setElapsed((performance.now() - startedAt) / 1000), 500);
    return () => clearInterval(id);
  }, [startedAt]);
  return elapsed;
}
