import {
  aggregateResponses,
  calculateFieldVisibility,
  createSubmission,
  exportResponsesToCsv,
  type FormAnalytics,
  type FormSchema,
  type FormStorageAdapter,
  type FormSubmission,
  type FormValues,
  type QuestionAggregate
} from "@form-engine/core";
import { FormBuilder, FormProvider, FormRenderer } from "@form-engine/react";
import { createLocalStorageAdapter } from "@form-engine/storage-localstorage";
import { createMemoryStorageAdapter } from "@form-engine/storage-memory";
import { mockTranslator } from "@form-engine/translator-mock";
import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { customerFeedbackSchema } from "./schema";

type TabId = "builder" | "respondent" | "analytics";
type StorageKind = "memory" | "local";

const tabs: readonly TabId[] = ["builder", "respondent", "analytics"];

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
            field !== undefined && "options" in field
              ? field.options.find((item) => item.value === option.value)
              : undefined;
          return (
            <OptionBar
              key={option.value}
              label={schemaOption === undefined ? option.value : t(schemaOption.labelKey)}
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
  readonly onExport: () => void;
  readonly resetControl: ReactNode;
}) {
  const t = (key: string) => mockTranslator.translate(key, locale);
  const textFields = schema.fields.filter((field) => field.type === "text" || field.type === "textarea");
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
        <button className="primary-action" type="button" onClick={onExport}>
          {t("preview.export")}
        </button>
        {resetControl}
      </div>
      {analytics.submissionCount === 0 ? (
        <p className="empty-state">{t("preview.noResponses")}</p>
      ) : (
        <div className="analytics-grid">
          <div className="question-results">
            {analytics.questions.map((aggregate) => {
              const field = schema.fields.find((item) => item.id === aggregate.fieldId);
              return (
                <section className="question-result" key={aggregate.fieldId}>
                  <h3>{field === undefined ? aggregate.fieldId : t(field.labelKey)}</h3>
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
                  <h4>{t(field.labelKey)}</h4>
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
    void loadWorkspace(storage);
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
      submittedAt: new Date().toISOString()
    });
    await storage.saveSubmission(submission);
    setSubmissions(await storage.listSubmissions(schema.id, schema.version));
  };

  const downloadCsv = () => {
    const csv = exportResponsesToCsv(schema, submissions);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
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
              <FormBuilder schema={schema} onChange={changeSchema} />
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
            <FormProvider schema={schema} locale={locale} translator={mockTranslator} onSubmit={submit} resetOnSuccess>
              <FormRenderer successMessageKey="preview.success" errorMessageKey="preview.error" />
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
