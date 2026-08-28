import { FormProvider } from "@form-engine-ts/react";
import { mockTranslator } from "@form-engine-ts/translator-mock";
import { type KeyboardEvent, useState } from "react";
import { AnalyticsPanel } from "../analytics/AnalyticsPanel";
import { BuilderPanel } from "../builder/BuilderPanel";
import { BuilderPreviewProvider } from "../builder/BuilderPreviewContext";
import { MuiPanel } from "../builder/MuiPanel";
import { RespondentPanel } from "../respondent/RespondentPanel";
import { RespondentPreviewProvider } from "../respondent/RespondentPreviewContext";
import { PreviewWorkspaceProvider, usePreviewWorkspace } from "../workspace/PreviewWorkspaceContext";

type TabId = "builder" | "mui" | "respondent" | "analytics";

const tabs: readonly TabId[] = ["builder", "mui", "respondent", "analytics"];

export default function App() {
  return (
    <PreviewWorkspaceProvider>
      <AppContent />
    </PreviewWorkspaceProvider>
  );
}

function AppContent() {
  const { schema, locale, setLocale, loadError, resetStatus, submit } = usePreviewWorkspace();
  const [activeTab, setActiveTab] = useState<TabId>("builder");
  const t = (key: string) => mockTranslator.translate(key, locale) ?? key;

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, tab: TabId) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const current = tabs.indexOf(tab);
    const offset = event.key === "ArrowRight" ? 1 : -1;
    const next = tabs[(current + offset + tabs.length) % tabs.length];
    if (next === undefined) return;
    setActiveTab(next);
    document.getElementById(`tab-${next}`)?.focus();
  };

  return (
    <main>
      <nav className="topbar" aria-label={t("preview.language")}>
        <span className="brand">
          <span>FORM</span> ENGINE
        </span>
        <div className="locale-switch">
          <span>{t("preview.language")}</span>
          <button type="button" aria-pressed={locale === "en"} onClick={() => setLocale("en")}>
            EN
          </button>
          <button type="button" aria-pressed={locale === "ja"} onClick={() => setLocale("ja")}>
            日本語
          </button>
        </div>
      </nav>
      <div className="sandbox">
        <div className="tabs" role="tablist" aria-label="Form engine workspace">
          {tabs.map((tab) => (
            <button
              id={`tab-${tab}`}
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={`panel-${tab}`}
              tabIndex={activeTab === tab ? 0 : -1}
              onClick={() => setActiveTab(tab)}
              onKeyDown={(event) => handleTabKeyDown(event, tab)}
            >
              {t(`preview.${tab}`)}
            </button>
          ))}
        </div>
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
        <BuilderPreviewProvider>
          <div id="panel-builder" role="tabpanel" aria-labelledby="tab-builder" hidden={activeTab !== "builder"}>
            {activeTab === "builder" ? <BuilderPanel /> : null}
          </div>
          <div id="panel-mui" role="tabpanel" aria-labelledby="tab-mui" hidden={activeTab !== "mui"}>
            {activeTab === "mui" ? <MuiPanel /> : null}
          </div>
        </BuilderPreviewProvider>
        <div id="panel-respondent" role="tabpanel" aria-labelledby="tab-respondent" hidden={activeTab !== "respondent"}>
          <FormProvider schema={schema} locale={locale} translator={mockTranslator} onSubmit={submit} resetOnSuccess>
            <RespondentPreviewProvider>
              {activeTab === "respondent" ? <RespondentPanel /> : null}
            </RespondentPreviewProvider>
          </FormProvider>
        </div>
        <div id="panel-analytics" role="tabpanel" aria-labelledby="tab-analytics" hidden={activeTab !== "analytics"}>
          {activeTab === "analytics" ? <AnalyticsPanel /> : null}
        </div>
      </div>
    </main>
  );
}
