import { useEffect, useState } from "react";
import { usePreviewWorkspace } from "../workspace/PreviewWorkspaceContext";
import { AppNavigation, type AppTabId, appTabs } from "./AppNavigation";
import { AppPanels } from "./AppPanels";

function readActiveTab(): AppTabId {
  const value = new URLSearchParams(window.location.search).get("view");
  return appTabs.find((tab) => tab === value) ?? "content";
}

export function AppContent() {
  const { schema, locale, setLocale, loadError, resetStatus, submit, submissions, storageKind } = usePreviewWorkspace();
  const [activeTab, setActiveTab] = useState(readActiveTab);
  const [visitedTabs, setVisitedTabs] = useState<readonly AppTabId[]>(() => [readActiveTab()]);
  const changeTab = (tab: AppTabId) => {
    const url = new URL(window.location.href);
    if (tab === "content") url.searchParams.delete("view");
    else url.searchParams.set("view", tab);
    if (url.href !== window.location.href) window.history.pushState(null, "", url);
    document.documentElement.scrollTop = 0;
    setActiveTab(tab);
    setVisitedTabs((current) => (current.includes(tab) ? current : [...current, tab]));
  };
  useEffect(() => {
    const onPopState = () => {
      const tab = readActiveTab();
      setActiveTab(tab);
      setVisitedTabs((current) => (current.includes(tab) ? current : [...current, tab]));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  const schemaTitle = schema.translations?.[locale]?.title ?? schema.title;

  return (
    <AppNavigation
      locale={locale}
      activeTab={activeTab}
      onLocaleChange={setLocale}
      onTabChange={changeTab}
      schemaTitle={schemaTitle}
      questionCount={schema.fields.length}
      responseCount={submissions.length}
      storageKind={storageKind}
    >
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
      <AppPanels
        activeTab={activeTab}
        visitedTabs={visitedTabs}
        onTabChange={changeTab}
        schema={schema}
        locale={locale}
        submit={submit}
      />
    </AppNavigation>
  );
}
