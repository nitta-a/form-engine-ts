import type { FormSchema, FormValues } from "@form-engine-ts/core";
import { FormProvider, type SubmitContext } from "@form-engine-ts/react";
import { mockTranslator } from "@form-engine-ts/translator-mock";
import { useEffect, useState } from "react";
import { AnalyticsPanel } from "../analytics/AnalyticsPanel";
import { BuilderPanel } from "../builder/BuilderPanel";
import { BuilderPreviewProvider } from "../builder/BuilderPreviewContext";
import { MuiPanel } from "../builder/MuiPanel";
import { TranslationComparisonPanel } from "../comparison/TranslationComparisonPanel";
import { ContentLibrary } from "../content/ContentLibrary";
import { RespondentPanel } from "../respondent/RespondentPanel";
import { RespondentPreviewProvider } from "../respondent/RespondentPreviewContext";
import type { AppTabId } from "./AppNavigation";

export interface AppPanelsProps {
  readonly activeTab: AppTabId;
  readonly visitedTabs: readonly AppTabId[];
  readonly onTabChange: (tab: AppTabId) => void;
  readonly schema: FormSchema;
  readonly locale: string;
  readonly submit: (values: FormValues, context: SubmitContext) => Promise<void>;
}

export function AppPanels({ activeTab, visitedTabs, onTabChange, schema, locale, submit }: AppPanelsProps) {
  const schemaKey = `${schema.id}:${schema.version}`;
  const [previewedSchemaKey, setPreviewedSchemaKey] = useState<string | null>(
    activeTab === "respondent" ? schemaKey : null
  );
  useEffect(() => {
    if (activeTab === "respondent") setPreviewedSchemaKey(schemaKey);
  }, [activeTab, schemaKey]);
  return (
    <>
      <div id="panel-content" role="tabpanel" aria-labelledby="tab-content" hidden={activeTab !== "content"}>
        {visitedTabs.includes("content") ? (
          <ContentLibrary onOpenWorkspace={() => onTabChange("mui")} active={activeTab === "content"} />
        ) : null}
      </div>
      <BuilderPreviewProvider>
        <div id="panel-builder" role="tabpanel" aria-labelledby="tab-builder" hidden={activeTab !== "builder"}>
          {visitedTabs.includes("builder") ? (
            <BuilderPanel key={`${schema.id}:${schema.version}`} active={activeTab === "builder"} />
          ) : null}
        </div>
        <div id="panel-mui" role="tabpanel" aria-labelledby="tab-mui" hidden={activeTab !== "mui"}>
          {visitedTabs.includes("mui") ? (
            <MuiPanel key={`${schema.id}:${schema.version}`} active={activeTab === "mui"} />
          ) : null}
        </div>
        <div id="panel-comparison" role="tabpanel" aria-labelledby="tab-comparison" hidden={activeTab !== "comparison"}>
          {activeTab === "comparison" ? <TranslationComparisonPanel /> : null}
        </div>
      </BuilderPreviewProvider>
      <div id="panel-respondent" role="tabpanel" aria-labelledby="tab-respondent" hidden={activeTab !== "respondent"}>
        <FormProvider
          key={`${schema.id}:${schema.version}`}
          schema={schema}
          locale={locale}
          translator={mockTranslator}
          onSubmit={submit}
          resetOnSuccess
        >
          <RespondentPreviewProvider>
            {activeTab === "respondent" || previewedSchemaKey === schemaKey ? <RespondentPanel /> : null}
          </RespondentPreviewProvider>
        </FormProvider>
      </div>
      <div id="panel-analytics" role="tabpanel" aria-labelledby="tab-analytics" hidden={activeTab !== "analytics"}>
        {visitedTabs.includes("analytics") ? <AnalyticsPanel key={`${schema.id}:${schema.version}`} /> : null}
      </div>
    </>
  );
}
