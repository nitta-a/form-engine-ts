import type { FormSchema, FormStorageAdapter } from "@form-engine-ts/core";
import { MuiChoiceGroupSlot } from "@form-engine-ts/mui";
import { FormRenderer, type FormRendererSlots, type FormSuccessRenderMode } from "@form-engine-ts/react";
import { mockTranslator } from "@form-engine-ts/translator-mock";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { useState } from "react";

export type StorageKind = "memory" | "local";
export type ChoiceFieldLayout = "default" | "radio-grouped" | "all-grouped";

const previewMuiTheme = createTheme();

function StorageSwitch({
  value,
  locale,
  onChange
}: {
  readonly value: StorageKind;
  readonly locale: string;
  readonly onChange: (value: StorageKind) => void;
}) {
  const t = (key: string) => mockTranslator.translate(key, locale) ?? key;
  return (
    <fieldset className="storage-switch">
      <legend>{t("preview.storage")}</legend>
      <label>
        <input type="radio" name="storage" checked={value === "memory"} onChange={() => onChange("memory")} />
        {t("preview.memory")}
      </label>
      <label>
        <input type="radio" name="storage" checked={value === "local"} onChange={() => onChange("local")} />
        {t("preview.localStorage")}
      </label>
    </fieldset>
  );
}

export function ResetResponsesControl({
  locale,
  disabled,
  onReset
}: {
  readonly locale: string;
  readonly disabled: boolean;
  readonly onReset: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const t = (key: string) => mockTranslator.translate(key, locale) ?? key;
  if (!confirming) {
    return (
      <button className="danger-action" type="button" disabled={disabled} onClick={() => setConfirming(true)}>
        {t("preview.resetResponses")}
      </button>
    );
  }
  return (
    <fieldset className="reset-confirmation">
      <legend>{t("preview.resetConfirmation")}</legend>
      <button
        className="danger-action"
        type="button"
        disabled={disabled}
        onClick={async () => {
          await onReset();
          setConfirming(false);
        }}
      >
        {t("preview.confirmReset")}
      </button>
      <button type="button" disabled={disabled} onClick={() => setConfirming(false)}>
        {t("preview.cancel")}
      </button>
    </fieldset>
  );
}

export interface RespondentPanelProps {
  readonly schema: FormSchema;
  readonly locale: string;
  readonly storageKind: StorageKind;
  readonly storage: FormStorageAdapter;
  readonly isClearing: boolean;
  readonly useCustomSlots: boolean;
  readonly cancelNextSubmit: boolean;
  readonly successRenderMode: FormSuccessRenderMode;
  readonly simulateServerError: boolean;
  readonly choiceFieldLayout: ChoiceFieldLayout;
  readonly useMuiChoiceGroup: boolean;
  readonly lifecycleStatus: string | null;
  readonly onStorageKindChange: (value: StorageKind) => void;
  readonly onResetResponses: () => Promise<void>;
  readonly onUseCustomSlotsChange: (value: boolean) => void;
  readonly onCancelNextSubmitChange: (value: boolean) => void;
  readonly onSuccessRenderModeChange: (value: FormSuccessRenderMode) => void;
  readonly onSimulateServerErrorChange: (value: boolean) => void;
  readonly onChoiceFieldLayoutChange: (value: ChoiceFieldLayout) => void;
  readonly onUseMuiChoiceGroupChange: (value: boolean) => void;
  readonly onLifecycleStatusChange: (value: string) => void;
}

export function RespondentPanel({
  schema,
  locale,
  storageKind,
  storage,
  isClearing,
  useCustomSlots,
  cancelNextSubmit,
  successRenderMode,
  simulateServerError,
  choiceFieldLayout,
  useMuiChoiceGroup,
  lifecycleStatus,
  onStorageKindChange,
  onResetResponses,
  onUseCustomSlotsChange,
  onCancelNextSubmitChange,
  onSuccessRenderModeChange,
  onSimulateServerErrorChange,
  onChoiceFieldLayoutChange,
  onUseMuiChoiceGroupChange,
  onLifecycleStatusChange
}: RespondentPanelProps) {
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
        onCancelNextSubmitChange(false);
        onLifecycleStatusChange("Submission cancelled; values and draft were preserved.");
        return "cancel";
      }}
      {...(rendererSlots === undefined ? {} : { slots: rendererSlots })}
    />
  );

  return (
    <section className="workspace-card respondent-card">
      <StorageSwitch value={storageKind} locale={locale} onChange={onStorageKindChange} />
      <ResetResponsesControl
        locale={locale}
        disabled={isClearing || storage.clearResponses === undefined}
        onReset={onResetResponses}
      />
      <fieldset className="renderer-demo-controls">
        <legend>v2 Renderer lifecycle &amp; slots</legend>
        <label>
          <input
            type="checkbox"
            checked={useCustomSlots}
            onChange={(event) => onUseCustomSlotsChange(event.currentTarget.checked)}
          />
          Use custom UI slots
        </label>
        <label>
          <input
            type="checkbox"
            checked={cancelNextSubmit}
            onChange={(event) => onCancelNextSubmitChange(event.currentTarget.checked)}
          />
          Cancel next submission in beforeSubmit
        </label>
        <label>
          <input
            type="checkbox"
            checked={successRenderMode === "replace"}
            onChange={(event) => onSuccessRenderModeChange(event.currentTarget.checked ? "replace" : "append")}
          />
          Replace form after successful submission
        </label>
        <label>
          <input
            type="checkbox"
            checked={simulateServerError}
            onChange={(event) => onSimulateServerErrorChange(event.currentTarget.checked)}
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
              onChange={() => onChoiceFieldLayoutChange("default")}
            />
            Flat choices
          </label>
          <label>
            <input
              type="radio"
              name="choice-field-layout"
              value="radio-grouped"
              checked={choiceFieldLayout === "radio-grouped"}
              onChange={() => onChoiceFieldLayoutChange("radio-grouped")}
            />
            Radio only: Grouped
          </label>
          <label>
            <input
              type="radio"
              name="choice-field-layout"
              value="all-grouped"
              checked={choiceFieldLayout === "all-grouped"}
              onChange={() => onChoiceFieldLayoutChange("all-grouped")}
            />
            Radio, checkbox, and multi-select: Grouped
          </label>
          <label>
            <input
              type="checkbox"
              checked={useMuiChoiceGroup}
              onChange={(event) => onUseMuiChoiceGroupChange(event.currentTarget.checked)}
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
