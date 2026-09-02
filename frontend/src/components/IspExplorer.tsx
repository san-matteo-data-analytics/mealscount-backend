"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Slider from "@mui/material/Slider";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import {
  DEFAULT_ISP_THRESHOLD,
  FULL_FUNDING_ISP,
  ispToFreeRate,
  paidRate,
  pct,
} from "@/lib/cep";

/** Where the three funding zones sit on a 0–100% ISP axis. */
function Zones({ threshold }: { threshold: number }) {
  const zones = [
    { width: threshold, color: "#e0e0e0", label: "No CEP funding" },
    { width: FULL_FUNDING_ISP - threshold, color: "#f7c59f", label: "Partial funding" },
    { width: 1 - FULL_FUNDING_ISP, color: "#8dc3a7", label: "Fully funded — need to spare" },
  ];
  return (
    <Box sx={{ display: "flex", height: 26, borderRadius: 1, overflow: "hidden" }}>
      {zones.map((z) => (
        <Tooltip key={z.label} title={z.label} arrow>
          <Box
            sx={{
              width: `${z.width * 100}%`,
              bgcolor: z.color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <Typography variant="caption" noWrap sx={{ px: 0.5, color: "rgba(0,0,0,0.7)" }}>
              {z.label}
            </Typography>
          </Box>
        </Tooltip>
      ))}
    </Box>
  );
}

function Step({ n, label, value, muted }: { n: number; label: string; value: string; muted?: boolean }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="baseline">
      <Box
        sx={{
          width: 22,
          height: 22,
          flexShrink: 0,
          borderRadius: "50%",
          bgcolor: muted ? "action.disabledBackground" : "primary.main",
          color: muted ? "text.disabled" : "common.white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.72rem",
          fontWeight: 700,
        }}
      >
        {n}
      </Box>
      <Typography variant="body2" sx={{ flexGrow: 1 }} color={muted ? "text.disabled" : "text.primary"}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{ fontFamily: "monospace", fontWeight: 700 }}
        color={muted ? "text.disabled" : "primary.main"}
      >
        {value}
      </Typography>
    </Stack>
  );
}

export default function IspExplorer() {
  const [eligible, setEligible] = React.useState(280);
  const [enrolled, setEnrolled] = React.useState(500);
  const [threshold, setThreshold] = React.useState(DEFAULT_ISP_THRESHOLD);

  const isp = enrolled > 0 ? eligible / enrolled : 0;
  const freeRate = ispToFreeRate(isp, threshold);
  const paid = paidRate(freeRate);
  const belowThreshold = isp < threshold;
  const saturated = isp >= FULL_FUNDING_ISP;
  const wasted = saturated ? isp - FULL_FUNDING_ISP : 0;

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h3" gutterBottom>
        The one number that drives everything
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        A group&apos;s <strong>identified student percentage</strong> decides what share of its meals the
        USDA pays for at the free rate. Move the sliders to see why the grouping matters.
      </Typography>

      <Stack direction={{ xs: "column", md: "row" }} spacing={4}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h5" gutterBottom>
            Identified students: {eligible.toLocaleString()}
          </Typography>
          <Slider
            value={eligible}
            min={0}
            max={enrolled}
            onChange={(_, v) => setEligible(v as number)}
            valueLabelDisplay="auto"
            aria-label="Identified students"
          />
          <Typography variant="h5" gutterBottom sx={{ mt: 1 }}>
            Total enrolled: {enrolled.toLocaleString()}
          </Typography>
          <Slider
            value={enrolled}
            min={50}
            max={2000}
            step={10}
            onChange={(_, v) => {
              const next = v as number;
              setEnrolled(next);
              setEligible((e) => Math.min(e, next));
            }}
            valueLabelDisplay="auto"
            aria-label="Total enrolled"
          />
          <Typography variant="h5" gutterBottom sx={{ mt: 1 }}>
            Eligibility threshold: {pct(threshold, 0)}
          </Typography>
          <Slider
            value={threshold}
            min={0.1}
            max={0.6}
            step={0.05}
            marks={[
              { value: 0.25, label: "25% (today)" },
              { value: 0.4, label: "40% (pre-2023)" },
            ]}
            onChange={(_, v) => setThreshold(v as number)}
            valueLabelFormat={(v) => pct(v, 0)}
            valueLabelDisplay="auto"
            aria-label="Eligibility threshold"
          />
        </Box>

        <Divider orientation="vertical" flexItem sx={{ display: { xs: "none", md: "block" } }} />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack spacing={1.5}>
            <Step n={1} label="Identified students, as a share of enrollment" value={pct(isp, 1)} />
            <Step
              n={2}
              label={
                belowThreshold
                  ? `Below the ${pct(threshold, 0)} threshold, so nothing is paid at the free rate`
                  : "Meals paid at the free rate"
              }
              value={pct(freeRate, 1)}
              muted={belowThreshold}
            />
            <Step n={3} label="The rest, at the much lower paid rate" value={pct(paid, 1)} muted={belowThreshold} />
          </Stack>

          <Box sx={{ mt: 3 }}>
            <Typography variant="overline" color="text.secondary">
              Where this group lands
            </Typography>
            <Box sx={{ position: "relative", mt: 0.5 }}>
              <Zones threshold={threshold} />
              <Box
                sx={{
                  position: "absolute",
                  top: -6,
                  bottom: -6,
                  left: `${Math.min(isp, 1) * 100}%`,
                  width: 3,
                  bgcolor: "text.primary",
                  transform: "translateX(-1.5px)",
                }}
              />
            </Box>
            <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
              <Typography variant="caption" color="text.secondary">0% ISP</Typography>
              <Typography variant="caption" color="text.secondary">100% ISP</Typography>
            </Stack>
          </Box>

          <Box sx={{ mt: 2.5, p: 1.75, borderRadius: 1, bgcolor: "action.hover" }}>
            {belowThreshold ? (
              <Typography variant="body2">
                This group earns <strong>nothing</strong> under CEP. Put it together with a higher-need
                school and it could cross the line — which is the whole reason MealsCount exists.
              </Typography>
            ) : saturated ? (
              <Typography variant="body2">
                Already fully funded. Everything above <strong>62.5%</strong> earns no extra money, so{" "}
                <strong>{pct(wasted, 1)} of need is doing nothing here</strong> — need that could be
                carrying a weaker school if the two were grouped together.
              </Typography>
            ) : (
              <Typography variant="body2">
                Partly funded: {pct(freeRate, 1)} of meals at the free rate, the rest at the much lower
                paid rate. Reaching <strong>62.5%</strong> would make every meal in the group free.
              </Typography>
            )}
          </Box>
        </Box>
      </Stack>
    </Paper>
  );
}
