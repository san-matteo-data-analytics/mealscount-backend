"use client";

import * as React from "react";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import PageHeader from "@/components/PageHeader";
import SchoolImport from "@/components/SchoolImport";
import SchoolEditor from "@/components/SchoolEditor";
import SettingsPanel from "@/components/SettingsPanel";
import ResultsView from "@/components/ResultsView";
import OptimizeProgress, { type RunProgress } from "@/components/OptimizeProgress";
import { isAbortError, optimizeDistrict } from "@/lib/api";
import { EMPTY_SCHOOL, SAMPLE_SETTINGS } from "@/lib/sample";
import type { DistrictSettings, OptimizeEvent, OptimizeResponse, SchoolInput } from "@/lib/types";

/** Mirrors EXACT_MAX_SCHOOLS in server.py -- above this, optimality is not proven. */
const EXACT_MAX_SCHOOLS = 16;

const REFERENCE_LINKS = [
  { href: "/reference/how-it-works", label: "How it works", hint: "Why grouping is worth the trouble" },
  { href: "/reference/inputs", label: "What you provide", hint: "Every column, and what it means" },
  { href: "/reference/strategies", label: "How groupings are chosen", hint: "Every approach, in plain terms" },
];

export default function OptimizerPage() {
  const [schools, setSchools] = React.useState<SchoolInput[]>([]);
  const [settings, setSettings] = React.useState<DistrictSettings>({
    ...SAMPLE_SETTINGS,
    name: "",
    code: "DISTRICT-1",
  });
  const [result, setResult] = React.useState<OptimizeResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [run_, setRun] = React.useState<{ startedAt: number; progress: RunProgress } | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const resultsRef = React.useRef<HTMLDivElement>(null);

  const running = run_ !== null;

  // A run outlives this component only if the user navigates away mid-request;
  // drop the listener so a late resolve cannot set state on an unmounted tree.
  React.useEffect(() => () => abortRef.current?.abort(), []);

  const activeSchools = schools.filter(
    (s) => s.active !== false && s.school_code && Number(s.total_enrolled) > 0,
  );
  const hasSchools = schools.length > 0;
  const hasMeals = activeSchools.some(
    (s) => Number(s.daily_lunch_served) > 0 || Number(s.daily_breakfast_served) > 0,
  );

  /** Folds one streamed record into the progress panel's state. */
  function applyEvent(event: OptimizeEvent) {
    setRun((current) => {
      if (!current) return current;
      const p = current.progress;
      switch (event.event) {
        case "start":
          return {
            ...current,
            progress: {
              ...p,
              strategies: event.strategies,
              currentIndex: 0,
              evaluateBy: event.evaluate_by,
              maxGroups: event.max_groups,
            },
          };
        case "strategy_start":
          return { ...current, progress: { ...p, currentIndex: event.index } };
        case "strategy_done":
          return {
            ...current,
            progress: {
              ...p,
              currentIndex: event.index + 1,
              completed: [
                ...p.completed,
                {
                  name: event.name,
                  time: event.time,
                  reimbursement: event.reimbursement,
                  students_covered: event.students_covered,
                  groups: event.groups,
                },
              ],
            },
          };
        default:
          return current;
      }
    });
  }

  async function run() {
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setRun({
      startedAt: performance.now(),
      progress: {
        strategies: null,
        currentIndex: null,
        completed: [],
        streaming: true,
        evaluateBy: settings.evaluate_by,
        maxGroups: settings.max_groups,
      },
    });

    try {
      const res = await optimizeDistrict(
        { ...settings, name: settings.name.trim() || "Unnamed District", schools },
        {
          signal: controller.signal,
          onEvent: applyEvent,
          onFallback: () =>
            setRun((c) => (c ? { ...c, progress: { ...c.progress, streaming: false } } : c)),
        },
      );
      setResult(res);
      requestAnimationFrame(() =>
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    } catch (e) {
      // A stop is the user's own doing, not a failure: leave the previous
      // results and say nothing.
      if (!isAbortError(e)) {
        setError(e instanceof Error ? e.message : String(e));
        setResult(null);
      }
    } finally {
      abortRef.current = null;
      setRun(null);
    }
  }

  function cancel() {
    abortRef.current?.abort();
  }

  return (
    <Box>
      <PageHeader
        eyebrow="MealsCount optimizer"
        title="Find the grouping that funds the most meals"
        lede="Upload your district's schools, check the district settings, and the optimizer will work out the best way to group your schools for the Community Eligibility Provision — then show you what it recommends, and what every other grouping would have earned instead."
      />

      <Box sx={{ mb: 4 }}>
        <SchoolImport
          onImport={(imported) => {
            setSchools(imported);
            setResult(null);
          }}
          onAddBlank={() =>
            setSchools([{ ...EMPTY_SCHOOL, school_code: "1001", school_name: "New school" }])
          }
          hasSchools={hasSchools}
        />
      </Box>

      {hasSchools && (
        <>
          <Stack spacing={3} sx={{ mb: 4 }}>
            <SettingsPanel settings={settings} onChange={setSettings} />
            <SchoolEditor
              schools={schools}
              onChange={(next) => {
                setSchools(next);
                setResult(null);
              }}
              ispThreshold={settings.isp_threshold}
              districtName={settings.name}
            />
          </Stack>

          {!hasMeals && activeSchools.length > 0 && (
            <Alert severity="warning" sx={{ mb: 3 }}>
              <AlertTitle>No meal counts yet</AlertTitle>
              Your schools will still be grouped, but every dollar figure will come back as $0. Fill
              in the breakfasts and lunches columns in the table above to see what each grouping is
              worth.
            </Alert>
          )}

          {run_ ? (
            <OptimizeProgress
              progress={run_.progress}
              startedAt={run_.startedAt}
              onCancel={cancel}
            />
          ) : (
            <Paper
              variant="outlined"
              sx={{
                p: 2.5,
                mb: 4,
                display: "flex",
                flexDirection: { xs: "column", sm: "row" },
                alignItems: { sm: "center" },
                gap: 2,
              }}
            >
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h4">Ready to optimize</Typography>
                <Typography variant="body2" color="text.secondary">
                  {activeSchools.length} school{activeSchools.length === 1 ? "" : "s"} will be included.{" "}
                  {activeSchools.length === 0
                    ? "Every school needs a code and an enrollment count above zero."
                    : activeSchools.length <= EXACT_MAX_SCHOOLS
                      ? "At this size the tool can work out the single best grouping there is, and it comes back right away."
                      : `Above ${EXACT_MAX_SCHOOLS} schools there are too many combinations to settle outright, so the tool searches instead. Allow about a minute at 40 schools, longer for a bigger district. Each grouping appears as it finishes.`}
                </Typography>
              </Box>
              <Button
                variant="contained"
                size="large"
                onClick={run}
                disabled={activeSchools.length === 0}
                startIcon={<PlayArrowIcon />}
                sx={{ flexShrink: 0 }}
              >
                Optimize
              </Button>
            </Paper>
          )}
        </>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 4 }} onClose={() => setError(null)}>
          <AlertTitle>The optimizer could not finish</AlertTitle>
          {error}
          <Typography variant="body2" sx={{ mt: 1 }}>
            Your schools are still here — nothing was lost. Try running it again, and if it keeps
            failing, let whoever set up MealsCount for your district know what this said.
          </Typography>
        </Alert>
      )}

      <Box ref={resultsRef} sx={{ scrollMarginTop: 80 }}>
        {result && (
          <>
            <Divider sx={{ mb: 4 }} />
            <ResultsView result={result} />
          </>
        )}
      </Box>

      <Divider sx={{ my: 5 }} />

      <Typography variant="h3" gutterBottom>
        Reference
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, maxWidth: 760 }}>
        Background on what the optimizer is doing and what the numbers mean. You do not need any of
        it to run your district.
      </Typography>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" },
        }}
      >
        {REFERENCE_LINKS.map((r) => (
          <Paper
            key={r.href}
            variant="outlined"
            component={Link}
            href={r.href}
            sx={{
              p: 2,
              textDecoration: "none",
              display: "block",
              color: "inherit",
              "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
            }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
              <Typography variant="h5">{r.label}</Typography>
              <ArrowForwardIcon fontSize="small" color="primary" />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {r.hint}
            </Typography>
          </Paper>
        ))}
      </Box>
    </Box>
  );
}
