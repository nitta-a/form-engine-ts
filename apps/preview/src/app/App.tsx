import { PreviewWorkspaceProvider } from "../workspace/PreviewWorkspaceContext";
import { AppContent } from "./AppContent";

export default function App() {
  return (
    <PreviewWorkspaceProvider>
      <AppContent />
    </PreviewWorkspaceProvider>
  );
}
