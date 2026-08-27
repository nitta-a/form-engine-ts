import {
  aggregateResponses,
  createSubmission,
  exportResponsesToCsvStream,
  type FormSchema,
  type FormStorageAdapter,
  type FormSubmission,
  type FormValues,
  populateSchemaTranslations
} from "@form-engine-ts/core";
import { FormProvider, FormSubmissionError, type FormSuccessRenderMode } from "@form-engine-ts/react";
import { createLocalStorageAdapter } from "@form-engine-ts/storage-localstorage";
import { createMemoryStorageAdapter } from "@form-engine-ts/storage-memory";
import { mockAsyncTranslator, mockTranslator } from "@form-engine-ts/translator-mock";
import { type KeyboardEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AnalyticsPanel } from "./AnalyticsPanel";
import { BuilderPanel } from "./BuilderPanel";
import { MuiPanel } from "./MuiPanel";
import { type ChoiceFieldLayout, ResetResponsesControl, RespondentPanel, type StorageKind } from "./RespondentPanel";
import { customerFeedbackSchema } from "./schema";

type TabId = "builder" | "mui" | "respondent" | "analytics";

const tabs: readonly TabId[] = ["builder", "mui", "respondent", "analytics"];

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
  const [choiceFieldLayout, setChoiceFieldLayout] = useState<ChoiceFieldLayout>("default");
  const [useMuiChoiceGroup, setUseMuiChoiceGroup] = useState(false);
  const [successRenderMode, setSuccessRenderMode] = useState<FormSuccessRenderMode>("append");
  const [cancelNextSubmit, setCancelNextSubmit] = useState(false);
  const [simulateServerError, setSimulateServerError] = useState(false);
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
  const t = (key: string) => mockTranslator.translate(key, locale) ?? key;

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
    if (simulateServerError) {
      setSimulateServerError(false);
      const firstFieldId = schema.fields[0]?.id;
      if (firstFieldId !== undefined) {
        throw new FormSubmissionError("Server validation failed", {
          fieldErrors: { [firstFieldId]: "This value was rejected by the server." },
          formError: "The server rejected this response."
        });
      }
    }
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
          {activeTab === "builder" ? (
            <BuilderPanel
              schema={schema}
              locale={locale}
              workspaceReady={workspaceReady}
              translationOverwrite={translationOverwrite}
              translationReport={translationReport}
              builderActionStatus={builderActionStatus}
              builderReadOnly={builderReadOnly}
              pagesEnabled={pagesEnabled}
              localizationEnabled={localizationEnabled}
              conditionsEnabled={conditionsEnabled}
              useCustomBuilderUi={useCustomBuilderUi}
              onChangeSchema={changeSchema}
              onRunTranslationPolicy={runTranslationPolicyDemo}
              onTranslationOverwriteChange={setTranslationOverwrite}
              onBuilderReadOnlyChange={setBuilderReadOnly}
              onPagesEnabledChange={setPagesEnabled}
              onLocalizationEnabledChange={setLocalizationEnabled}
              onConditionsEnabledChange={setConditionsEnabled}
              onUseCustomBuilderUiChange={setUseCustomBuilderUi}
              onTranslationReport={setTranslationReport}
              onBuilderActionStatus={setBuilderActionStatus}
            />
          ) : null}
        </div>
        <div id="panel-mui" role="tabpanel" aria-labelledby="tab-mui" hidden={activeTab !== "mui"}>
          {activeTab === "mui" ? (
            <MuiPanel
              schema={schema}
              locale={locale}
              builderReadOnly={builderReadOnly}
              pagesEnabled={pagesEnabled}
              localizationEnabled={localizationEnabled}
              conditionsEnabled={conditionsEnabled}
              onChangeSchema={changeSchema}
            />
          ) : null}
        </div>
        <div id="panel-respondent" role="tabpanel" aria-labelledby="tab-respondent" hidden={activeTab !== "respondent"}>
          <FormProvider schema={schema} locale={locale} translator={mockTranslator} onSubmit={submit} resetOnSuccess>
            {activeTab === "respondent" ? (
              <RespondentPanel
                schema={schema}
                locale={locale}
                storageKind={storageKind}
                storage={storage}
                isClearing={isClearing}
                useCustomSlots={useCustomSlots}
                cancelNextSubmit={cancelNextSubmit}
                successRenderMode={successRenderMode}
                simulateServerError={simulateServerError}
                choiceFieldLayout={choiceFieldLayout}
                useMuiChoiceGroup={useMuiChoiceGroup}
                lifecycleStatus={lifecycleStatus}
                onStorageKindChange={setStorageKind}
                onResetResponses={resetResponses}
                onUseCustomSlotsChange={setUseCustomSlots}
                onCancelNextSubmitChange={setCancelNextSubmit}
                onSuccessRenderModeChange={setSuccessRenderMode}
                onSimulateServerErrorChange={setSimulateServerError}
                onChoiceFieldLayoutChange={setChoiceFieldLayout}
                onUseMuiChoiceGroupChange={setUseMuiChoiceGroup}
                onLifecycleStatusChange={setLifecycleStatus}
              />
            ) : null}
          </FormProvider>
        </div>
        <div id="panel-analytics" role="tabpanel" aria-labelledby="tab-analytics" hidden={activeTab !== "analytics"}>
          {activeTab === "analytics" ? (
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
          ) : null}
        </div>
      </div>
    </main>
  );
}
