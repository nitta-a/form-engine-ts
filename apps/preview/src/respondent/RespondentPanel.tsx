import { getFormContentMode } from "@form-engine-ts/core";
import { MuiChoiceGroupSlot } from "@form-engine-ts/mui";
import { FormRenderer, type FormRendererSlots, useForm } from "@form-engine-ts/react";
import { mockTranslator } from "@form-engine-ts/translator-mock";
import { ThemeProvider } from "@mui/material/styles";
import { previewTheme } from "../app/previewTheme";
import { usePreviewWorkspace } from "../workspace/PreviewWorkspaceContext";
import { ResetResponsesControl } from "./ResetResponsesControl";
import { useRespondentPreview } from "./RespondentPreviewContext";
import { StorageSwitch } from "./StorageSwitch";

export type { ResetResponsesControlProps } from "./ResetResponsesControl";
export { ResetResponsesControl } from "./ResetResponsesControl";
export type { ChoiceFieldLayout } from "./RespondentPreviewContext";

const englishLabels = {
  eyebrow: "CUSTOMER VIEW",
  title: "Try the customer experience",
  intro: "Complete the survey as a customer would. Your saved response will appear in Analytics.",
  questions: "questions",
  minutes: "min to complete",
  privacy: "This demo keeps your response in the selected browser storage. No external survey service is connected.",
  technical: "Demo settings & submission testing",
  technicalNote: "Storage, appearance and simulated failures let you check the survey before sharing it.",
  lifecycle: "v2 Renderer lifecycle & slots",
  slots: "Use custom UI slots",
  cancel: "Cancel next submission in beforeSubmit",
  replace: "Replace form after successful submission",
  server: "Simulate server validation error on next submit",
  appearance: "Choice field appearance",
  flat: "Flat choices",
  radio: "Radio only: Grouped",
  grouped: "Radio, checkbox, and multi-select: Grouped",
  mui: "Use MUI Theme-linked ChoiceGroup",
  cancelled: "Submission cancelled; values and draft were preserved.",
  navigation: "Custom step navigation",
  values: "Submitted values",
  retry: "Retry",
  validation: "validation issue(s)"
};

const japaneseLabels: typeof englishLabels = {
  eyebrow: "回答者の画面",
  title: "お客様の回答体験を確認",
  intro: "お客様と同じ流れでアンケートに回答できます。保存した回答は集計画面に表示されます。",
  questions: "問",
  minutes: "分程度で回答",
  privacy: "このデモの回答は選択したブラウザーストレージに保存されます。外部のアンケートサービスには接続していません。",
  technical: "デモ設定・送信の動作確認",
  technicalNote: "保存方法、見た目、エラーを確認して、アンケートの利用準備を進められます。",
  lifecycle: "レンダラーの動作とスロット",
  slots: "カスタムUIスロットを利用",
  cancel: "次の送信をbeforeSubmitで中止",
  replace: "送信成功後にフォームを完了画面へ置換",
  server: "次の送信でサーバー検証エラーを再現",
  appearance: "選択式の質問の表示",
  flat: "フラット表示",
  radio: "ラジオボタンのみグループ表示",
  grouped: "ラジオ・チェックボックス・複数選択をグループ表示",
  mui: "MUIテーマ対応のChoiceGroupを利用",
  cancelled: "送信を中止しました。入力内容と下書きは保持しています。",
  navigation: "カスタムステップナビゲーション",
  values: "送信した回答",
  retry: "再試行",
  validation: "件の入力エラー"
};

export function RespondentPanel() {
  const { schema, locale } = useForm();
  const {
    storageKind,
    storage,
    telemetryAdapter,
    isClearing,
    simulateServerError,
    setStorageKind,
    resetResponses,
    setSimulateServerError
  } = usePreviewWorkspace();
  const {
    useCustomSlots,
    cancelNextSubmit,
    successRenderMode,
    choiceFieldLayout,
    useMuiChoiceGroup,
    lifecycleStatus,
    setUseCustomSlots,
    setCancelNextSubmit,
    setSuccessRenderMode,
    setChoiceFieldLayout,
    setUseMuiChoiceGroup,
    setLifecycleStatus
  } = useRespondentPreview();
  const labels = locale === "ja" ? japaneseLabels : englishLabels;
  const t = (key: string) => mockTranslator.translate(key, locale) ?? key;
  const rendererSlots: FormRendererSlots | undefined = useCustomSlots
    ? {
        renderHeader: ({ title, description }) => (
          <header className="preview-slot-header" data-testid="preview-slot-header">
            <span>UI SLOT</span>
            <h1>{title}</h1>
            {description === undefined ? null : <p>{description}</p>}
          </header>
        ),
        renderPageHeader: ({ page, pageIndex, totalPages }) => (
          <header className="preview-slot-page-header" data-testid="preview-slot-page-header">
            <span>
              PAGE SLOT {pageIndex + 1}/{totalPages}
            </span>
            {page.title === undefined ? null : <h2>{page.title}</h2>}
            {page.description === undefined ? null : <p>{page.description}</p>}
          </header>
        ),
        renderNavigation: ({ currentPage, totalPages, canPrev, canNext, onPrev, onNext }) => (
          <nav className="preview-slot-navigation" aria-label={labels.navigation}>
            <span>
              {currentPage + 1} / {totalPages}
            </span>
            <button type="button" disabled={!canPrev} onClick={onPrev}>
              {t("form.back")}
            </button>
            <button type="button" disabled={!canNext} onClick={onNext}>
              {t("form.next")}
            </button>
          </nav>
        ),
        renderSubmitButton: ({ isSubmitting, onSubmit }) => (
          <button className="preview-slot-submit" type="button" disabled={isSubmitting} onClick={onSubmit}>
            SLOT · {t("form.submit")}
          </button>
        ),
        renderValidationSummary: ({ issues }) => (
          <aside className="preview-slot-summary" role="alert">
            {issues.length} {labels.validation}
          </aside>
        ),
        renderCompletion: ({ message }) => (
          <div className="preview-slot-completion" role="status">
            {message}
          </div>
        ),
        renderSubmittedValues: ({ items }) => (
          <ul className="preview-slot-submitted-values" aria-label={labels.values}>
            {items.map((item) => (
              <li key={item.fieldId}>
                {item.title}: {item.displayValue}
              </li>
            ))}
          </ul>
        ),
        renderSubmitError: ({ error, onRetry }) => (
          <div className="preview-slot-submit-error" role="alert">
            <span>{error.message}</span>
            {onRetry === undefined ? null : (
              <button type="button" onClick={onRetry}>
                {labels.retry}
              </button>
            )}
          </div>
        ),
        ...(useMuiChoiceGroup ? { renderChoiceGroup: MuiChoiceGroupSlot } : {})
      }
    : useMuiChoiceGroup
      ? { renderChoiceGroup: MuiChoiceGroupSlot }
      : undefined;

  const choiceFieldAppearance =
    choiceFieldLayout === "radio-grouped"
      ? { choiceField: { radio: "grouped" as const } }
      : { choiceField: choiceFieldLayout === "all-grouped" ? ("grouped" as const) : ("default" as const) };
  const renderer = (
    <FormRenderer
      successMessageKey="preview.success"
      errorMessageKey="preview.error"
      appearance={choiceFieldAppearance}
      successRenderMode={successRenderMode}
      telemetry={{ adapter: telemetryAdapter }}
      autoSaveKey={`form-engine-preview-draft:${storageKind}:${schema.id}:${schema.version}`}
      {...(getFormContentMode(schema.metadata) === "survey" ? { draftResume: {} } : {})}
      beforeSubmit={() => {
        if (!cancelNextSubmit) return "continue";
        setCancelNextSubmit(false);
        setLifecycleStatus(labels.cancelled);
        return "cancel";
      }}
      {...(rendererSlots === undefined ? {} : { slots: rendererSlots })}
    />
  );

  return (
    <section className="workspace-card respondent-card">
      <header className="respondent-intro">
        <span className="eyebrow">{labels.eyebrow}</span>
        <h2>{labels.title}</h2>
        <p>{labels.intro}</p>
        <span className="respondent-estimate">
          {schema.fields.length} {labels.questions} · {Math.max(1, Math.ceil(schema.fields.length / 4))}{" "}
          {labels.minutes}
        </span>
      </header>
      {lifecycleStatus === null ? null : (
        <p className="lifecycle-status" role="status">
          {lifecycleStatus}
        </p>
      )}
      {useMuiChoiceGroup ? <ThemeProvider theme={previewTheme}>{renderer}</ThemeProvider> : renderer}
      <p className="respondent-note">{labels.privacy}</p>
      <details className="preview-technical-details">
        <summary>{labels.technical}</summary>
        <p>{labels.technicalNote}</p>
        <StorageSwitch value={storageKind} locale={locale} onChange={setStorageKind} />
        <ResetResponsesControl
          locale={locale}
          disabled={isClearing || storage.clearResponses === undefined}
          onReset={resetResponses}
        />
        <fieldset className="renderer-demo-controls">
          <legend>{labels.lifecycle}</legend>
          <label>
            <input
              type="checkbox"
              checked={useCustomSlots}
              onChange={(event) => setUseCustomSlots(event.currentTarget.checked)}
            />
            {labels.slots}
          </label>
          <label>
            <input
              type="checkbox"
              checked={cancelNextSubmit}
              onChange={(event) => setCancelNextSubmit(event.currentTarget.checked)}
            />
            {labels.cancel}
          </label>
          <label>
            <input
              type="checkbox"
              checked={successRenderMode === "replace"}
              onChange={(event) => setSuccessRenderMode(event.currentTarget.checked ? "replace" : "append")}
            />
            {labels.replace}
          </label>
          <label>
            <input
              type="checkbox"
              checked={simulateServerError}
              onChange={(event) => setSimulateServerError(event.currentTarget.checked)}
            />
            {labels.server}
          </label>
          <fieldset className="appearance-demo-controls">
            <legend>{labels.appearance}</legend>
            <label>
              <input
                type="radio"
                name="choice-field-layout"
                value="default"
                checked={choiceFieldLayout === "default"}
                onChange={() => setChoiceFieldLayout("default")}
              />
              {labels.flat}
            </label>
            <label>
              <input
                type="radio"
                name="choice-field-layout"
                value="radio-grouped"
                checked={choiceFieldLayout === "radio-grouped"}
                onChange={() => setChoiceFieldLayout("radio-grouped")}
              />
              {labels.radio}
            </label>
            <label>
              <input
                type="radio"
                name="choice-field-layout"
                value="all-grouped"
                checked={choiceFieldLayout === "all-grouped"}
                onChange={() => setChoiceFieldLayout("all-grouped")}
              />
              {labels.grouped}
            </label>
            <label>
              <input
                type="checkbox"
                checked={useMuiChoiceGroup}
                onChange={(event) => setUseMuiChoiceGroup(event.currentTarget.checked)}
              />
              {labels.mui}
            </label>
          </fieldset>
        </fieldset>
      </details>
    </section>
  );
}
