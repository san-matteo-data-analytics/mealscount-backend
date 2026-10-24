"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Slider from "@mui/material/Slider";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { fetchStates } from "@/lib/api";
import { pct, rateTier, RATE_TIER_LABEL } from "@/lib/cep";
import { mergeStates, US_JURISDICTIONS } from "@/lib/states";
import type { StateOption } from "@/lib/states";
import type { DistrictSettings, EvaluateBy, HhfkaSixty } from "@/lib/types";

/** Mirrors EXACT_MAX_SCHOOLS in server.py -- above this, optimality is not proven. */
const EXACT_MAX_SCHOOLS = 16;

/**
 * The picker starts from the full jurisdiction list so it works before (or
 * without) the API, then merges in whatever /api/states/ reports so states
 * added to data/ show up without a frontend change.
 */
function useStates(selectedCode: string): StateOption[] {
  const [live, setLive] = React.useState<StateOption[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    fetchStates()
      .then((states) => {
        if (!cancelled) setLive(states);
      })
      .catch(() => {
        // The baseline list is enough to pick a rate table; no need to nag.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return React.useMemo(() => {
    const merged = mergeStates(live, US_JURISDICTIONS);
    // Never let the Select hold a value that is not in its options.
    return merged.some((s) => s.code === selectedCode)
      ? merged
      : mergeStates(merged, [{ code: selectedCode, name: selectedCode.toUpperCase() }]);
  }, [live, selectedCode]);
}

export default function SettingsPanel({
  settings,
  onChange,
  schoolCount,
  showExtendedSearch = true,
}: {
  settings: DistrictSettings;
  onChange: (s: DistrictSettings) => void;
  /** Schools that will be sent to the optimizer. More groups than this is meaningless. */
  schoolCount: number;
  /** Off where the endpoint does not run the extended search (the comparison page). */
  showExtendedSearch?: boolean;
}) {
  const set = <K extends keyof DistrictSettings>(key: K, value: DistrictSettings[K]) =>
    onChange({ ...settings, [key]: value });

  const states = useStates(settings.state_code);

  // Exact already proves the optimum at this size, so the extended search adds nothing.
  const extendedSearchApplies = schoolCount === 0 || schoolCount > EXACT_MAX_SCHOOLS;

  // Before any schools are loaded there is nothing to cap against.
  const maxGroupsCap = schoolCount > 0 ? schoolCount : undefined;

  // The field holds its own text so it can be cleared mid-edit; only a valid
  // whole number in range is committed, and blur snaps the text back to it.
  const [groupsDraft, setGroupsDraft] = React.useState(String(settings.max_groups));
  React.useEffect(() => setGroupsDraft(String(settings.max_groups)), [settings.max_groups]);
  const draftGroups = Number(groupsDraft);
  const groupsDraftValid =
    groupsDraft !== "" &&
    Number.isInteger(draftGroups) &&
    draftGroups >= 1 &&
    (maxGroupsCap === undefined || draftGroups <= maxGroupsCap);

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Typography variant="h4" gutterBottom>
        District settings
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2.5 }}>
        These change the answer without changing any of your school data.
      </Typography>

      <Box
        sx={{
          display: "grid",
          gap: 2.5,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(4, minmax(0, 1fr))",
          },
          alignItems: "start",
        }}
      >
        <TextField
          label="District name"
          size="small"
          fullWidth
          value={settings.name}
          onChange={(e) => set("name", e.target.value)}
        />

        <FormControl size="small" fullWidth>
          <InputLabel id="state-label">State</InputLabel>
          <Select
            labelId="state-label"
            label="State"
            value={settings.state_code}
            onChange={(e) => set("state_code", e.target.value)}
          >
            {states.map((s) => (
              <MenuItem key={s.code} value={s.code}>
                {s.name}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>{RATE_TIER_LABEL[rateTier(settings.state_code)]}</FormHelperText>
        </FormControl>

        <FormControl size="small" fullWidth>
          <InputLabel id="evaluate-label">Optimize for</InputLabel>
          <Select
            labelId="evaluate-label"
            label="Optimize for"
            value={settings.evaluate_by}
            onChange={(e) => set("evaluate_by", e.target.value as EvaluateBy)}
          >
            <MenuItem value="reimbursement">Most dollars</MenuItem>
            <MenuItem value="coverage">Most students covered</MenuItem>
          </Select>
          <FormHelperText>These two do not always point to the same grouping.</FormHelperText>
        </FormControl>

        <Box>
          <Typography variant="body2" gutterBottom>
            Eligibility threshold: <strong>{pct(settings.isp_threshold, 0)}</strong>
          </Typography>
          <Slider
            size="small"
            value={settings.isp_threshold}
            min={0.1}
            max={0.6}
            step={0.05}
            marks={[
              { value: 0.25, label: "25%" },
              { value: 0.4, label: "40%" },
            ]}
            valueLabelFormat={(v) => pct(v, 0)}
            valueLabelDisplay="auto"
            onChange={(_, v) => set("isp_threshold", v as number)}
          />
          <FormHelperText sx={{ mt: 0 }}>
            The lowest a group can go and still earn anything. Federal floor is 25%.
          </FormHelperText>
        </Box>

        <TextField
          label="Most groups to allow"
          size="small"
          fullWidth
          type="number"
          value={groupsDraft}
          error={!groupsDraftValid}
          slotProps={{ htmlInput: { min: 1, max: maxGroupsCap, step: 1 } }}
          onChange={(e) => {
            setGroupsDraft(e.target.value);
            const v = Number(e.target.value);
            if (
              e.target.value !== "" &&
              Number.isInteger(v) &&
              v >= 1 &&
              (maxGroupsCap === undefined || v <= maxGroupsCap)
            ) {
              set("max_groups", v);
            }
          }}
          onBlur={() => setGroupsDraft(String(settings.max_groups))}
          helperText={
            !groupsDraftValid
              ? maxGroupsCap === undefined
                ? "Enter a whole number of 1 or more."
                : `Enter a whole number from 1 to ${maxGroupsCap}.`
              : maxGroupsCap === undefined
                ? "The most groups you are willing to administer. Any grouping needing more is set aside."
                : `Up to ${maxGroupsCap}, one per school. Any grouping needing more is set aside.`
          }
        />

        <FormControl size="small" fullWidth>
          <InputLabel id="hhfka-label">Paid lunch equity</InputLabel>
          <Select
            labelId="hhfka-label"
            label="Paid lunch equity"
            value={settings.hhfka_sixty}
            onChange={(e) => set("hhfka_sixty", e.target.value as HhfkaSixty)}
          >
            <MenuItem value="less">Lower band</MenuItem>
            <MenuItem value="more">Middle band</MenuItem>
            <MenuItem value="max">Upper band</MenuItem>
          </Select>
          <FormHelperText>Your district&apos;s band. It shifts every per-meal rate slightly.</FormHelperText>
        </FormControl>

        <Box>
          <FormControlLabel
            control={
              <Switch
                checked={settings.sfa_certified}
                onChange={(e) => set("sfa_certified", e.target.checked)}
              />
            }
            label="School food authority certified"
          />
          <FormHelperText sx={{ mt: -0.5 }}>
            Adds the performance-based 7¢ per lunch your SFA has earned.
          </FormHelperText>
        </Box>

        {showExtendedSearch && (
          <Box>
            <FormControlLabel
              control={
                <Checkbox
                  checked={settings.extended_search && extendedSearchApplies}
                  disabled={!extendedSearchApplies}
                  onChange={(e) => set("extended_search", e.target.checked)}
                />
              }
              label="Extended search"
            />
            <FormHelperText sx={{ mt: -0.5 }}>
              {extendedSearchApplies
                ? "Searches 9 minutes longer for a slightly better grouping. Usually adds a fraction of a percent."
                : `Not needed at ${EXACT_MAX_SCHOOLS} schools or fewer — the best grouping is already guaranteed.`}
            </FormHelperText>
          </Box>
        )}
      </Box>
    </Paper>
  );
}
