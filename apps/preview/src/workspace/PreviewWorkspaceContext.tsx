import {
  aggregateInteractionEvents,
  aggregateResponses,
  createSubmission,
  exportResponsesToCsvStream,
  type FormInteractionEvent,
  type FormSchema,
  type FormStorageAdapter,
  type FormSubmission,
  FormSubmissionError,
  type FormTelemetryAdapter,
  type FormValues
} from "@form-engine-ts/core";
import type { SubmitContext } from "@form-engine-ts/react";
import { createLocalStorageAdapter } from "@form-engine-ts/storage-localstorage";
import { createMemoryStorageAdapter } from "@form-engine-ts/storage-memory";
import { mockTranslator } from "@form-engine-ts/translator-mock";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { customerFeedbackSchema } from "./schema";

export type StorageKind = "memory" | "local";

export interface PreviewWorkspaceContextValue {
  readonly schema: FormSchema;
  readonly submissions: readonly FormSubmission[];
  readonly locale: string;
  readonly storageKind: StorageKind;
  readonly storage: FormStorageAdapter;
  readonly workspaceReady: boolean;
  readonly loadError: string | null;
  readonly isClearing: boolean;
  readonly resetStatus: { readonly kind: "success" | "error"; readonly message: string } | null;
  readonly analytics: ReturnType<typeof aggregateResponses>;
  readonly interactionEvents: readonly FormInteractionEvent[];
  readonly interactionAnalytics: ReturnType<typeof aggregateInteractionEvents>;
  readonly telemetryAdapter: FormTelemetryAdapter;
  readonly simulateServerError: boolean;
  readonly setLocale: (locale: string) => void;
  readonly setStorageKind: (kind: StorageKind) => void;
  readonly setSimulateServerError: (value: boolean) => void;
  readonly changeSchema: (schema: FormSchema) => void;
  readonly openSchema: (schema: FormSchema) => Promise<void>;
  readonly submit: (values: FormValues, context: SubmitContext) => Promise<void>;
  readonly downloadCsv: () => Promise<void>;
  readonly resetResponses: () => Promise<void>;
}

const PreviewWorkspaceContext = createContext<PreviewWorkspaceContextValue | null>(null);

export function PreviewWorkspaceProvider({ children }: { readonly children: ReactNode }) {
  const memoryStorage = useMemo(() => createMemoryStorageAdapter(), []);
  const localStorage = useMemo(() => createLocalStorageAdapter("form-engine-preview_"), []);
  const [storageKind, setStorageKind] = useState<StorageKind>("memory");
  const [schema, setSchema] = useState<FormSchema>(customerFeedbackSchema);
  const [submissions, setSubmissions] = useState<readonly FormSubmission[]>([]);
  const [interactionEvents, setInteractionEvents] = useState<readonly FormInteractionEvent[]>([]);
  const [locale, setLocale] = useState("en");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [simulateServerError, setSimulateServerError] = useState(false);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const workspaceGeneration = useRef(0);
  const selectedSchema = useRef<FormSchema>(customerFeedbackSchema);
  const [resetStatus, setResetStatus] = useState<{
    readonly kind: "success" | "error";
    readonly message: string;
  } | null>(null);
  const storage: FormStorageAdapter = storageKind === "memory" ? memoryStorage : localStorage;
  const analytics = useMemo(() => aggregateResponses(schema, submissions), [schema, submissions]);
  const telemetryAdapter = useMemo<FormTelemetryAdapter>(
    () => ({
      track: (event) => {
        const currentSchema = selectedSchema.current;
        if (event.formId !== currentSchema.id || event.formVersion !== currentSchema.version) return;
        setInteractionEvents((current) => [...current, event]);
      }
    }),
    []
  );
  const interactionAnalytics = useMemo(() => aggregateInteractionEvents(interactionEvents), [interactionEvents]);

  const translate = useCallback((key: string) => mockTranslator.translate(key, locale) ?? key, [locale]);

  const loadWorkspace = useCallback(async (adapter: FormStorageAdapter) => {
    const generation = ++workspaceGeneration.current;
    setWorkspaceReady(false);
    try {
      const currentSchema = selectedSchema.current;
      const stored = await adapter.getSchema(currentSchema.id, currentSchema.version);
      const nextSchema = stored ?? currentSchema;
      if (stored === null) await adapter.saveSchema(nextSchema);
      const nextSubmissions = await adapter.listSubmissions(nextSchema.id, nextSchema.version);
      if (generation !== workspaceGeneration.current) return;
      setSchema(nextSchema);
      selectedSchema.current = nextSchema;
      setSubmissions(nextSubmissions);
      setInteractionEvents([]);
      setLoadError(null);
      setResetStatus(null);
      setIsClearing(false);
    } catch (cause) {
      if (generation !== workspaceGeneration.current) return;
      setSubmissions([]);
      setLoadError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (generation === workspaceGeneration.current) setWorkspaceReady(true);
    }
  }, []);

  useEffect(() => {
    void loadWorkspace(storage);
    return () => {
      workspaceGeneration.current++;
    };
  }, [loadWorkspace, storage]);

  const openSchema = useCallback(
    async (nextSchema: FormSchema) => {
      const generation = ++workspaceGeneration.current;
      setWorkspaceReady(false);
      try {
        await storage.saveSchema(nextSchema);
        const nextSubmissions = await storage.listSubmissions(nextSchema.id, nextSchema.version);
        if (generation !== workspaceGeneration.current) return;
        setSchema(nextSchema);
        selectedSchema.current = nextSchema;
        setSubmissions(nextSubmissions);
        setInteractionEvents([]);
        setResetStatus(null);
        setIsClearing(false);
        setLoadError(null);
      } catch (cause) {
        if (generation === workspaceGeneration.current) {
          setLoadError(cause instanceof Error ? cause.message : String(cause));
        }
        throw cause;
      } finally {
        if (generation === workspaceGeneration.current) setWorkspaceReady(true);
      }
    },
    [storage]
  );

  const changeSchema = useCallback(
    (nextSchema: FormSchema) => {
      if (nextSchema.id !== schema.id || nextSchema.version !== schema.version) {
        void openSchema(nextSchema).catch(() => undefined);
        return;
      }
      setSchema(nextSchema);
      selectedSchema.current = nextSchema;
      setInteractionEvents([]);
      setResetStatus(null);
      const generation = workspaceGeneration.current;
      void storage.saveSchema(nextSchema).catch((cause: unknown) => {
        if (generation === workspaceGeneration.current) {
          setLoadError(cause instanceof Error ? cause.message : String(cause));
        }
      });
    },
    [openSchema, schema.id, schema.version, storage]
  );

  const submit = useCallback(
    async (values: FormValues, context: SubmitContext) => {
      const generation = workspaceGeneration.current;
      if (!workspaceReady || loadError !== null) {
        throw new Error(
          locale.startsWith("ja") ? "フォームの読み込みを確認してください。" : "Check the form loading status."
        );
      }
      setResetStatus(null);
      if (simulateServerError) {
        setSimulateServerError(false);
        const firstFieldId = schema.fields[0]?.id;
        if (firstFieldId !== undefined) {
          throw new FormSubmissionError({
            code: "VALIDATION_FAILED",
            messageKey: "submission.validation",
            fieldErrors: { [firstFieldId]: "This value was rejected by the server." },
            formErrors: ["The server rejected this response."]
          });
        }
      }
      const submission = createSubmission(schema, values, {
        id: globalThis.crypto.randomUUID(),
        locale: context.locale ?? locale,
        submittedAt: context.submittedAt,
        metadata: { source: "preview", storage: storageKind }
      });
      await storage.saveSubmission(submission);
      if (generation !== workspaceGeneration.current) return;
      const nextSubmissions = await storage.listSubmissions(schema.id, schema.version);
      if (generation === workspaceGeneration.current) setSubmissions(nextSubmissions);
    },
    [loadError, locale, schema, simulateServerError, storage, storageKind, workspaceReady]
  );

  const downloadCsv = useCallback(async () => {
    async function* submissionStream() {
      for (const submission of submissions) yield submission;
    }
    const chunks: string[] = [];
    for await (const chunk of exportResponsesToCsvStream(schema, submissionStream())) {
      chunks.push(chunk);
    }
    const csv = chunks.join("");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${schema.id}-${schema.version}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [schema, submissions]);

  const resetResponses = useCallback(async () => {
    const generation = workspaceGeneration.current;
    const previousSubmissions = submissions;
    const previousEvents = interactionEvents;
    setIsClearing(true);
    setResetStatus(null);
    setSubmissions([]);
    setInteractionEvents([]);
    try {
      if (storage.clearResponses === undefined) throw new Error(translate("preview.resetUnavailable"));
      await storage.clearResponses(schema.id);
      const nextSubmissions = await storage.listSubmissions(schema.id, schema.version);
      if (generation !== workspaceGeneration.current) return;
      setSubmissions(nextSubmissions);
      setResetStatus({ kind: "success", message: translate("preview.resetSuccess") });
    } catch (cause) {
      if (generation !== workspaceGeneration.current) return;
      setSubmissions(previousSubmissions);
      setInteractionEvents(previousEvents);
      setResetStatus({
        kind: "error",
        message: `${translate("preview.resetError")}${cause instanceof Error ? ` ${cause.message}` : ""}`
      });
    } finally {
      if (generation === workspaceGeneration.current) setIsClearing(false);
    }
  }, [interactionEvents, schema, storage, submissions, translate]);

  const contextValue = useMemo<PreviewWorkspaceContextValue>(
    () => ({
      schema,
      submissions,
      locale,
      storageKind,
      storage,
      workspaceReady,
      loadError,
      isClearing,
      resetStatus,
      analytics,
      interactionAnalytics,
      interactionEvents,
      telemetryAdapter,
      simulateServerError,
      setLocale,
      setStorageKind,
      setSimulateServerError,
      changeSchema,
      openSchema,
      submit,
      downloadCsv,
      resetResponses
    }),
    [
      analytics,
      changeSchema,
      downloadCsv,
      isClearing,
      interactionAnalytics,
      interactionEvents,
      loadError,
      locale,
      openSchema,
      resetResponses,
      resetStatus,
      schema,
      simulateServerError,
      storage,
      storageKind,
      submissions,
      submit,
      telemetryAdapter,
      workspaceReady
    ]
  );

  return <PreviewWorkspaceContext.Provider value={contextValue}>{children}</PreviewWorkspaceContext.Provider>;
}

export function usePreviewWorkspace(): PreviewWorkspaceContextValue {
  const context = useContext(PreviewWorkspaceContext);
  if (context === null) throw new Error("usePreviewWorkspace must be called inside a PreviewWorkspaceProvider.");
  return context;
}
