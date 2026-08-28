import {
  cloneVersionToDraft,
  createPublishTransitionPlan,
  createResponseAccumulator,
  deleteDraft,
  type FormSchema,
  type FormVersionRecord,
  type FormVersionState,
  validateFormSchema
} from "@form-engine-ts/core";
import {
  type BuilderButtonProps,
  type BuilderTextInputProps,
  type BuilderTranslationActionsSlotProps,
  FormBuilder,
  type FormBuilderComponents,
  useFormBuilder
} from "@form-engine-ts/react";
import { mockAsyncTranslator, mockTranslator } from "@form-engine-ts/translator-mock";
import { type ChangeEvent, useMemo, useRef, useState } from "react";
import { usePreviewWorkspace } from "../workspace/PreviewWorkspaceContext";
import { useBuilderPreview } from "./BuilderPreviewContext";
import { previewPolicy } from "./previewPolicy";

function PreviewMuiButton({
  children,
  onClick,
  disabled,
  className = "",
  variant = "secondary",
  "aria-label": ariaLabel,
  action,
  targetId
}: BuilderButtonProps) {
  return (
    <button
      className={`preview-mui-button preview-mui-button--${variant} ${className}`.trim()}
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      data-builder-action={action}
      data-target-id={targetId}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function PreviewMuiTextInput({
  id,
  name,
  label,
  required,
  error,
  helperText,
  value,
  onChange,
  disabled,
  readOnly,
  placeholder,
  maxLength,
  type,
  min,
  max,
  step,
  inputMode,
  className = "",
  "aria-label": ariaLabel
}: BuilderTextInputProps) {
  return (
    <span className="preview-mui-field">
      {label === undefined ? null : <label htmlFor={id}>{label}</label>}
      <input
        id={id}
        name={name}
        className={`preview-mui-input ${className}`.trim()}
        value={value}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        placeholder={placeholder}
        maxLength={maxLength}
        type={type}
        min={min}
        max={max}
        step={step}
        inputMode={inputMode}
        aria-label={ariaLabel ?? label}
        aria-invalid={error === true ? true : undefined}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      {helperText === undefined || helperText.length === 0 ? null : <small>{helperText}</small>}
    </span>
  );
}

function PreviewAiTranslationActions({ currentLocale, readOnly, onAutoTranslate }: BuilderTranslationActionsSlotProps) {
  return (
    <button
      className="preview-ai-translation"
      type="button"
      disabled={readOnly || currentLocale.length === 0}
      onClick={onAutoTranslate}
    >
      Run ARGS AI translation
    </button>
  );
}

const previewBuilderComponents: FormBuilderComponents = {
  Button: PreviewMuiButton,
  TextInput: PreviewMuiTextInput
};

function HeadlessBuilderDemo({
  schema,
  onChange
}: {
  readonly schema: FormSchema;
  readonly onChange: (schema: FormSchema) => void;
}) {
  const builder = useFormBuilder({
    schema,
    onChange,
    policy: previewPolicy,
    factories: {
      createField: (type, id) =>
        type === "text"
          ? { id, type, title: "Headless-created question", required: false }
          : { id, type: "text", title: "Headless-created question", required: false }
    }
  });
  const coreValidation = validateFormSchema(schema, { policy: previewPolicy });
  const coreIssueCount = coreValidation.valid ? 0 : coreValidation.issues.length;
  return (
    <fieldset className="headless-builder-demo">
      <legend>v2.2 Headless Builder &amp; Core Policy</legend>
      <output data-testid="policy-parity">
        Core {coreIssueCount} / React {builder.validationIssues.length}
      </output>
      <button type="button" onClick={() => builder.addField("text")}>
        Add via headless factory
      </button>
      <button
        type="button"
        onClick={() => builder.setSourceText({ kind: "form" }, "completionMessage", "Updated via headless action")}
      >
        Set completion via headless action
      </button>
    </fieldset>
  );
}

function DomainApiDemo({ schema }: { readonly schema: FormSchema }) {
  const [versionState, setVersionState] = useState<FormVersionState>({
    formId: schema.id,
    publishedVersion: schema.version,
    nextVersion: schema.version + 1,
    revision: 0
  });
  const [draftSchema, setDraftSchema] = useState<FormSchema | null>(null);
  const [currentPublishedRecord, setCurrentPublishedRecord] = useState<FormVersionRecord>({
    formId: schema.id,
    version: schema.version,
    status: "published",
    schema,
    revision: 1,
    createdAt: "2026-08-24T00:00:00.000Z",
    publishedAt: "2026-08-24T00:00:00.000Z"
  });
  const [transitionStatus, setTransitionStatus] = useState(`Published v${schema.version}`);
  const [casStatus, setCasStatus] = useState("CAS simulation not run");
  const persistedRevision = useRef(0);
  const incremental = useMemo(() => {
    const accumulator = createResponseAccumulator(schema);
    accumulator.addMany([
      {
        id: "preview-incremental-1",
        formId: schema.id,
        formVersion: schema.version,
        locale: schema.defaultLocale ?? "en",
        submittedAt: "2026-08-24T00:00:00.000Z",
        values: {}
      },
      {
        id: "preview-incremental-2",
        formId: schema.id,
        formVersion: schema.version,
        locale: schema.defaultLocale ?? "en",
        submittedAt: "2026-08-24T00:00:01.000Z",
        values: {}
      }
    ]);
    return accumulator.finalize();
  }, [schema]);

  const cloneDraft = () => {
    const result = cloneVersionToDraft(versionState, schema);
    if (!result.success) {
      setTransitionStatus(result.error.type);
      return;
    }
    persistedRevision.current = result.value.nextState.revision;
    setVersionState(result.value.nextState);
    setDraftSchema(result.value.draftSchema);
    setTransitionStatus(`Draft v${result.value.draftSchema.version}`);
  };
  const publish = async () => {
    if (draftSchema === null) return;
    const draftRecord: FormVersionRecord = {
      formId: schema.id,
      version: draftSchema.version,
      status: "draft",
      schema: draftSchema,
      revision: 1,
      ...(versionState.publishedVersion === undefined ? {} : { createdFromVersion: versionState.publishedVersion }),
      createdAt: "2026-08-24T08:00:00.000Z"
    };
    const result = await createPublishTransitionPlan(versionState, draftRecord, {
      expectedRevision: versionState.revision,
      currentPublishedRecord,
      publishedAt: "2026-08-24T09:00:00.000Z"
    });
    if (!result.success) {
      setTransitionStatus(result.error.type);
      return;
    }
    await Promise.resolve();
    if (persistedRevision.current !== result.value.plan.expectedRevision) {
      setTransitionStatus("revision_conflict");
      return;
    }
    persistedRevision.current = result.value.plan.nextRevision;
    setVersionState(result.value.nextState);
    setDraftSchema(null);
    if (result.value.plan.publishedRecordToSave !== undefined) {
      setCurrentPublishedRecord(result.value.plan.publishedRecordToSave);
    }
    setTransitionStatus(
      `Published v${result.value.plan.publishedRecordToSave?.version ?? "none"}; archived v${result.value.plan.archivedRecordsToSave?.[0]?.version ?? "none"}`
    );
  };
  const discard = () => {
    const result = deleteDraft(versionState);
    if (!result.success) {
      setTransitionStatus(result.error.type);
      return;
    }
    setVersionState(result.value.nextState);
    setDraftSchema(null);
    setTransitionStatus("Draft deleted");
  };
  const runCasSimulation = async () => {
    const state = { revision: 0 };
    const attempt = async () => {
      await Promise.resolve();
      if (state.revision !== 0) return "revision_conflict";
      state.revision = 1;
      return "success";
    };
    const results = await Promise.all([attempt(), attempt()]);
    setCasStatus(
      `CAS: ${results.filter((result) => result === "success").length} success / ${results.filter((result) => result === "revision_conflict").length} revision_conflict`
    );
  };

  return (
    <fieldset className="domain-api-demo">
      <legend>v2.6 Versioning, CAS &amp; incremental analytics</legend>
      <div className="domain-api-actions">
        <button type="button" disabled={draftSchema !== null} onClick={cloneDraft}>
          Clone published version to draft
        </button>
        <button type="button" disabled={draftSchema === null} onClick={() => void publish()}>
          Publish draft
        </button>
        <button type="button" disabled={draftSchema === null} onClick={discard}>
          Delete draft
        </button>
        <button type="button" onClick={() => void runCasSimulation()}>
          Run concurrent CAS simulation
        </button>
      </div>
      <output>{transitionStatus}</output>
      <output>{casStatus}</output>
      <output>Incremental submissions: {incremental.submissionCount}</output>
    </fieldset>
  );
}

export function BuilderPanel() {
  const { schema, locale, workspaceReady, changeSchema } = usePreviewWorkspace();
  const {
    translationOverwrite,
    translationReport,
    builderActionStatus,
    builderReadOnly,
    pagesEnabled,
    localizationEnabled,
    conditionsEnabled,
    useCustomBuilderUi,
    setTranslationOverwrite,
    setBuilderReadOnly,
    setPagesEnabled,
    setLocalizationEnabled,
    setConditionsEnabled,
    setUseCustomBuilderUi,
    setTranslationReport,
    setBuilderActionStatus,
    runTranslationPolicy
  } = useBuilderPreview();
  return (
    <div className="builder-grid">
      <section className="workspace-card">
        <fieldset className="translation-policy-demo">
          <legend>v2 Translation overwrite policy</legend>
          <label>
            Overwrite
            <select
              value={translationOverwrite}
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                setTranslationOverwrite(event.currentTarget.value as "missing-only" | "all")
              }
            >
              <option value="missing-only">missing-only</option>
              <option value="all">all</option>
            </select>
          </label>
          <button type="button" disabled={!workspaceReady} onClick={() => void runTranslationPolicy()}>
            Run translation policy
          </button>
          {translationReport === null ? null : <output>{translationReport}</output>}
        </fieldset>
        <HeadlessBuilderDemo schema={schema} onChange={changeSchema} />
        <DomainApiDemo schema={schema} />
        <fieldset className="renderer-demo-controls">
          <legend>v2.4 MUI-compatible Builder components</legend>
          <label>
            <input
              type="checkbox"
              checked={builderReadOnly}
              onChange={(event) => setBuilderReadOnly(event.currentTarget.checked)}
            />
            Read-only builder
          </label>
          <label>
            <input
              type="checkbox"
              checked={pagesEnabled}
              onChange={(event) => setPagesEnabled(event.currentTarget.checked)}
            />
            Pages feature
          </label>
          <label>
            <input
              type="checkbox"
              checked={localizationEnabled}
              onChange={(event) => setLocalizationEnabled(event.currentTarget.checked)}
            />
            Localization feature
          </label>
          <label>
            <input
              type="checkbox"
              checked={conditionsEnabled}
              onChange={(event) => setConditionsEnabled(event.currentTarget.checked)}
            />
            Conditions feature
          </label>
          <label>
            <input
              type="checkbox"
              checked={useCustomBuilderUi}
              onChange={(event) => setUseCustomBuilderUi(event.currentTarget.checked)}
            />
            Use custom Builder UI
          </label>
        </fieldset>
        {builderActionStatus === null ? null : (
          <p className="builder-action-status" role="status">
            {builderActionStatus}
          </p>
        )}
        <FormBuilder
          schema={schema}
          locale={locale}
          translator={mockTranslator}
          translationAdapter={mockAsyncTranslator}
          onChange={changeSchema}
          policy={previewPolicy}
          defaultFieldType="textarea"
          readOnly={builderReadOnly}
          features={{ pages: pagesEnabled, localization: localizationEnabled, conditions: conditionsEnabled }}
          {...(useCustomBuilderUi
            ? { components: previewBuilderComponents, slots: { translationActions: PreviewAiTranslationActions } }
            : {})}
          translationOptions={{
            overwrite: translationOverwrite,
            createMetadata: (slot) => ({ source: "visual-builder", property: slot.property })
          }}
          onTranslationReport={(report) =>
            setTranslationReport(
              `${report.updatedSlots.length} updated / ${report.skippedSlots.length} skipped (${translationOverwrite})`
            )
          }
          onActionError={(error, context) => setBuilderActionStatus(`${context.action}: ${error.type}`)}
          createManualTranslationMetadata={(context) => ({
            source: "preview-manual",
            isManual: true,
            property: context.property
          })}
        />
      </section>
      <section className="workspace-card json-card">
        <h2>{mockTranslator.translate("preview.schemaJson", locale) ?? "preview.schemaJson"}</h2>
        <pre>
          <code>{JSON.stringify(schema, null, 2)}</code>
        </pre>
      </section>
    </div>
  );
}
