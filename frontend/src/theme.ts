"use client";

import { createTheme } from "@mui/material/styles";

// Greens echo the existing mealscount.com palette; the amber/red accents are
// reserved for "below threshold" states so eligibility reads at a glance.
const theme = createTheme({
  cssVariables: true,
  palette: {
    primary: { main: "#2e7d5b", light: "#5aa583", dark: "#1b5439" },
    secondary: { main: "#f2994a" },
    success: { main: "#2e7d5b" },
    warning: { main: "#ed6c02" },
    background: { default: "#f6f8f7", paper: "#ffffff" },
  },
  typography: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    h1: { fontSize: "2.5rem", fontWeight: 700, letterSpacing: "-0.02em" },
    h2: { fontSize: "1.9rem", fontWeight: 700, letterSpacing: "-0.01em" },
    h3: { fontSize: "1.4rem", fontWeight: 700 },
    h4: { fontSize: "1.15rem", fontWeight: 600 },
    h5: { fontSize: "1rem", fontWeight: 600 },
    overline: { letterSpacing: "0.12em", fontWeight: 700 },
  },
  shape: { borderRadius: 10 },
  components: {
    // Every MUI input injects its own copy of two autofill keyframes. Emotion
    // adds a <style> tag per copy, and each insert slows as <head> fills, so a
    // 793-school table (six inputs a row) took minutes just to appear. Turn the
    // per-input copy off and declare the keyframes once, here, instead. The
    // animation itself is kept on each input: MUI listens for it to notice
    // browser autofill and shrink the field's label.
    MuiCssBaseline: {
      styleOverrides: {
        "@keyframes mui-auto-fill": { from: { animationName: "mui-auto-fill" } },
        "@keyframes mui-auto-fill-cancel": { from: { animationName: "mui-auto-fill-cancel" } },
      },
    },
    MuiInputBase: {
      defaultProps: { disableInjectingGlobalStyles: true },
      styleOverrides: {
        input: {
          animationName: "mui-auto-fill-cancel",
          animationDuration: "10ms",
          "&:-webkit-autofill": { animationDuration: "5000s", animationName: "mui-auto-fill" },
        },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiTableCell: { styleOverrides: { head: { fontWeight: 700, whiteSpace: "nowrap" } } },
    MuiButton: { defaultProps: { disableElevation: true } },
  },
});

export default theme;
