import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { FieldDoc } from "@/lib/content";

export default function FieldTable({ fields }: { fields: FieldDoc[] }) {
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: "24%" }}>Field</TableCell>
            <TableCell sx={{ width: "18%" }}>Type</TableCell>
            <TableCell>What it means</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {fields.map((f) => (
            <TableRow key={f.name} hover>
              <TableCell sx={{ verticalAlign: "top" }}>
                <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75 }}>
                  <Typography component="code" sx={{ fontFamily: "monospace", fontSize: "0.85rem", fontWeight: 600 }}>
                    {f.name}
                  </Typography>
                  {f.required && <Chip label="required" size="small" color="primary" variant="outlined" />}
                </Box>
              </TableCell>
              <TableCell sx={{ verticalAlign: "top" }}>
                <Typography component="code" sx={{ fontFamily: "monospace", fontSize: "0.8rem", color: "text.secondary" }}>
                  {f.type}
                </Typography>
              </TableCell>
              <TableCell sx={{ verticalAlign: "top" }}>
                <Typography variant="body2">{f.meaning}</Typography>
                {f.gotcha && (
                  <Alert severity="warning" variant="outlined" sx={{ mt: 1, py: 0 }}>
                    <Typography variant="body2">{f.gotcha}</Typography>
                  </Alert>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
