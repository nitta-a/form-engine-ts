import { MuiChoiceGroupSlot } from "@form-engine-ts/mui";
import { FormRenderer, type FormRendererSlots, useForm } from "@form-engine-ts/react";
import { mockTranslator } from "@form-engine-ts/translator-mock";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { usePreviewWorkspace } from "../workspace/PreviewWorkspaceContext";
import { ResetResponsesControl } from "./ResetResponsesControl";
import { useRespondentPreview } from "./RespondentPreviewContext";
import { StorageSwitch } from "./StorageSwitch";

export type { ChoiceFieldLayout } from "./RespondentPreviewContext";

const previewMuiTheme = createTheme();

export type { ResetResponsesControlProps } from "./ResetResponsesControl";
export { ResetResponsesControl } from "./ResetResponsesControl";

export function RespondentPanel() {
  const { schema, locale } = useForm();
  const {
    storageKind,
    storage,
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
          <nav className="preview-slot-navigation" aria-label="Custom step navigation">
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
            {issues.length} validation issue(s)
          </aside>
        ),
        renderCompletion: ({ message }) => (
          <div className="preview-slot-completion" role="status">
            {message}
          </div>
        ),
        renderSubmittedValues: ({ items }) => (
          <ul className="preview-slot-submitted-values" aria-label="Submitted values">
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
                Retry
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
      autoSaveKey={`form-engine-preview-draft:${schema.id}:${schema.version}`}
      beforeSubmit={() => {
        if (!cancelNextSubmit) return "continue";
        setCancelNextSubmit(false);
        setLifecycleStatus("Submission cancelled; values and draft were preserved.");
        return "cancel";
      }}
      {...(rendererSlots === undefined ? {} : { slots: rendererSlots })}
    />
  );

  return (
    <section className="workspace-card respondent-card">
      <StorageSwitch value={storageKind} locale={locale} onChange={setStorageKind} />
      <ResetResponsesControl
        locale={locale}
        disabled={isClearing || storage.clearResponses === undefined}
        onReset={resetResponses}
      />
      <fieldset className="renderer-demo-controls">
        <legend>v2 Renderer lifecycle &amp; slots</legend>
        <label>
          <input
            type="checkbox"
            checked={useCustomSlots}
            onChange={(event) => setUseCustomSlots(event.currentTarget.checked)}
          />
          Use custom UI slots
        </label>
        <label>
          <input
            type="checkbox"
            checked={cancelNextSubmit}
            onChange={(event) => setCancelNextSubmit(event.currentTarget.checked)}
          />
          Cancel next submission in beforeSubmit
        </label>
        <label>
          <input
            type="checkbox"
            checked={successRenderMode === "replace"}
            onChange={(event) => setSuccessRenderMode(event.currentTarget.checked ? "replace" : "append")}
          />
          Replace form after successful submission
        </label>
        <label>
          <input
            type="checkbox"
            checked={simulateServerError}
            onChange={(event) => setSimulateServerError(event.currentTarget.checked)}
          />
          Simulate server validation error on next submit
        </label>
        <fieldset className="appearance-demo-controls">
          <legend>Choice field appearance</legend>
          <label>
            <input
              type="radio"
              name="choice-field-layout"
              value="default"
              checked={choiceFieldLayout === "default"}
              onChange={() => setChoiceFieldLayout("default")}
            />
            Flat choices
          </label>
          <label>
            <input
              type="radio"
              name="choice-field-layout"
              value="radio-grouped"
              checked={choiceFieldLayout === "radio-grouped"}
              onChange={() => setChoiceFieldLayout("radio-grouped")}
            />
            Radio only: Grouped
          </label>
          <label>
            <input
              type="radio"
              name="choice-field-layout"
              value="all-grouped"
              checked={choiceFieldLayout === "all-grouped"}
              onChange={() => setChoiceFieldLayout("all-grouped")}
            />
            Radio, checkbox, and multi-select: Grouped
          </label>
          <label>
            <input
              type="checkbox"
              checked={useMuiChoiceGroup}
              onChange={(event) => setUseMuiChoiceGroup(event.currentTarget.checked)}
            />
            Use MUI Theme-linked ChoiceGroup
          </label>
        </fieldset>
      </fieldset>
      {lifecycleStatus === null ? null : <p className="lifecycle-status">{lifecycleStatus}</p>}
      {useMuiChoiceGroup ? <ThemeProvider theme={previewMuiTheme}>{renderer}</ThemeProvider> : renderer}
    </section>
  );
}
