import type { FormSchema } from "@form-engine-ts/core";
import { MuiFormBuilder, muiDefaultFieldTypeIcon } from "@form-engine-ts/mui";
import { mockAsyncTranslator, mockTranslator } from "@form-engine-ts/translator-mock";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { previewPolicy } from "./previewPolicy";

const muiPreviewTheme = createTheme();

export interface MuiPanelProps {
  readonly schema: FormSchema;
  readonly locale: string;
  readonly builderReadOnly: boolean;
  readonly pagesEnabled: boolean;
  readonly localizationEnabled: boolean;
  readonly conditionsEnabled: boolean;
  readonly onChangeSchema: (schema: FormSchema) => void;
}

export function MuiPanel({
  schema,
  locale,
  builderReadOnly,
  pagesEnabled,
  localizationEnabled,
  conditionsEnabled,
  onChangeSchema
}: MuiPanelProps) {
  return (
    <section className="workspace-card">
      <h2>MUI Mode</h2>
      <ThemeProvider theme={muiPreviewTheme}>
        <MuiFormBuilder
          schema={schema}
          locale={locale}
          translator={mockTranslator}
          translationAdapter={mockAsyncTranslator}
          onChange={onChangeSchema}
          policy={previewPolicy}
          defaultFieldType="textarea"
          readOnly={builderReadOnly}
          features={{ pages: pagesEnabled, localization: localizationEnabled, conditions: conditionsEnabled }}
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
      </ThemeProvider>
    </section>
  );
}
