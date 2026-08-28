import {
  aggregateResponses,
  createSubmission,
  exportResponsesToCsvStream,
  type FormSchema,
  type FormStorageAdapter,
  type FormSubmission,
  type FormValues
} from "@form-engine-ts/core";
import { FormSubmissionError, type SubmitContext } from "@form-engine-ts/react";
import { createLocalStorageAdapter } from "@form-engine-ts/storage-localstorage";
import { createMemoryStorageAdapter } from "@form-engine-ts/storage-memory";
import { mockTranslator } from "@form-engine-ts/translator-mock";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
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
  readonly simulateServerError: boolean;
  readonly setLocale: (locale: string) => void;
  readonly setStorageKind: (kind: StorageKind) => void;
  readonly setSimulateServerError: (value: boolean) => void;
  readonly changeSchema: (schema: FormSchema) => void;
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
  const [locale, setLocale] = useState("en");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [simulateServerError, setSimulateServerError] = useState(false);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [resetStatus, setResetStatus] = useState<{
    readonly kind: "success" | "error";
    readonly message: string;
  } | null>(null);
  const storage: FormStorageAdapter = storageKind === "memory" ? memoryStorage : localStorage;
  const analytics = useMemo(() => aggregateResponses(schema, submissions), [schema, submissions]);

  const translate = useCallback((key: string) => mockTranslator.translate(key, locale) ?? key, [locale]);

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

  const changeSchema = useCallback(
    (nextSchema: FormSchema) => {
      setSchema(nextSchema);
      setResetStatus(null);
      void storage
        .saveSchema(nextSchema)
        .catch((cause: unknown) => setLoadError(cause instanceof Error ? cause.message : String(cause)));
    },
    [storage]
  );

  const submit = useCallback(
    async (values: FormValues, context: SubmitContext) => {
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
        locale: context.locale ?? locale,
        submittedAt: context.submittedAt,
        metadata: { source: "preview", storage: storageKind }
      });
      await storage.saveSubmission(submission);
      setSubmissions(await storage.listSubmissions(schema.id, schema.version));
    },
    [locale, schema, simulateServerError, storage, storageKind]
  );

  const downloadCsv = useCallback(async () => {
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
  }, [schema, submissions]);

  const resetResponses = useCallback(async () => {
    const previousSubmissions = submissions;
    setIsClearing(true);
    setResetStatus(null);
    setSubmissions([]);
    try {
      if (storage.clearResponses === undefined) throw new Error(translate("preview.resetUnavailable"));
      await storage.clearResponses(schema.id);
      setSubmissions(await storage.listSubmissions(schema.id, schema.version));
      setResetStatus({ kind: "success", message: translate("preview.resetSuccess") });
    } catch (cause) {
      setSubmissions(previousSubmissions);
      setResetStatus({
        kind: "error",
        message: `${translate("preview.resetError")}${cause instanceof Error ? ` ${cause.message}` : ""}`
      });
    } finally {
      setIsClearing(false);
    }
  }, [schema, storage, submissions, translate]);

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
      simulateServerError,
      setLocale,
      setStorageKind,
      setSimulateServerError,
      changeSchema,
      submit,
      downloadCsv,
      resetResponses
    }),
    [
      analytics,
      changeSchema,
      downloadCsv,
      isClearing,
      loadError,
      locale,
      resetResponses,
      resetStatus,
      schema,
      simulateServerError,
      storage,
      storageKind,
      submissions,
      submit,
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
