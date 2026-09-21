import {
  MuiBuilderNavigator,
  MuiBuilderPreview,
  MuiBuilderValidationSummary,
  type MuiBuilderValidationTarget,
  MuiFormBuilder,
  type MuiFormBuilderValidationState,
  muiDefaultFieldTypeIcon
} from "@form-engine-ts/mui";
import { mockAsyncTranslator, mockTranslator } from "@form-engine-ts/translator-mock";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { useEffect, useState } from "react";
import { usePreviewWorkspace } from "../workspace/PreviewWorkspaceContext";
import { useBuilderPreview } from "./BuilderPreviewContext";
import { previewPolicy } from "./previewPolicy";

const muiPreviewTheme = createTheme();

export function MuiPanel() {
  const { schema, locale, changeSchema } = usePreviewWorkspace();
  const { builderReadOnly, pagesEnabled, localizationEnabled, conditionsEnabled, pageEditorMode } = useBuilderPreview();
  const [activeFieldId, setActiveFieldId] = useState(schema.fields[0]?.id);
  const [selectedPageId, setSelectedPageId] = useState(schema.pages?.[0]?.id);
  const [validationState, setValidationState] = useState<MuiFormBuilderValidationState>();

  useEffect(() => {
    setActiveFieldId((current) =>
      schema.fields.some((field) => field.id === current) ? current : schema.fields[0]?.id
    );
    setSelectedPageId((current) =>
      schema.pages?.some((page) => page.id === current) ? current : schema.pages?.[0]?.id
    );
  }, [schema.fields, schema.pages]);

  const selectField = (fieldId: string) => {
    setActiveFieldId(fieldId);
    const page = schema.pages?.find((candidate) => candidate.questionIds.includes(fieldId));
    if (page !== undefined) setSelectedPageId(page.id);
  };

  const selectPage = (pageId: string) => {
    setSelectedPageId(pageId);
    const fieldId = schema.pages?.find((page) => page.id === pageId)?.questionIds[0];
    if (fieldId !== undefined) setActiveFieldId(fieldId);
  };

  const focusFieldTitle = (fieldId: string) => {
    const focus = () => {
      if (typeof document === "undefined") return;
      document.getElementById(`mui-field-${fieldId}-title`)?.focus();
    };
    if (typeof globalThis.requestAnimationFrame === "function") globalThis.requestAnimationFrame(focus);
    else setTimeout(focus, 0);
  };

  const handleIssueSelect = (_issue: unknown, target: MuiBuilderValidationTarget) => {
    if (target.fieldId !== undefined) focusFieldTitle(target.fieldId);
  };

  return (
    <section className="workspace-card">
      <h2>MUI Mode</h2>
      <ThemeProvider theme={muiPreviewTheme}>
        <div className="mui-builder-workspace">
          <aside className="mui-builder-workspace__navigation">
            <MuiBuilderNavigator
              schema={schema}
              activeFieldId={activeFieldId}
              onActiveFieldChange={selectField}
              selectedPageId={selectedPageId}
              onSelectedPageChange={selectPage}
              dense
            />
            {validationState === undefined ? null : (
              <MuiBuilderValidationSummary
                schema={schema}
                validationState={validationState}
                onFieldSelect={selectField}
                onPageSelect={selectPage}
                onIssueSelect={handleIssueSelect}
              />
            )}
          </aside>
          <section className="mui-builder-workspace__editor" aria-label="MUI Builder editor">
            <MuiFormBuilder
              schema={schema}
              locale={locale}
              translator={mockTranslator}
              translationAdapter={mockAsyncTranslator}
              onChange={changeSchema}
              policy={previewPolicy}
              defaultFieldType="textarea"
              readOnly={builderReadOnly}
              features={{ pages: pagesEnabled, localization: localizationEnabled, conditions: conditionsEnabled }}
              fieldEditorMode="single"
              pageEditorMode={pageEditorMode}
              activeFieldId={activeFieldId}
              onActiveFieldChange={setActiveFieldId}
              selectedPageId={selectedPageId}
              onSelectedPageChange={setSelectedPageId}
              autoFocusActiveField
              contentModeOptions={{ validation: "hidden", onValidationChange: setValidationState }}
              muiOptions={{
                size: "small",
                dense: true,
                inputFullWidth: true,
                buttonFullWidth: false,
                fieldEditorOptions: { description: "hidden" },
                getLocaleLabel: (targetLocale) => ({ ja: "日本語", en: "English" })[targetLocale] ?? targetLocale,
                buttonVariants: { primary: "contained", secondary: "outlined", danger: "outlined" }
              }}
              layoutOptions={{
                sectionOrder: ["basicSettings", "completionMessage", "questions", "addQuestion", "localization"]
              }}
              localizationOptions={{
                collapsible: true,
                defaultExpanded: "when-configured",
                showSummary: true,
                availableLocales: [
                  { value: "ja", label: "日本語" },
                  { value: "en", label: "English" }
                ],
                placement: "beforeQuestions",
                defaultLocaleControl: "readOnly"
              }}
              components={{
                renderFieldTypeIcon: (type) => (
                  <span aria-hidden="true" data-testid={`preview-field-type-icon-${type}`}>
                    {muiDefaultFieldTypeIcon(type)}
                  </span>
                )
              }}
              muiSlotProps={{ card: { sx: { p: 2 } }, accordion: { elevation: 0 } }}
            />
          </section>
          <aside className="mui-builder-workspace__preview">
            <h3>Live respondent preview</h3>
            <MuiBuilderPreview schema={schema} locale={locale} translator={mockTranslator} policy={previewPolicy} />
          </aside>
        </div>
      </ThemeProvider>
    </section>
  );
}
