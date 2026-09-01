"use client";

import Box from "@mui/material/Box";
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
import { pct } from "@/lib/cep";
import type { DistrictSettings, EvaluateBy, HhfkaSixty } from "@/lib/types";

const STATES = [
  { code: "ca", label: "California" },
  { code: "ny", label: "New York" },
  { code: "tx", label: "Texas" },
  { code: "ak", label: "Alaska (higher rates)" },
  { code: "hi", label: "Hawaii (higher rates)" },
];

export default function SettingsPanel({
  settings,
  onChange,
}: {
  settings: DistrictSettings;
  onChange: (s: DistrictSettings) => void;
}) {
  const set = <K extends keyof DistrictSettings>(key: K, value: DistrictSettings[K]) =>
    onChange({ ...settings, [key]: value });

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Typography variant="h4" gutterBottom>
        District settings
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2.5 }}>
        The knobs that change the answer without changing the data.
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
            {STATES.map((s) => (
              <MenuItem key={s.code} value={s.code}>
                {s.label}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>Selects the USDA per-meal rate table.</FormHelperText>
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
          <FormHelperText>These two objectives do not always agree.</FormHelperText>
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
          <FormHelperText sx={{ mt: 0 }}>Federal floor is 25% as of October 2023.</FormHelperText>
        </Box>

        <Box>
          <Typography variant="body2" gutterBottom>
            Maximum groups: <strong>{settings.max_groups}</strong>
          </Typography>
          <Slider
            size="small"
            value={settings.max_groups}
            min={1}
            max={20}
            step={1}
            valueLabelDisplay="auto"
            onChange={(_, v) => set("max_groups", v as number)}
          />
          <FormHelperText sx={{ mt: 0 }}>
            Strategies exceeding this are disqualified — more groups means more to administer.
          </FormHelperText>
        </Box>

        <FormControl size="small" fullWidth>
          <InputLabel id="hhfka-label">HHFKA §60 band</InputLabel>
          <Select
            labelId="hhfka-label"
            label="HHFKA §60 band"
            value={settings.hhfka_sixty}
            onChange={(e) => set("hhfka_sixty", e.target.value as HhfkaSixty)}
          >
            <MenuItem value="less">less</MenuItem>
            <MenuItem value="more">more</MenuItem>
            <MenuItem value="max">max</MenuItem>
          </Select>
          <FormHelperText>Paid lunch equity band; shifts every per-meal rate slightly.</FormHelperText>
        </FormControl>

        <Box>
          <FormControlLabel
            control={
              <Switch
                checked={settings.sfa_certified}
                onChange={(e) => set("sfa_certified", e.target.checked)}
              />
            }
            label="SFA certified"
          />
          <FormHelperText sx={{ mt: -0.5 }}>Adds the performance-based 7¢ per lunch.</FormHelperText>
        </Box>
      </Box>
    </Paper>
  );
}
