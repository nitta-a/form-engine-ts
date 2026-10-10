import { ThemeProvider } from "@mui/material/styles";
import { PreviewWorkspaceProvider } from "../workspace/PreviewWorkspaceContext";
import { AppContent } from "./AppContent";
import { previewTheme } from "./previewTheme";

export default function App() {
  return (
    <ThemeProvider theme={previewTheme}>
      <PreviewWorkspaceProvider>
        <AppContent />
      </PreviewWorkspaceProvider>
    </ThemeProvider>
  );
}
