import type { FormSchema, FormValues } from "@form-engine-ts/core";
import { FormProvider, type SubmitContext } from "@form-engine-ts/react";
import { mockTranslator } from "@form-engine-ts/translator-mock";
import { AnalyticsPanel } from "../analytics/AnalyticsPanel";
import { BuilderPanel } from "../builder/BuilderPanel";
import { BuilderPreviewProvider } from "../builder/BuilderPreviewContext";
import { MuiPanel } from "../builder/MuiPanel";
import { TranslationComparisonPanel } from "../comparison/TranslationComparisonPanel";
import { RespondentPanel } from "../respondent/RespondentPanel";
import { RespondentPreviewProvider } from "../respondent/RespondentPreviewContext";
import type { AppTabId } from "./AppNavigation";

export interface AppPanelsProps {
  readonly activeTab: AppTabId;
  readonly schema: FormSchema;
  readonly locale: string;
  readonly submit: (values: FormValues, context: SubmitContext) => Promise<void>;
}

export function AppPanels({ activeTab, schema, locale, submit }: AppPanelsProps) {
  return (
    <>
      <BuilderPreviewProvider>
        <div id="panel-builder" role="tabpanel" aria-labelledby="tab-builder" hidden={activeTab !== "builder"}>
          {activeTab === "builder" ? <BuilderPanel /> : null}
        </div>
        <div id="panel-mui" role="tabpanel" aria-labelledby="tab-mui" hidden={activeTab !== "mui"}>
          {activeTab === "mui" ? <MuiPanel /> : null}
        </div>
        <div id="panel-comparison" role="tabpanel" aria-labelledby="tab-comparison" hidden={activeTab !== "comparison"}>
          {activeTab === "comparison" ? <TranslationComparisonPanel /> : null}
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
    </>
  );
}
