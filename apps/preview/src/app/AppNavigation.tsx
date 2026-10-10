import { mockTranslator } from "@form-engine-ts/translator-mock";
import AnalyticsOutlinedIcon from "@mui/icons-material/AnalyticsOutlined";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import CodeRoundedIcon from "@mui/icons-material/CodeRounded";
import EditNoteRoundedIcon from "@mui/icons-material/EditNoteRounded";
import LanguageRoundedIcon from "@mui/icons-material/LanguageRounded";
import ViewAgendaOutlinedIcon from "@mui/icons-material/ViewAgendaOutlined";
import type { KeyboardEvent, ReactNode } from "react";

export type AppTabId = "content" | "builder" | "mui" | "comparison" | "respondent" | "analytics";

export const appTabs: readonly AppTabId[] = ["content", "mui", "respondent", "analytics", "builder", "comparison"];

const tabIcons = {
  content: ViewAgendaOutlinedIcon,
  mui: EditNoteRoundedIcon,
  respondent: ArticleOutlinedIcon,
  analytics: AnalyticsOutlinedIcon,
  builder: CodeRoundedIcon,
  comparison: LanguageRoundedIcon
};

export interface AppNavigationProps {
  readonly locale: string;
  readonly activeTab: AppTabId;
  readonly onLocaleChange: (locale: string) => void;
  readonly onTabChange: (tab: AppTabId) => void;
  readonly children: ReactNode;
  readonly schemaTitle: string;
  readonly questionCount: number;
  readonly responseCount: number;
  readonly storageKind: "memory" | "local";
}

export function AppNavigation(props: AppNavigationProps) {
  const {
    locale,
    activeTab,
    onLocaleChange,
    onTabChange,
    children,
    schemaTitle,
    questionCount,
    responseCount,
    storageKind
  } = props;
  const ja = locale.startsWith("ja");
  const translate = (key: string) => mockTranslator.translate(key, locale) ?? key;
  const labels: Record<AppTabId, string> = {
    content: ja ? "フォーム一覧" : "Surveys",
    mui: ja ? "アンケートを編集" : "Survey editor",
    respondent: ja ? "回答画面を確認" : "Answer preview",
    analytics: ja ? "回答・分析" : "Responses & insights",
    builder: ja ? "詳細エディター" : "Advanced editor",
    comparison: ja ? "翻訳を比較" : "Translation comparison"
  };
  const descriptions: Record<AppTabId, string> = {
    content: ja ? "一覧・テンプレート" : "Library & templates",
    mui: ja ? "質問・ページ・条件" : "Questions & logic",
    respondent: ja ? "回答者の体験" : "The customer experience",
    analytics: ja ? "集計・回答一覧・CSV" : "Results, inbox & CSV",
    builder: ja ? "Core・UIの検証" : "Core & UI examples",
    comparison: ja ? "多言語の品質確認" : "Localization review"
  };
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, tab: AppTabId) => {
    const current = appTabs.indexOf(tab);
    let index: number;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") index = (current + 1) % appTabs.length;
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft")
      index = (current - 1 + appTabs.length) % appTabs.length;
    else if (event.key === "Home") index = 0;
    else if (event.key === "End") index = appTabs.length - 1;
    else return;
    event.preventDefault();
    const next = appTabs[index];
    if (next === undefined) return;
    onTabChange(next);
    document.getElementById(`tab-${next}`)?.focus();
  };

  return (
    <div className="studio-layout">
      <a className="skip-link" href="#workspace-main">
        {ja ? "メインへ移動" : "Skip to workspace"}
      </a>
      <aside className="studio-sidebar" aria-label={ja ? "アンケート管理" : "Survey workspace"}>
        <div className="studio-brand">
          <span className="brand-mark" aria-hidden="true">
            <ViewAgendaOutlinedIcon />
          </span>
          <div>
            <strong>Form Engine</strong>
            <span>SURVEY STUDIO</span>
          </div>
        </div>
        <div className="workspace-switcher">
          <span className="workspace-avatar" aria-hidden="true">
            C
          </span>
          <div>
            <strong>{ja ? "顧客インサイト" : "Customer insights"}</strong>
            <span>{ja ? "デモワークスペース" : "Demo workspace"}</span>
          </div>
        </div>
        <div
          className="studio-tabs"
          role="tablist"
          aria-orientation="vertical"
          aria-label={ja ? "ワークスペース" : "Form engine workspace"}
        >
          {appTabs.map((tab) => {
            const Icon = tabIcons[tab];
            return (
              <div key={tab}>
                {tab === "content" || tab === "builder" ? (
                  <p className="nav-group-label">
                    {tab === "content"
                      ? ja
                        ? "アンケート管理"
                        : "WORKSPACE"
                      : ja
                        ? "開発者ツール"
                        : "DEVELOPER TOOLS"}
                  </p>
                ) : null}
                <button
                  id={`tab-${tab}`}
                  type="button"
                  role="tab"
                  aria-label={labels[tab]}
                  aria-selected={activeTab === tab}
                  aria-controls={`panel-${tab}`}
                  tabIndex={activeTab === tab ? 0 : -1}
                  onClick={() => onTabChange(tab)}
                  onKeyDown={(event) => handleTabKeyDown(event, tab)}
                >
                  <Icon aria-hidden="true" />
                  <span>
                    <strong>{labels[tab]}</strong>
                    <small>{descriptions[tab]}</small>
                  </span>
                </button>
              </div>
            );
          })}
        </div>
        <div className="sidebar-note">
          <span className="storage-indicator" aria-hidden="true" />
          <strong>
            {storageKind === "local"
              ? ja
                ? "このブラウザに保存"
                : "Saved in this browser"
              : ja
                ? "セッション内に保存"
                : "Session storage"}
          </strong>
          <p>
            {storageKind === "local"
              ? ja
                ? "共有端末では回答の取り扱いにご注意ください。"
                : "Take care with responses on shared devices."
              : ja
                ? "再読み込みでデータは消えます。一覧の保存設定から変更できます。"
                : "Data clears on reload. Change storage in the survey library."}
          </p>
        </div>
      </aside>
      <div className="studio-main">
        <header className="studio-topbar">
          <div className="studio-breadcrumb">
            <span>{ja ? "顧客インサイト" : "Customer insights"}</span>
            <span aria-hidden="true">/</span>
            <h1>{labels[activeTab]}</h1>
          </div>
          <fieldset className="locale-switch" aria-label={translate("preview.language")}>
            <button type="button" aria-pressed={locale === "en"} onClick={() => onLocaleChange("en")}>
              EN
            </button>
            <button type="button" aria-pressed={locale === "ja"} onClick={() => onLocaleChange("ja")}>
              日本語
            </button>
          </fieldset>
        </header>
        <main className="studio-workspace" id="workspace-main" tabIndex={-1}>
          {activeTab === "content" ? null : (
            <section className="survey-context" aria-label={ja ? "選択中のアンケート" : "Current survey"}>
              <div>
                <span className="eyebrow">{ja ? "選択中のアンケート" : "CURRENT SURVEY"}</span>
                <p>{schemaTitle}</p>
                <small>
                  {questionCount} {ja ? "問" : "questions"} · {responseCount} {ja ? "件の回答" : "responses"}
                </small>
              </div>
              <div className="workflow-actions">
                {activeTab === "mui" || activeTab === "builder" ? (
                  <button className="primary-action" type="button" onClick={() => onTabChange("respondent")}>
                    {ja ? "回答画面を確認 →" : "Preview survey →"}
                  </button>
                ) : null}
                {activeTab === "respondent" ? (
                  <button className="primary-action" type="button" onClick={() => onTabChange("analytics")}>
                    {ja ? "回答・分析へ →" : "View responses →"}
                  </button>
                ) : null}
                {activeTab === "analytics" ? (
                  <button className="secondary-action" type="button" onClick={() => onTabChange("mui")}>
                    {ja ? "アンケートを編集" : "Edit survey"}
                  </button>
                ) : null}
              </div>
            </section>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
