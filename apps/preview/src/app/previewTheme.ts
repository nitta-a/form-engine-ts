import { createTheme } from "@mui/material/styles";

export const previewTheme = createTheme({
  palette: {
    primary: { main: "#16776b" },
    background: { default: "#f5f7f8", paper: "#ffffff" },
    text: { primary: "#21342f", secondary: "#61726c" },
    divider: "#e1e8e4"
  },
  typography: {
    fontFamily: '"Inter", "Noto Sans JP", system-ui, -apple-system, sans-serif',
    button: { textTransform: "none", fontWeight: 650 },
    h6: { fontWeight: 650 }
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { minHeight: 40 } } },
    MuiTextField: { defaultProps: { size: "small" } },
    MuiCard: { defaultProps: { variant: "outlined" } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 16 } } }
  }
});
