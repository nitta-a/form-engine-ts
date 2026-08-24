import {
  aggregateResponses,
  calculateCrossTabulation,
  calculateFieldVisibility,
  cloneVersionToDraft,
  createPublishTransitionPlan,
  createResponseAccumulator,
  createSubmission,
  deleteDraft,
  dispatchWebhook,
  exportResponsesToCsvStream,
  type FormAnalytics,
  type FormEvent,
  type FormPolicy,
  type FormSchema,
  type FormStorageAdapter,
  type FormSubmission,
  type FormValues,
  type FormVersionRecord,
  type FormVersionState,
  populateSchemaTranslations,
  type QuestionAggregate,
  type SelectField,
  validateFormSchema
} from "@form-engine-ts/core";
import {
  type BuilderButtonProps,
  type BuilderTextInputProps,
  type BuilderTranslationActionsSlotProps,
  FormBuilder,
  type FormBuilderComponents,
  FormProvider,
  FormRenderer,
  type FormRendererSlots,
  useFormBuilder
} from "@form-engine-ts/react";
import { createLocalStorageAdapter } from "@form-engine-ts/storage-localstorage";
import { createMemoryStorageAdapter } from "@form-engine-ts/storage-memory";
import { mockAsyncTranslator, mockTranslator } from "@form-engine-ts/translator-mock";
import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { customerFeedbackSchema } from "./schema";

type TabId = "builder" | "respondent" | "analytics";
type StorageKind = "memory" | "local";

const tabs: readonly TabId[] = ["builder", "respondent", "analytics"];
const previewPolicy: FormPolicy = {
  maxFields: 20,
  maxOptionsPerField: 10,
  maxTextLength: 500,
  requiredLocales: ["ja", "en"],
  allowedLocales: ["ja", "en"],
  maxLocales: 2
};

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

const previewBuilderComponents: FormBuilderComponents = {
  Button: PreviewMuiButton,
  TextInput: PreviewMuiTextInput
};

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

function formatNumber(value: number | null): string {
  return value === null ? "—" : Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function OptionBar({
  label,
  count,
  percentage
}: {
  readonly label: string;
  readonly count: number;
  readonly percentage: number;
}) {
  return (
    <div className="option-bar">
      <div>
        <span>{label}</span>
        <strong>
          {count} · {percentage.toFixed(0)}%
        </strong>
      </div>
      <div className="track" aria-hidden="true">
        <span style={{ width: `${Math.min(percentage, 100)}%` }} />
      </div>
    </div>
  );
}

function AnalyticsDetails({
  aggregate,
  schema,
  locale
}: {
  readonly aggregate: QuestionAggregate;
  readonly schema: FormSchema;
  readonly locale: string;
}) {
  const t = (key: string) => mockTranslator.translate(key, locale);
  if (aggregate.kind === "number" || aggregate.kind === "rating") {
    return (
      <dl className="metric-grid">
        <div>
          <dt>{t("preview.minimum")}</dt>
          <dd>{formatNumber(aggregate.minimum)}</dd>
        </div>
        <div>
          <dt>{t("preview.maximum")}</dt>
          <dd>{formatNumber(aggregate.maximum)}</dd>
        </div>
        <div>
          <dt>{t("preview.average")}</dt>
          <dd>{formatNumber(aggregate.average)}</dd>
        </div>
        <div>
          <dt>{t("preview.total")}</dt>
          <dd>{formatNumber(aggregate.total)}</dd>
        </div>
      </dl>
    );
  }
  if (aggregate.kind === "checkbox") {
    return (
      <div className="option-bars">
        <OptionBar
          label={t("preview.true")}
          count={aggregate.trueCount}
          percentage={aggregate.truePercentageOfSubmissions}
        />
        <OptionBar
          label={t("preview.false")}
          count={aggregate.falseCount}
          percentage={aggregate.falsePercentageOfSubmissions}
        />
      </div>
    );
  }
  if (aggregate.kind === "select" || aggregate.kind === "radio" || aggregate.kind === "multi-select") {
    const field = schema.fields.find((item) => item.id === aggregate.fieldId);
    return (
      <div className="option-bars">
        {aggregate.options.map((option) => {
          const schemaOption =
            field !== undefined && "options" in field ? field.options.find((item) => item.id === option.id) : undefined;
          return (
            <OptionBar
              key={option.id}
              label={schemaOption === undefined ? option.id : schemaOption.label}
              count={option.count}
              percentage={option.percentageOfSubmissions}
            />
          );
        })}
      </div>
    );
  }
  return null;
}

function AnalyticsPanel({
  analytics,
  schema,
  submissions,
  locale,
  onExport,
  resetControl
}: {
  readonly analytics: FormAnalytics;
  readonly schema: FormSchema;
  readonly submissions: readonly FormSubmission[];
  readonly locale: string;
  readonly onExport: () => Promise<void>;
  readonly resetControl: ReactNode;
}) {
  const t = (key: string) => mockTranslator.translate(key, locale);
  const textFields = schema.fields.filter((field) => field.type === "text" || field.type === "textarea");
  const singleChoiceFields = schema.fields.filter(
    (field): field is SelectField => field.type === "select" || field.type === "radio"
  );
  const [rowQuestionId, setRowQuestionId] = useState(singleChoiceFields[0]?.id ?? "");
  const [colQuestionId, setColQuestionId] = useState(singleChoiceFields[1]?.id ?? "");
  const [webhookUrl, setWebhookUrl] = useState("https://example.test/form-engine-webhook");
  const [webhookStatus, setWebhookStatus] = useState<string | null>(null);
  const effectiveRowId = singleChoiceFields.some((field) => field.id === rowQuestionId)
    ? rowQuestionId
    : (singleChoiceFields[0]?.id ?? "");
  const effectiveColId = singleChoiceFields.some((field) => field.id === colQuestionId)
    ? colQuestionId
    : (singleChoiceFields[1]?.id ?? singleChoiceFields[0]?.id ?? "");
  const crossTab = useMemo(
    () => calculateCrossTabulation(submissions, effectiveRowId, effectiveColId),
    [effectiveColId, effectiveRowId, submissions]
  );
  const rowField = singleChoiceFields.find((field) => field.id === effectiveRowId);
  const colField = singleChoiceFields.find((field) => field.id === effectiveColId);

  const simulateWebhook = async () => {
    const event: FormEvent = {
      id: globalThis.crypto.randomUUID(),
      type: "response.submitted",
      formId: schema.id,
      timestamp: new Date().toISOString(),
      payload: { submissionCount: submissions.length }
    };
    const result = await dispatchWebhook(event, { url: webhookUrl }, async () => new Response(null, { status: 202 }));
    setWebhookStatus(result.success ? t("preview.webhookSuccess") : (result.error ?? t("preview.webhookError")));
  };
  return (
    <section className="workspace-card analytics-card" aria-labelledby="analytics-heading">
      <div className="analytics-heading">
        <div>
          <span className="eyebrow">LIVE</span>
          <h2 id="analytics-heading">{t("preview.analytics")}</h2>
        </div>
        <div className="response-count">
          <strong>{analytics.submissionCount}</strong>
          <span>{t("preview.responses")}</span>
        </div>
      </div>
      <div className="dashboard-actions">
        <button className="primary-action" type="button" onClick={() => void onExport()}>
          {t("preview.export")}
        </button>
        {resetControl}
      </div>
      <section className="analytics-tool" aria-labelledby="cross-tab-heading">
        <h3 id="cross-tab-heading">{t("preview.crossTab")}</h3>
        <div className="analytics-tool-controls">
          <label>
            {t("preview.rowQuestion")}
            <select value={effectiveRowId} onChange={(event) => setRowQuestionId(event.currentTarget.value)}>
              {singleChoiceFields.map((field) => (
                <option key={field.id} value={field.id}>
                  {field.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("preview.colQuestion")}
            <select value={effectiveColId} onChange={(event) => setColQuestionId(event.currentTarget.value)}>
              {singleChoiceFields.map((field) => (
                <option key={field.id} value={field.id}>
                  {field.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        {rowField === undefined || colField === undefined ? null : (
          <div className="cross-tab-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">{rowField.title}</th>
                  {colField.options.map((option) => (
                    <th scope="col" key={option.id}>
                      {option.label}
                    </th>
                  ))}
                  <th scope="col">{t("preview.total")}</th>
                </tr>
              </thead>
              <tbody>
                {rowField.options.map((rowOption) => (
                  <tr key={rowOption.id}>
                    <th scope="row">{rowOption.label}</th>
                    {colField.options.map((colOption) => (
                      <td key={colOption.id}>{crossTab.matrix[rowOption.id]?.[colOption.id] ?? 0}</td>
                    ))}
                    <td>{crossTab.rowTotals[rowOption.id] ?? 0}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">{t("preview.total")}</th>
                  {colField.options.map((option) => (
                    <td key={option.id}>{crossTab.colTotals[option.id] ?? 0}</td>
                  ))}
                  <td>{crossTab.grandTotal}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
      <section className="analytics-tool" aria-labelledby="webhook-heading">
        <h3 id="webhook-heading">{t("preview.webhook")}</h3>
        <label>
          {t("preview.webhookUrl")}
          <input value={webhookUrl} onChange={(event) => setWebhookUrl(event.currentTarget.value)} />
        </label>
        <button type="button" onClick={() => void simulateWebhook()}>
          {t("preview.simulateWebhook")}
        </button>
        {webhookStatus === null ? null : <p role="status">{webhookStatus}</p>}
      </section>
      {analytics.submissionCount === 0 ? (
        <p className="empty-state">{t("preview.noResponses")}</p>
      ) : (
        <div className="analytics-grid">
          <div className="question-results">
            {analytics.questions.map((aggregate) => {
              const field = schema.fields.find((item) => item.id === aggregate.fieldId);
              return (
                <section className="question-result" key={aggregate.fieldId}>
                  <h3>{field === undefined ? aggregate.fieldId : field.title}</h3>
                  <p className="answer-counts">
                    {t("preview.answered")}: {aggregate.answeredCount} · {t("preview.unanswered")}:{" "}
                    {aggregate.unansweredCount}
                  </p>
                  <AnalyticsDetails aggregate={aggregate} schema={schema} locale={locale} />
                </section>
              );
            })}
          </div>
          <section className="free-text">
            <h3>{t("preview.freeText")}</h3>
            {textFields.map((field) => {
              const answers = submissions.flatMap((submission) => {
                if (calculateFieldVisibility(schema, submission.values)[field.id] !== true) return [];
                const value = submission.values[field.id];
                return typeof value === "string" && value.trim().length > 0 ? [{ id: submission.id, value }] : [];
              });
              return answers.length === 0 ? null : (
                <div key={field.id}>
                  <h4>{field.title}</h4>
                  <ul>
                    {answers.map((answer) => (
                      <li key={`${field.id}-${answer.id}`}>{answer.value}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </section>
        </div>
      )}
    </section>
  );
}

function StorageSwitch({
  value,
  locale,
  onChange
}: {
  readonly value: StorageKind;
  readonly locale: string;
  readonly onChange: (value: StorageKind) => void;
}) {
  const t = (key: string) => mockTranslator.translate(key, locale);
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

function ResetResponsesControl({
  locale,
  disabled,
  onReset
}: {
  readonly locale: string;
  readonly disabled: boolean;
  readonly onReset: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const t = (key: string) => mockTranslator.translate(key, locale);
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

export default function App() {
  const memoryStorage = useMemo(() => createMemoryStorageAdapter(), []);
  const localStorage = useMemo(() => createLocalStorageAdapter("form-engine-preview_"), []);
  const [storageKind, setStorageKind] = useState<StorageKind>("memory");
  const [schema, setSchema] = useState<FormSchema>(customerFeedbackSchema);
  const [submissions, setSubmissions] = useState<readonly FormSubmission[]>([]);
  const [locale, setLocale] = useState("en");
  const [activeTab, setActiveTab] = useState<TabId>("builder");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [useCustomSlots, setUseCustomSlots] = useState(false);
  const [cancelNextSubmit, setCancelNextSubmit] = useState(false);
  const [lifecycleStatus, setLifecycleStatus] = useState<string | null>(null);
  const [translationOverwrite, setTranslationOverwrite] = useState<"missing-only" | "all">("missing-only");
  const [translationReport, setTranslationReport] = useState<string | null>(null);
  const [builderActionStatus, setBuilderActionStatus] = useState<string | null>(null);
  const [builderReadOnly, setBuilderReadOnly] = useState(false);
  const [pagesEnabled, setPagesEnabled] = useState(true);
  const [localizationEnabled, setLocalizationEnabled] = useState(true);
  const [conditionsEnabled, setConditionsEnabled] = useState(true);
  const [useCustomBuilderUi, setUseCustomBuilderUi] = useState(false);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [resetStatus, setResetStatus] = useState<{
    readonly kind: "success" | "error";
    readonly message: string;
  } | null>(null);
  const storage: FormStorageAdapter = storageKind === "memory" ? memoryStorage : localStorage;
  const analytics = useMemo(() => aggregateResponses(schema, submissions), [schema, submissions]);
  const t = (key: string) => mockTranslator.translate(key, locale);

  const loadWorkspace = useCallback(async (adapter: FormStorageAdapter) => {
    try {
      const stored = await adapter.getSchema(customerFeedbackSchema.id, customerFeedbackSchema.version);
      const nextSchema = stored ?? customerFeedbackSchema;
      if (stored === null) await adapter.saveSchema(nextSchema);
      const nextSubmissions = await adapter.listSubmissions(nextSchema.id, nextSchema.version);
      setSchema(nextSchema);
      setSubmissions(nextSubmissions);
      setLoadError(null);
      setResetStatus(null);
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  useEffect(() => {
    setWorkspaceReady(false);
    void loadWorkspace(storage).finally(() => setWorkspaceReady(true));
  }, [loadWorkspace, storage]);

  const changeSchema = (nextSchema: FormSchema) => {
    setSchema(nextSchema);
    setResetStatus(null);
    void storage
      .saveSchema(nextSchema)
      .catch((cause: unknown) => setLoadError(cause instanceof Error ? cause.message : String(cause)));
  };

  const submit = async (values: FormValues) => {
    setResetStatus(null);
    const submission = createSubmission(schema, values, {
      id: globalThis.crypto.randomUUID(),
      locale,
      submittedAt: new Date().toISOString(),
      metadata: { source: "preview", storage: storageKind }
    });
    await storage.saveSubmission(submission);
    setSubmissions(await storage.listSubmissions(schema.id, schema.version));
  };

  const downloadCsv = async () => {
    async function* submissionStream() {
      for (const submission of submissions) yield submission;
    }
    const chunks: string[] = [];
    for await (const chunk of exportResponsesToCsvStream(schema, submissionStream(), {
      columns: [
        {
          header: "asyncReview",
          getValue: async ({ submission }) => {
            await Promise.resolve();
            return submission.metadata?.source === "preview" ? "reviewed" : "external";
          }
        }
      ]
    })) {
      chunks.push(chunk);
    }
    const csv = chunks.join("");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${schema.id}-${schema.version}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const resetResponses = async () => {
    const previousSubmissions = submissions;
    setIsClearing(true);
    setResetStatus(null);
    setSubmissions([]);
    try {
      if (storage.clearResponses === undefined) throw new Error(t("preview.resetUnavailable"));
      await storage.clearResponses(schema.id);
      setSubmissions(await storage.listSubmissions(schema.id, schema.version));
      setResetStatus({ kind: "success", message: t("preview.resetSuccess") });
    } catch (cause) {
      setSubmissions(previousSubmissions);
      setResetStatus({
        kind: "error",
        message: `${t("preview.resetError")}${cause instanceof Error ? ` ${cause.message}` : ""}`
      });
    } finally {
      setIsClearing(false);
    }
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, tab: TabId) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const current = tabs.indexOf(tab);
    const offset = event.key === "ArrowRight" ? 1 : -1;
    const next = tabs[(current + offset + tabs.length) % tabs.length];
    if (next === undefined) return;
    setActiveTab(next);
    document.getElementById(`tab-${next}`)?.focus();
  };

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
        renderSubmitError: ({ error, onRetry }) => (
          <div className="preview-slot-submit-error" role="alert">
            <span>{error.message}</span>
            {onRetry === undefined ? null : (
              <button type="button" onClick={onRetry}>
                Retry
              </button>
            )}
          </div>
        )
      }
    : undefined;

  const runTranslationPolicyDemo = async () => {
    const targetLocale =
      locale === schema.defaultLocale
        ? (schema.supportedLocales?.find((candidate) => candidate !== schema.defaultLocale) ?? "en")
        : locale;
    const result = await populateSchemaTranslations(schema, [targetLocale], mockAsyncTranslator, {
      overwrite: translationOverwrite,
      createMetadata: (slot) => ({ source: "preview-mock", property: slot.property })
    });
    changeSchema(result.schema);
    setTranslationReport(
      `${result.report.updatedSlots.length} updated / ${result.report.skippedSlots.length} skipped (${translationOverwrite})`
    );
  };

  return (
    <main>
      <nav className="topbar" aria-label={t("preview.language")}>
        <span className="brand">
          <span>FORM</span> ENGINE
        </span>
        <div className="locale-switch">
          <span>{t("preview.language")}</span>
          <button type="button" aria-pressed={locale === "en"} onClick={() => setLocale("en")}>
            EN
          </button>
          <button type="button" aria-pressed={locale === "ja"} onClick={() => setLocale("ja")}>
            日本語
          </button>
        </div>
      </nav>
      <div className="sandbox">
        <div className="tabs" role="tablist" aria-label="Form engine workspace">
          {tabs.map((tab) => (
            <button
              id={`tab-${tab}`}
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={`panel-${tab}`}
              tabIndex={activeTab === tab ? 0 : -1}
              onClick={() => setActiveTab(tab)}
              onKeyDown={(event) => handleTabKeyDown(event, tab)}
            >
              {t(`preview.${tab}`)}
            </button>
          ))}
        </div>
        {loadError === null ? null : (
          <p className="workspace-error" role="alert">
            {loadError}
          </p>
        )}
        {resetStatus === null ? null : (
          <p
            className={`reset-status reset-status--${resetStatus.kind}`}
            role={resetStatus.kind === "error" ? "alert" : "status"}
          >
            {resetStatus.message}
          </p>
        )}
        <div id="panel-builder" role="tabpanel" aria-labelledby="tab-builder" hidden={activeTab !== "builder"}>
          <div className="builder-grid">
            <section className="workspace-card">
              <fieldset className="translation-policy-demo">
                <legend>v2 Translation overwrite policy</legend>
                <label>
                  Overwrite
                  <select
                    value={translationOverwrite}
                    onChange={(event) => setTranslationOverwrite(event.currentTarget.value as "missing-only" | "all")}
                  >
                    <option value="missing-only">missing-only</option>
                    <option value="all">all</option>
                  </select>
                </label>
                <button type="button" disabled={!workspaceReady} onClick={() => void runTranslationPolicyDemo()}>
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
                features={{
                  pages: pagesEnabled,
                  localization: localizationEnabled,
                  conditions: conditionsEnabled
                }}
                {...(useCustomBuilderUi
                  ? {
                      components: previewBuilderComponents,
                      slots: { translationActions: PreviewAiTranslationActions }
                    }
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
              <h2>{t("preview.schemaJson")}</h2>
              <pre>
                <code>{JSON.stringify(schema, null, 2)}</code>
              </pre>
            </section>
          </div>
        </div>
        <div id="panel-respondent" role="tabpanel" aria-labelledby="tab-respondent" hidden={activeTab !== "respondent"}>
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
            </fieldset>
            {lifecycleStatus === null ? null : <p className="lifecycle-status">{lifecycleStatus}</p>}
            <FormProvider schema={schema} locale={locale} translator={mockTranslator} onSubmit={submit} resetOnSuccess>
              <FormRenderer
                successMessageKey="preview.success"
                errorMessageKey="preview.error"
                autoSaveKey={`form-engine-preview-draft:${schema.id}:${schema.version}`}
                beforeSubmit={() => {
                  if (!cancelNextSubmit) return "continue";
                  setCancelNextSubmit(false);
                  setLifecycleStatus("Submission cancelled; values and draft were preserved.");
                  return "cancel";
                }}
                {...(rendererSlots === undefined ? {} : { slots: rendererSlots })}
              />
            </FormProvider>
          </section>
        </div>
        <div id="panel-analytics" role="tabpanel" aria-labelledby="tab-analytics" hidden={activeTab !== "analytics"}>
          <AnalyticsPanel
            analytics={analytics}
            schema={schema}
            submissions={submissions}
            locale={locale}
            onExport={downloadCsv}
            resetControl={
              <ResetResponsesControl
                locale={locale}
                disabled={isClearing || storage.clearResponses === undefined}
                onReset={resetResponses}
              />
            }
          />
        </div>
      </div>
    </main>
  );
}
