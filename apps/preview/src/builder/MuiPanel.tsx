import { type FormSchema, validateFormSchema } from "@form-engine-ts/core";
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
import { ThemeProvider } from "@mui/material/styles";
import { useEffect, useState } from "react";
import { previewTheme } from "../app/previewTheme";
import { usePreviewWorkspace } from "../workspace/PreviewWorkspaceContext";
import { useBuilderPreview } from "./BuilderPreviewContext";
import { previewCreationPolicy } from "./previewPolicy";
import { SurveyCreationAssistant } from "./SurveyCreationAssistant";
import { SurveySchemaTools } from "./SurveySchemaTools";

interface MuiPanelProps {
  readonly active?: boolean;
}

export function MuiPanel({ active = true }: MuiPanelProps) {
  const { schema: savedSchema, locale, changeSchema, openSchema, workspaceReady } = usePreviewWorkspace();
  const [schema, setSchema] = useState(savedSchema);
  const previewValid = validateFormSchema(schema, { policy: previewCreationPolicy }).valid;
  const japanese = locale.startsWith("ja");
  const { builderReadOnly, pagesEnabled, localizationEnabled, conditionsEnabled, pageEditorMode } = useBuilderPreview();
  const [activeFieldId, setActiveFieldId] = useState(schema.fields[0]?.id);
  const [focusActiveField, setFocusActiveField] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState(schema.pages?.[0]?.id);
  const [validationState, setValidationState] = useState<MuiFormBuilderValidationState>();

  useEffect(() => setSchema(savedSchema), [savedSchema]);

  const updateSchema = (nextSchema: FormSchema) => {
    setSchema(nextSchema);
    if (validateFormSchema(nextSchema).valid) changeSchema(nextSchema);
  };

  useEffect(() => {
    setActiveFieldId((current) =>
      schema.fields.some((field) => field.id === current) ? current : schema.fields[0]?.id
    );
    setSelectedPageId((current) =>
      schema.pages?.some((page) => page.id === current) ? current : schema.pages?.[0]?.id
    );
  }, [schema.fields, schema.pages]);

  const selectField = (fieldId: string | undefined) => {
    setFocusActiveField(fieldId !== undefined);
    setActiveFieldId(fieldId);
    if (fieldId === undefined) return;
    const page = schema.pages?.find((candidate) => candidate.questionIds.includes(fieldId));
    if (page !== undefined) setSelectedPageId(page.id);
  };

  const selectPage = (pageId: string) => {
    setFocusActiveField(true);
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

  if (!active) return null;

  return (
    <section className="workspace-card survey-editor-card">
      <header className="panel-heading">
        <div>
          <p className="eyebrow">{japanese ? "01 / アンケート作成" : "01 / Create your survey"}</p>
          <h2>{japanese ? "顧客の声を集める質問をつくる" : "Build a survey that listens to your customers"}</h2>
          <p>
            {japanese
              ? "左で質問を選び、中央で編集し、右で回答時の見え方を確認できます。"
              : "Choose a question on the left, edit in the middle, and check the respondent preview on the right."}
          </p>
        </div>
        <SurveyCreationAssistant
          locale={locale}
          disabled={!workspaceReady || builderReadOnly}
          onComplete={openSchema}
        />
      </header>
      <fieldset
        className="survey-editor-summary"
        aria-label={japanese ? "アンケートの構成" : "Questionnaire structure"}
      >
        <span>{japanese ? "編集中" : "Editing"}</span>
        <span>
          {schema.fields.length} {japanese ? "問" : "questions"}
        </span>
        <span>
          {schema.fields.filter((field) => field.required).length} {japanese ? "問が必須" : "required"}
        </span>
        <span>
          {schema.pages?.length || 1} {japanese ? "ページ" : "pages"}
        </span>
        <span>
          {schema.supportedLocales?.length || 1} {japanese ? "言語" : "languages"}
        </span>
      </fieldset>
      {previewValid ? null : (
        <p className="workspace-error" role="status">
          {japanese
            ? "編集中のエラーを修正してください。無効な内容は保存されず、回答画面の確認には最後の有効なアンケートを使用します。"
            : "Fix the draft errors to continue. Invalid changes are not saved; Answer preview uses the last valid questionnaire."}
        </p>
      )}
      <ThemeProvider theme={previewTheme}>
        <div className="mui-builder-workspace">
          <aside className="mui-builder-workspace__navigation">
            <h3>{japanese ? "質問一覧" : "Question outline"}</h3>
            <MuiBuilderNavigator
              schema={schema}
              ariaLabel={japanese ? "アンケートの構成" : "Form structure"}
              pageLabel={japanese ? "ページ" : "Page"}
              questionsLabel={japanese ? "質問" : "Questions"}
              expandLabel={japanese ? "展開" : "Expand"}
              collapseLabel={japanese ? "折りたたむ" : "Collapse"}
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
                title={japanese ? "修正が必要な項目" : "Problems to fix"}
                actionLabel={japanese ? "修正" : "Fix"}
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
              onChange={updateSchema}
              policy={previewCreationPolicy}
              defaultFieldType="textarea"
              readOnly={builderReadOnly}
              features={{ pages: pagesEnabled, localization: localizationEnabled, conditions: conditionsEnabled }}
              fieldEditorMode="single"
              pageEditorMode={pageEditorMode}
              activeFieldId={activeFieldId}
              onActiveFieldChange={selectField}
              selectedPageId={selectedPageId}
              onSelectedPageChange={setSelectedPageId}
              autoFocusActiveField={focusActiveField}
              contentModeOptions={{ validation: "hidden", onValidationChange: setValidationState }}
              muiOptions={{
                size: "small",
                dense: true,
                inputFullWidth: true,
                buttonFullWidth: false,
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
                emptyStateMessage: japanese
                  ? "翻訳先の言語がありません。対応言語を追加して翻訳を作成してください。"
                  : "There are no translation languages yet. Add a supported language to create translations.",
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
            <h3>{japanese ? "回答画面プレビュー" : "Live respondent preview"}</h3>
            <p className="preview-notice">
              {japanese
                ? "編集中の内容を表示します。ここでの回答は保存されません。"
                : "Preview the current draft. Answers entered here are not saved."}
            </p>
            {previewValid ? (
              <MuiBuilderPreview
                schema={schema}
                locale={locale}
                translator={mockTranslator}
                policy={previewCreationPolicy}
              />
            ) : (
              <p className="preview-notice">
                {japanese
                  ? "エラーを修正するとプレビューを再開します。"
                  : "The live preview will resume when the draft is valid."}
              </p>
            )}
            <SurveySchemaTools
              schema={schema}
              locale={locale}
              disabled={!workspaceReady || builderReadOnly}
              onChange={openSchema}
            />
          </aside>
        </div>
      </ThemeProvider>
    </section>
  );
}
