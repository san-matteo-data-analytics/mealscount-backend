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
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiTableCell: { styleOverrides: { head: { fontWeight: 700, whiteSpace: "nowrap" } } },
    MuiButton: { defaultProps: { disableElevation: true } },
  },
});

export default theme;
