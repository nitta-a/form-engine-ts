import { MuiFormBuilder, muiDefaultFieldTypeIcon } from "@form-engine-ts/mui";
import { mockAsyncTranslator, mockTranslator } from "@form-engine-ts/translator-mock";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { usePreviewWorkspace } from "../workspace/PreviewWorkspaceContext";
import { useBuilderPreview } from "./BuilderPreviewContext";
import { previewPolicy } from "./previewPolicy";

const muiPreviewTheme = createTheme();

export function MuiPanel() {
  const { schema, locale, changeSchema } = usePreviewWorkspace();
  const { builderReadOnly, pagesEnabled, localizationEnabled, conditionsEnabled } = useBuilderPreview();
  return (
    <section className="workspace-card">
      <h2>MUI Mode</h2>
      <ThemeProvider theme={muiPreviewTheme}>
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
