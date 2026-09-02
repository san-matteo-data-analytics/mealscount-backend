"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import MenuIcon from "@mui/icons-material/Menu";
import SchemaIcon from "@mui/icons-material/Schema";
import InputIcon from "@mui/icons-material/Input";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import AltRouteIcon from "@mui/icons-material/AltRoute";
import RestaurantIcon from "@mui/icons-material/Restaurant";

/** The tool itself. */
const PRIMARY = {
  href: "/",
  label: "Optimizer",
  icon: <PlayArrowIcon />,
  hint: "Upload your schools and run it",
};

/** Background reading. Deliberately subordinate to the optimizer. */
const REFERENCE = [
  { href: "/reference/how-it-works", label: "How it works", icon: <SchemaIcon />, hint: "Why grouping pays" },
  { href: "/reference/inputs", label: "What you provide", icon: <InputIcon />, hint: "Every column explained" },
  { href: "/reference/strategies", label: "How groupings are chosen", icon: <AltRouteIcon />, hint: "Every approach, in plain terms" },
];

const DRAWER_WIDTH = 268;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  // Responsive layout is done entirely in CSS. A useMediaQuery branch here would
  // render the mobile tree on the server and the desktop tree on the client,
  // which is a hydration mismatch.
  const item = (
    entry: { href: string; label: string; icon: React.ReactNode; hint: string },
    dense = false,
  ) => {
    const selected = pathname === entry.href;
    return (
      <ListItemButton
        key={entry.href}
        component={Link}
        href={entry.href}
        selected={selected}
        onClick={() => setOpen(false)}
        sx={{
          mx: 1,
          borderRadius: 2,
          py: dense ? 0.5 : 1.25,
          "&.Mui-selected": { bgcolor: "primary.main", color: "common.white" },
          "&.Mui-selected:hover": { bgcolor: "primary.dark" },
          "&.Mui-selected .MuiListItemIcon-root": { color: "common.white" },
        }}
      >
        <ListItemIcon sx={{ minWidth: 40, color: dense ? "text.secondary" : undefined }}>
          {entry.icon}
        </ListItemIcon>
        <ListItemText
          primary={entry.label}
          secondary={entry.hint}
          slotProps={{
            primary: { fontWeight: dense ? 500 : 700, fontSize: dense ? "0.9rem" : "1rem" },
            secondary: {
              sx: {
                fontSize: "0.72rem",
                color: selected ? "rgba(255,255,255,0.75)" : "text.secondary",
              },
            },
          }}
        />
      </ListItemButton>
    );
  };

  const nav = (
    <Box sx={{ py: 2 }}>
      <List disablePadding>{item(PRIMARY)}</List>

      <Divider sx={{ mt: 2.5, mb: 1 }} />
      <Typography variant="overline" color="text.secondary" sx={{ px: 3, fontSize: "0.68rem" }}>
        Reference
      </Typography>
      <List disablePadding>{REFERENCE.map((r) => item(r, true))}</List>

      <Divider sx={{ my: 2 }} />
      <Box sx={{ px: 3 }}>
        <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
          MealsCount helps school districts group their schools for the Community Eligibility
          Provision so more students eat free.
        </Typography>
        <Button
          size="small"
          href="https://www.fns.usda.gov/school-meals/community-eligibility-provision"
          target="_blank"
          rel="noopener"
          sx={{ px: 0 }}
        >
          USDA CEP reference
        </Button>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{ zIndex: (t) => t.zIndex.drawer + 1, borderBottom: 1, borderColor: "divider" }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
            sx={{ mr: 1, display: { md: "none" } }}
          >
            <MenuIcon />
          </IconButton>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ flexGrow: 1 }}>
            <RestaurantIcon color="primary" />
            <Typography variant="h5" component="div" sx={{ fontWeight: 800 }}>
              MealsCount
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
              CEP grouping for school districts
            </Typography>
          </Stack>
          {pathname !== "/" && (
            <Button component={Link} href="/" variant="contained" startIcon={<PlayArrowIcon />}>
              Optimizer
            </Button>
          )}
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={open}
          onClose={() => setOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box" },
          }}
        >
          {nav}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": {
              width: DRAWER_WIDTH,
              boxSizing: "border-box",
              borderRight: 1,
              borderColor: "divider",
            },
          }}
        >
          <Toolbar />
          {nav}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, bgcolor: "background.default" }}>
        <Toolbar />
        <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
          {children}
        </Container>
      </Box>
    </Box>
  );
}
