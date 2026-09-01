"use client";

import * as React from "react";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
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
import { optimizeDistrict } from "@/lib/api";
import { EMPTY_SCHOOL, SAMPLE_SETTINGS } from "@/lib/sample";
import type { DistrictSettings, OptimizeResponse, SchoolInput } from "@/lib/types";

const REFERENCE_LINKS = [
  { href: "/reference/how-it-works", label: "How it works", hint: "Why grouping is worth optimizing" },
  { href: "/reference/inputs", label: "Input reference", hint: "Every field, and the silent failures" },
  { href: "/reference/outputs", label: "Output reference", hint: "How to read the response" },
  { href: "/reference/strategies", label: "Strategies", hint: "The eight algorithms" },
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
  const [running, setRunning] = React.useState(false);
  const resultsRef = React.useRef<HTMLDivElement>(null);

  const activeSchools = schools.filter(
    (s) => s.active !== false && s.school_code && Number(s.total_enrolled) > 0,
  );
  const hasSchools = schools.length > 0;
  const hasMeals = activeSchools.some(
    (s) => Number(s.daily_lunch_served) > 0 || Number(s.daily_breakfast_served) > 0,
  );

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const res = await optimizeDistrict({
        ...settings,
        name: settings.name.trim() || "Unnamed District",
        schools,
      });
      setResult(res);
      requestAnimationFrame(() =>
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setResult(null);
    } finally {
      setRunning(false);
    }
  }

  return (
    <Box>
      <PageHeader
        eyebrow="MealsCount optimizer"
        title="Find the grouping that funds the most meals"
        lede="Upload your district's schools, set the district options, and the optimizer will try eight ways of grouping them into USDA Community Eligibility Provision groups — then show you the one worth the most, and what each alternative would have earned."
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
              <AlertTitle>No meals-served data</AlertTitle>
              Grouping will still be computed, but every reimbursement figure will come back as $0.
              Fill in the breakfast and lunch columns to get dollar estimates.
            </Alert>
          )}

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
                {activeSchools.length} school{activeSchools.length === 1 ? "" : "s"} will be sent.{" "}
                {activeSchools.length === 0
                  ? "Every school needs a code and a non-zero enrollment."
                  : activeSchools.length > 11
                    ? "Above 11 schools the server also runs simulated annealing and the LP solver — expect several seconds."
                    : "At this size the exhaustive search runs, so the answer is provably optimal."}
              </Typography>
            </Box>
            <Button
              variant="contained"
              size="large"
              onClick={run}
              disabled={running || activeSchools.length === 0}
              startIcon={running ? <CircularProgress size={18} color="inherit" /> : <PlayArrowIcon />}
              sx={{ flexShrink: 0 }}
            >
              {running ? "Optimizing…" : "Optimize"}
            </Button>
          </Paper>
        </>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          <AlertTitle>Could not reach the optimizer</AlertTitle>
          {error}
          <Box component="pre" sx={{ mt: 1, fontSize: "0.78rem", whiteSpace: "pre-wrap" }}>
            Start the API from the repo root: venv/bin/python server.py{"\n"}
            Or point at production: MEALSCOUNT_API_ORIGIN=https://www.mealscount.com npm run dev
          </Box>
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
        Background on what the optimizer is doing and what the numbers mean. None of it is needed to
        run an optimization.
      </Typography>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" },
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
