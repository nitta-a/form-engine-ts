import { mockTranslator } from "@form-engine-ts/translator-mock";
import type { KeyboardEvent, ReactNode } from "react";

export type AppTabId = "builder" | "mui" | "comparison" | "respondent" | "analytics";

export const appTabs: readonly AppTabId[] = ["builder", "mui", "comparison", "respondent", "analytics"];

export interface AppNavigationProps {
  readonly locale: string;
  readonly activeTab: AppTabId;
  readonly onLocaleChange: (locale: string) => void;
  readonly onTabChange: (tab: AppTabId) => void;
  readonly children: ReactNode;
}

export function AppNavigation({ locale, activeTab, onLocaleChange, onTabChange, children }: AppNavigationProps) {
  const translate = (key: string) => mockTranslator.translate(key, locale) ?? key;
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, tab: AppTabId) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const current = appTabs.indexOf(tab);
    const offset = event.key === "ArrowRight" ? 1 : -1;
    const next = appTabs[(current + offset + appTabs.length) % appTabs.length];
    if (next === undefined) return;
    onTabChange(next);
    document.getElementById(`tab-${next}`)?.focus();
  };

  return (
    <>
      <nav className="topbar" aria-label={translate("preview.language")}>
        <span className="brand">
          <span>FORM</span> ENGINE
        </span>
        <div className="locale-switch">
          <span>{translate("preview.language")}</span>
          <button type="button" aria-pressed={locale === "en"} onClick={() => onLocaleChange("en")}>
            EN
          </button>
          <button type="button" aria-pressed={locale === "ja"} onClick={() => onLocaleChange("ja")}>
            日本語
          </button>
        </div>
      </nav>
      <div className="sandbox">
        <div className="tabs" role="tablist" aria-label="Form engine workspace">
          {appTabs.map((tab) => (
            <button
              id={`tab-${tab}`}
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={`panel-${tab}`}
              tabIndex={activeTab === tab ? 0 : -1}
              onClick={() => onTabChange(tab)}
              onKeyDown={(event) => handleTabKeyDown(event, tab)}
            >
              {translate(`preview.${tab}`)}
            </button>
          ))}
        </div>
        {children}
      </div>
    </>
  );
}
