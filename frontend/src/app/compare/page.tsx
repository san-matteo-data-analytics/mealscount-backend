"use client";

import * as React from "react";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import VerifiedIcon from "@mui/icons-material/Verified";
import BoltIcon from "@mui/icons-material/Bolt";
import PageHeader from "@/components/PageHeader";
import SchoolImport from "@/components/SchoolImport";
import SettingsPanel from "@/components/SettingsPanel";
import { compareDistrict, isAbortError } from "@/lib/api";
import { strategyLabel } from "@/lib/content";
import { EMPTY_SCHOOL, SAMPLE_SCHOOLS, SAMPLE_SETTINGS } from "@/lib/sample";
import type { CompareResponse, CompareSide, DistrictSettings, SchoolInput } from "@/lib/types";

const money = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const seconds = (n: number) => (n < 0.05 ? "under 0.1s" : `${n.toFixed(1)}s`);

/** One side of the comparison. Same shape both times so the eye can diff them. */
function SideCard({
  side,
  title,
  subtitle,
  accent,
}: {
  side: CompareSide;
  title: string;
  subtitle: string;
  accent: "default" | "primary";
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 2.5, md: 3 },
        flex: 1,
        minWidth: 0,
        borderColor: accent === "primary" ? "primary.main" : undefined,
        borderWidth: accent === "primary" ? 2 : 1,
      }}
    >
      <Typography variant="overline" color="text.secondary">
        {title}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
        {subtitle}
      </Typography>

      <Typography variant="h2" sx={{ mb: 0.5 }}>
        {money(side.est_reimbursement)}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
        estimated per day
      </Typography>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        <Chip
          size="small"
          variant="outlined"
          color={side.best_is_optimal ? "success" : "default"}
          icon={side.best_is_optimal ? <VerifiedIcon /> : undefined}
          label={side.best_is_optimal ? "guaranteed best" : "best of what it tried"}
        />
        <Chip size="small" variant="outlined" label={seconds(side.seconds)} />
        <Chip size="small" variant="outlined" label={`${side.group_count} groups`} />
      </Stack>

      <Divider sx={{ mb: 1.5 }} />
      <Typography variant="body2" color="text.secondary">
        Winner:{" "}
        <Box component="span" sx={{ color: "text.primary", fontWeight: 600 }}>
          {side.best_strategy ? strategyLabel(side.best_strategy) : "none"}
        </Box>
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
        Tried {side.strategies_run.length}:{" "}
        {side.strategies_run.map((s) => strategyLabel(s)).join(", ")}
      </Typography>
      {side.optimality_basis ? (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
          {side.optimality_basis}
        </Typography>
      ) : null}
    </Paper>
  );
}

/** The headline. Written to say what actually changed, which is usually not the dollars. */
function Verdict({ result }: { result: CompareResponse }) {
  const { delta } = result;
  const gained = delta.reimbursement > 0.005;
  const lost = delta.reimbursement < -0.005;

  const headline = lost
    ? `${money(Math.abs(delta.reimbursement))} per day worse`
    : gained
      ? `${money(delta.reimbursement)} per day better`
      : "Same money, settled outright";

  const detail = lost
    ? "The new optimizer found a worse grouping here. That is a regression worth reporting."
    : gained
      ? delta.percent !== null
        ? `A ${(delta.percent * 100).toFixed(2)}% improvement on this district.`
        : "The baseline earned nothing here, so there is no percentage to quote."
      : delta.newly_proven_optimal
        ? "Both optimizers found a grouping worth the same amount. The difference is that the new one proved no better grouping exists, and the old one could only report the best it happened to try."
        : "Both optimizers found a grouping worth the same amount.";

  return (
    <Alert
      severity={lost ? "warning" : gained ? "success" : "info"}
      icon={delta.newly_proven_optimal && !gained ? <VerifiedIcon /> : undefined}
      sx={{ mb: 3 }}
    >
      <AlertTitle>{headline}</AlertTitle>
      {detail}
      {delta.speedup && delta.speedup >= 1.5 ? (
        <Box sx={{ mt: 1, display: "flex", alignItems: "center", gap: 0.75 }}>
          <BoltIcon fontSize="small" />
          <span>
            It also arrived {delta.speedup.toFixed(0)}x faster —{" "}
            {seconds(result.baseline.seconds)} down to {seconds(result.improved.seconds)}.
          </span>
        </Box>
      ) : null}
    </Alert>
  );
}

export default function ComparePage() {
  const [schools, setSchools] = React.useState<SchoolInput[]>([]);
  const [settings, setSettings] = React.useState<DistrictSettings>({ ...SAMPLE_SETTINGS });
  const [result, setResult] = React.useState<CompareResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);
  const resultsRef = React.useRef<HTMLDivElement>(null);

  const runnable = schools.length > 0 && !busy;

  // Same rule as the optimizer page: no more groups than schools that will be sent.
  const activeCount = schools.filter(
    (s) => s.active !== false && s.school_code && Number(s.total_enrolled) > 0,
  ).length;
  React.useEffect(() => {
    if (activeCount > 0) {
      setSettings((s) => (s.max_groups > activeCount ? { ...s, max_groups: activeCount } : s));
    }
  }, [activeCount]);

  async function run() {
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError(null);
    try {
      const res = await compareDistrict(
        { ...settings, name: settings.name.trim() || "Unnamed District", schools },
        controller.signal,
      );
      setResult(res);
      requestAnimationFrame(() =>
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    } catch (e) {
      if (!isAbortError(e)) {
        setError(e instanceof Error ? e.message : String(e));
        setResult(null);
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  return (
    <Box>
      <PageHeader
        eyebrow="Old optimizer vs new"
        title="What the changes actually bought"
        lede="Runs one district through the optimizer twice — once exactly as the main branch does it, once as this branch does — and shows both answers side by side. Same schools, same settings, same scoring, so any difference is a difference in the grouping each one found."
      />

      <Alert severity="info" sx={{ mb: 4 }}>
        <AlertTitle>What to expect</AlertTitle>
        On most districts both sides land on the same dollars, because the old optimizer was already
        finding good groupings. What usually changes is that the new one can <em>prove</em> its answer
        is the best there is, and gets there in a fraction of the time. Districts above 16 schools are
        the exception: neither side can prove anything there, and the comparison is a straight
        dollars-to-dollars read.
      </Alert>

      <Stack spacing={3} sx={{ mb: 4 }}>
        <SchoolImport
          onImport={(rows) => setSchools(rows)}
          onAddBlank={() => setSchools((c) => [...c, { ...EMPTY_SCHOOL }])}
          hasSchools={schools.length > 0}
        />

        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="center">
          <Button
            variant="outlined"
            onClick={() => {
              setSchools(SAMPLE_SCHOOLS.map((s) => ({ ...s })));
              setSettings({ ...SAMPLE_SETTINGS });
            }}
          >
            Use the sample district
          </Button>
          {schools.length > 0 ? (
            <Typography variant="body2" color="text.secondary">
              {schools.length} schools loaded
            </Typography>
          ) : null}
        </Stack>

        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          schoolCount={activeCount}
          showExtendedSearch={false}
        />

        <Box>
          <Button
            size="large"
            variant="contained"
            onClick={run}
            disabled={!runnable}
            startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <CompareArrowsIcon />}
          >
            {busy ? "Running both optimizers…" : "Run the comparison"}
          </Button>
          {busy ? (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              The baseline side runs the slow strategies the new default set exists to avoid, so this
              takes longer than a normal run — often 20 seconds or more above 11 schools.
            </Typography>
          ) : null}
        </Box>
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          <AlertTitle>Comparison failed</AlertTitle>
          {error}
        </Alert>
      ) : null}

      {result ? (
        <Box ref={resultsRef}>
          <Typography variant="h2" sx={{ mb: 0.5 }}>
            {result.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {result.school_count} schools · {result.total_enrolled.toLocaleString()} enrolled ·
            district ISP {(result.overall_isp * 100).toFixed(1)}%
          </Typography>

          <Verdict result={result} />

          <Stack direction={{ xs: "column", md: "row" }} spacing={2.5} sx={{ mb: 4 }}>
            <SideCard
              side={result.baseline}
              title="Original"
              subtitle="the optimizer as the main branch runs it"
              accent="default"
            />
            <SideCard
              side={result.improved}
              title="Improved"
              subtitle="the optimizer as this branch runs it"
              accent="primary"
            />
          </Stack>

          <Typography variant="h3" sx={{ mb: 1.5 }}>
            Every approach, both times
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            What each approach was worth on this district. A dash means that side never ran it.
          </Typography>
          <Paper variant="outlined" sx={{ overflowX: "auto", mb: 5 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Approach</TableCell>
                  <TableCell align="right">Original</TableCell>
                  <TableCell align="right">Improved</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {strategyRows(result).map((row) => (
                  <TableRow key={row.label} selected={row.isWinner}>
                    <TableCell>
                      {row.label}
                      {row.isWinner ? (
                        <Chip size="small" label="winner" sx={{ ml: 1 }} color="primary" />
                      ) : null}
                    </TableCell>
                    <TableCell align="right">
                      {row.baseline === null ? "—" : money(row.baseline)}
                    </TableCell>
                    <TableCell align="right">
                      {row.improved === null ? "—" : money(row.improved)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Box>
      ) : null}
    </Box>
  );
}

/** Union of the approaches either side ran, with what each was worth. */
function strategyRows(result: CompareResponse) {
  const byLabel = new Map<string, { baseline: number | null; improved: number | null }>();
  const add = (side: CompareSide, key: "baseline" | "improved") => {
    for (const s of side.strategies) {
      const label = strategyLabel(s.name);
      const row = byLabel.get(label) ?? { baseline: null, improved: null };
      row[key] = s.reimbursement;
      byLabel.set(label, row);
    }
  };
  add(result.baseline, "baseline");
  add(result.improved, "improved");

  const winner = result.improved.best_strategy ? strategyLabel(result.improved.best_strategy) : null;
  return [...byLabel.entries()]
    .map(([label, v]) => ({ label, ...v, isWinner: label === winner }))
    .sort((a, b) => Math.max(b.improved ?? 0, b.baseline ?? 0) - Math.max(a.improved ?? 0, a.baseline ?? 0));
}
