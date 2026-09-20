import {
  type AuthoringApplyResult,
  type AuthoringAssistantAdapter,
  type AuthoringPreview,
  type AuthoringRequest,
  type AuthoringSuggestion,
  applyAuthoringSuggestion,
  buildAuthoringContext,
  type CreationAssistantAdapter,
  type CreationAssistantResponse,
  type CreationMessage,
  type CreationQuickReply,
  canGenerateCreationDraft,
  computeAuthoringSchemaHash,
  type FormPolicy,
  type FormSchema,
  getFormContentMode,
  type JsonValue,
  mergeSurveyCreationBrief,
  parseAuthoringSuggestion,
  parseCreationAssistantResponse,
  previewAuthoringSuggestion,
  type SurveyCreationBrief
} from "@form-engine-ts/core";
import { useCallback, useEffect, useRef, useState } from "react";

export type CreationAssistantStatus =
  | "idle"
  | "collecting"
  | "responding"
  | "ready"
  | "generating"
  | "reviewing"
  | "applying"
  | "completed"
  | "error";

export type CreationAssistantErrorCode =
  | "provider_unavailable"
  | "network_error"
  | "invalid_response"
  | "policy_violation"
  | "stale_schema"
  | "rate_limit"
  | "aborted";

export interface CreationAssistantError {
  readonly code: CreationAssistantErrorCode;
  readonly cause?: unknown;
}

export interface UseFormCreationAssistantOptions {
  readonly creationAdapter: CreationAssistantAdapter;
  readonly authoringAdapter: AuthoringAssistantAdapter;
  readonly initialSchema: FormSchema;
  readonly policy?: FormPolicy;
  readonly maxClarificationTurns?: number;
  readonly onComplete?: (schema: FormSchema) => void;
}

export interface UseFormCreationAssistantResult {
  readonly messages: readonly CreationMessage[];
  readonly brief: SurveyCreationBrief;
  readonly status: CreationAssistantStatus;
  readonly schema: FormSchema;
  readonly suggestion?: AuthoringSuggestion;
  readonly preview?: AuthoringPreview;
  readonly error?: CreationAssistantError;
  readonly clarificationTurns: number;
  readonly quickReplies: readonly CreationQuickReply[];
  readonly canGenerate: boolean;
  readonly sendMessage: (message: string) => Promise<CreationAssistantResponse | undefined>;
  readonly retry: () => Promise<CreationAssistantResponse | undefined>;
  readonly generateDraft: () => Promise<AuthoringSuggestion | undefined>;
  readonly reviseDraft: (request: AuthoringRequest) => Promise<AuthoringSuggestion | undefined>;
  readonly applySuggestion: () => AuthoringApplyResult | undefined;
  readonly cancel: () => void;
  readonly reset: () => void;
}

function errorCode(cause: unknown): CreationAssistantErrorCode {
  if (cause instanceof TypeError && /Invalid (creation assistant response|authoring suggestion)/i.test(cause.message))
    return "invalid_response";
  if (cause instanceof Error && /429|rate limit/i.test(cause.message)) return "rate_limit";
  if (cause instanceof Error && /network|fetch|timeout/i.test(cause.message)) return "network_error";
  return "provider_unavailable";
}

function validationError(preview: AuthoringPreview): CreationAssistantErrorCode {
  if (preview.issues.some((issue) => issue.code === "stale_schema")) return "stale_schema";
  if (
    preview.issues.some(
      (issue) => issue.code === "policy_violation" || issue.code === "schema_invalid" || issue.code.includes("exceeded")
    )
  )
    return "policy_violation";
  return "invalid_response";
}

function briefContext(brief: SurveyCreationBrief): JsonValue {
  return {
    ...(brief.purpose === undefined ? {} : { purpose: brief.purpose }),
    ...(brief.audience === undefined ? {} : { audience: brief.audience }),
    ...(brief.goals === undefined ? {} : { goals: brief.goals }),
    ...(brief.constraints === undefined ? {} : { constraints: brief.constraints }),
    ...(brief.locale === undefined ? {} : { locale: brief.locale }),
    ...(brief.contentMode === undefined ? {} : { contentMode: brief.contentMode }),
    ...(brief.notes === undefined ? {} : { notes: brief.notes })
  };
}

export function useFormCreationAssistant(options: UseFormCreationAssistantOptions): UseFormCreationAssistantResult {
  const { creationAdapter, authoringAdapter, initialSchema, policy, maxClarificationTurns = 3, onComplete } = options;
  const [messages, setMessages] = useState<readonly CreationMessage[]>([]);
  const [brief, setBrief] = useState<SurveyCreationBrief>({});
  const [status, setStatus] = useState<CreationAssistantStatus>("idle");
  const [schema, setSchema] = useState(initialSchema);
  const [suggestion, setSuggestion] = useState<AuthoringSuggestion>();
  const [preview, setPreview] = useState<AuthoringPreview>();
  const [error, setError] = useState<CreationAssistantError>();
  const [clarificationTurns, setClarificationTurns] = useState(0);
  const [quickReplies, setQuickReplies] = useState<readonly CreationQuickReply[]>([]);
  const controller = useRef<AbortController | undefined>(undefined);
  const requestId = useRef(0);

  useEffect(() => {
    return () => {
      requestId.current += 1;
      controller.current?.abort();
    };
  }, []);

  const cancel = useCallback(() => {
    controller.current?.abort();
    controller.current = undefined;
    setStatus(messages.length === 0 ? "idle" : "collecting");
  }, [messages.length]);

  const sendMessage = useCallback(
    async (message: string): Promise<CreationAssistantResponse | undefined> => {
      const latestMessage = message.trim();
      if (latestMessage.length === 0) return undefined;
      controller.current?.abort();
      const nextController = new AbortController();
      const nextRequestId = ++requestId.current;
      controller.current = nextController;
      const nextMessages = [...messages, { role: "user" as const, content: latestMessage }];
      const nextTurns = clarificationTurns + 1;
      setMessages(nextMessages);
      setClarificationTurns(nextTurns);
      setStatus("responding");
      setError(undefined);
      try {
        const raw = await creationAdapter.respond(
          {
            latestMessage,
            brief,
            messages: nextMessages,
            ...((brief.locale ?? initialSchema.defaultLocale) === undefined
              ? {}
              : { locale: brief.locale ?? initialSchema.defaultLocale }),
            contentMode: brief.contentMode ?? getFormContentMode(initialSchema.metadata),
            ...(policy === undefined ? {} : { policy })
          },
          nextController.signal
        );
        if (nextController.signal.aborted || requestId.current !== nextRequestId) return undefined;
        const response = parseCreationAssistantResponse(raw);
        const nextBrief = mergeSurveyCreationBrief(brief, response.brief);
        setBrief(nextBrief);
        setMessages([...nextMessages, { role: "assistant", content: response.message }]);
        setQuickReplies(response.type === "clarification" ? (response.suggestions ?? []) : []);
        const ready =
          response.type === "ready" || canGenerateCreationDraft(nextBrief, nextTurns, maxClarificationTurns);
        setStatus(ready ? "ready" : "collecting");
        controller.current = undefined;
        return response;
      } catch (cause) {
        if (requestId.current !== nextRequestId) return undefined;
        controller.current = undefined;
        if (nextController.signal.aborted) return undefined;
        setStatus("error");
        setError({ code: errorCode(cause), cause });
        return undefined;
      }
    },
    [brief, clarificationTurns, creationAdapter, initialSchema, maxClarificationTurns, messages, policy]
  );

  const runAuthoring = useCallback(
    async (request: AuthoringRequest): Promise<AuthoringSuggestion | undefined> => {
      controller.current?.abort();
      const nextController = new AbortController();
      const nextRequestId = ++requestId.current;
      controller.current = nextController;
      setStatus("generating");
      setError(undefined);
      try {
        const response = await authoringAdapter.generate(
          {
            ...request,
            context: buildAuthoringContext({ schema, request, ...(policy === undefined ? {} : { policy }) })
          },
          nextController.signal
        );
        if (nextController.signal.aborted || requestId.current !== nextRequestId) return undefined;
        const nextSuggestion = parseAuthoringSuggestion(response);
        const nextPreview = previewAuthoringSuggestion(schema, nextSuggestion, {
          ...(policy === undefined ? {} : { policy })
        });
        setSuggestion(nextSuggestion);
        setPreview(nextPreview);
        controller.current = undefined;
        if (!nextPreview.valid) {
          setStatus("error");
          setError({ code: validationError(nextPreview), cause: nextPreview });
          return undefined;
        }
        setSchema(nextPreview.schema);
        setStatus("reviewing");
        return nextSuggestion;
      } catch (cause) {
        if (requestId.current !== nextRequestId) return undefined;
        controller.current = undefined;
        if (nextController.signal.aborted) return undefined;
        setStatus("error");
        setError({ code: errorCode(cause), cause });
        return undefined;
      }
    },
    [authoringAdapter, policy, schema]
  );

  const generateDraft = useCallback(async () => {
    if (!canGenerateCreationDraft(brief, clarificationTurns, maxClarificationTurns)) return undefined;
    return runAuthoring({
      intent: "generate_form",
      ...(brief.purpose === undefined ? {} : { prompt: brief.purpose }),
      context: { creationBrief: briefContext(brief) }
    });
  }, [brief, clarificationTurns, maxClarificationTurns, runAuthoring]);

  const reviseDraft = useCallback((request: AuthoringRequest) => runAuthoring(request), [runAuthoring]);

  const retry = useCallback(async () => {
    const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
    return lastUserMessage === undefined ? undefined : sendMessage(lastUserMessage.content);
  }, [messages, sendMessage]);

  const applySuggestion = useCallback((): AuthoringApplyResult | undefined => {
    if (suggestion === undefined) return undefined;
    setStatus("applying");
    const sourceSchema =
      suggestion.baseSchemaHash === computeAuthoringSchemaHash(initialSchema) ? initialSchema : schema;
    const result = applyAuthoringSuggestion(
      sourceSchema,
      suggestion,
      undefined,
      policy === undefined ? {} : { policy }
    );
    if (!result.success) {
      setStatus("error");
      setError({ code: result.error.code === "stale_schema" ? "stale_schema" : "policy_violation", cause: result });
      return result;
    }
    setSchema(result.schema);
    setStatus("completed");
    onComplete?.(result.schema);
    return result;
  }, [initialSchema, onComplete, policy, schema, suggestion]);

  const reset = useCallback(() => {
    controller.current?.abort();
    controller.current = undefined;
    setMessages([]);
    setBrief({});
    setStatus("idle");
    setSchema(initialSchema);
    setSuggestion(undefined);
    setPreview(undefined);
    setError(undefined);
    setClarificationTurns(0);
    setQuickReplies([]);
  }, [initialSchema]);

  const canGenerate = canGenerateCreationDraft(brief, clarificationTurns, maxClarificationTurns);
  return {
    messages,
    brief,
    status,
    schema,
    ...(suggestion === undefined ? {} : { suggestion }),
    ...(preview === undefined ? {} : { preview }),
    ...(error === undefined ? {} : { error }),
    clarificationTurns,
    quickReplies,
    canGenerate,
    sendMessage,
    retry,
    generateDraft,
    reviseDraft,
    applySuggestion,
    cancel,
    reset
  };
}
