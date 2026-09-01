import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

export default function CodeBlock({ caption, code }: { caption?: string; code: string }) {
  return (
    <Box>
      {caption && (
        <Typography variant="overline" color="text.secondary" display="block" gutterBottom>
          {caption}
        </Typography>
      )}
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          bgcolor: "#1e2422",
          color: "#e6f0ea",
          overflowX: "auto",
          fontFamily: "monospace",
          fontSize: "0.82rem",
          lineHeight: 1.6,
        }}
      >
        <Box component="pre" sx={{ m: 0 }}>
          {code}
        </Box>
      </Paper>
    </Box>
  );
}
