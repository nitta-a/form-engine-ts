import { useState } from "react";
import { usePreviewWorkspace } from "../workspace/PreviewWorkspaceContext";
import { AppNavigation, type AppTabId } from "./AppNavigation";
import { AppPanels } from "./AppPanels";

export function AppContent() {
  const { schema, locale, setLocale, loadError, resetStatus, submit } = usePreviewWorkspace();
  const [activeTab, setActiveTab] = useState<AppTabId>("builder");

  return (
    <main>
      <AppNavigation locale={locale} activeTab={activeTab} onLocaleChange={setLocale} onTabChange={setActiveTab}>
        {loadError === null ? null : (
          <p className="workspace-error" role="alert">
            {loadError}
          </p>
        )}
        {resetStatus === null ? null : (
          <p
            className={`reset-status reset-status--${resetStatus.kind}`}
            role={resetStatus.kind === "error" ? "alert" : "status"}
          >
            {resetStatus.message}
          </p>
        )}
        <AppPanels activeTab={activeTab} schema={schema} locale={locale} submit={submit} />
      </AppNavigation>
    </main>
  );
}
