import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export default function PageHeader({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: string;
  lede: string;
}) {
  return (
    <Box sx={{ mb: 4, maxWidth: 820 }}>
      <Typography variant="overline" color="primary.main">
        {eyebrow}
      </Typography>
      <Typography variant="h1" gutterBottom>
        {title}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ fontSize: "1.1rem", lineHeight: 1.6 }}>
        {lede}
      </Typography>
    </Box>
  );
}
