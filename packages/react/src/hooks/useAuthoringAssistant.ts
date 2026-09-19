import {
  type AuthoringApplyResult,
  type AuthoringAssistantAdapter,
  type AuthoringPreview,
  type AuthoringRequest,
  type AuthoringSuggestion,
  applyAuthoringSuggestion,
  computeAuthoringSchemaHash,
  type FormPolicy,
  type FormSchema,
  previewAuthoringSuggestion
} from "@form-engine-ts/core";
import { useCallback, useEffect, useRef, useState } from "react";

export type AuthoringAssistantStatus = "idle" | "generating" | "ready" | "applying" | "error";
export type AuthoringAssistantError =
  | { readonly code: "cancelled"; readonly cause?: unknown }
  | { readonly code: "provider_failure"; readonly cause: unknown }
  | { readonly code: "invalid_response"; readonly cause: unknown }
  | { readonly code: "validation_failure"; readonly cause: AuthoringApplyResult }
  | { readonly code: "stale_schema"; readonly cause: AuthoringApplyResult };

export interface UseAuthoringAssistantOptions {
  readonly schema: FormSchema;
  readonly adapter: AuthoringAssistantAdapter;
  readonly policy?: FormPolicy;
  readonly onChange: (schema: FormSchema) => void;
  readonly idFactory?: (kind: "field" | "option", existingIds: ReadonlySet<string>) => string;
}

export interface UseAuthoringAssistantResult {
  readonly status: AuthoringAssistantStatus;
  readonly suggestion?: AuthoringSuggestion;
  readonly preview?: AuthoringPreview;
  readonly error?: AuthoringAssistantError;
  readonly suggest: (request: AuthoringRequest) => Promise<AuthoringSuggestion | undefined>;
  readonly apply: (operationIds?: readonly string[]) => AuthoringApplyResult | undefined;
  readonly reject: () => void;
  readonly cancel: () => void;
}

export function useAuthoringAssistant(options: UseAuthoringAssistantOptions): UseAuthoringAssistantResult {
  const { schema, adapter, policy, onChange, idFactory } = options;
  const [status, setStatus] = useState<AuthoringAssistantStatus>("idle");
  const [suggestion, setSuggestion] = useState<AuthoringSuggestion>();
  const [preview, setPreview] = useState<AuthoringPreview>();
  const [error, setError] = useState<AuthoringAssistantError>();
  const controller = useRef<AbortController | undefined>(undefined);
  const requestId = useRef(0);
  const schemaHash = computeAuthoringSchemaHash(schema);

  useEffect(() => {
    if (suggestion !== undefined && suggestion.baseSchemaHash !== schemaHash) setPreview(undefined);
  }, [schemaHash, suggestion]);

  const cancel = useCallback(() => {
    const active = controller.current !== undefined;
    requestId.current += 1;
    controller.current?.abort();
    controller.current = undefined;
    if (active) {
      setStatus("idle");
      setError({ code: "cancelled" });
    }
  }, []);

  const suggest = useCallback(
    async (request: AuthoringRequest): Promise<AuthoringSuggestion | undefined> => {
      controller.current?.abort();
      const nextController = new AbortController();
      const nextRequestId = ++requestId.current;
      controller.current = nextController;
      setStatus("generating");
      setError(undefined);
      setSuggestion(undefined);
      setPreview(undefined);
      try {
        const generate = adapter.generate ?? adapter.generateSuggestion;
        if (generate === undefined) throw new TypeError("Authoring adapter must provide generate().");
        const next = await generate({ ...request, schema }, nextController.signal);
        if (nextController.signal.aborted || requestId.current !== nextRequestId) return undefined;
        if (
          next === null ||
          typeof next !== "object" ||
          typeof next.id !== "string" ||
          typeof next.summary !== "string" ||
          typeof next.baseSchemaHash !== "string" ||
          !Array.isArray(next.operations)
        ) {
          setStatus("error");
          setError({ code: "invalid_response", cause: next });
          return undefined;
        }
        const nextPreview = previewAuthoringSuggestion(schema, next, policy);
        controller.current = undefined;
        setSuggestion(next);
        setPreview(nextPreview);
        if (!nextPreview.valid) {
          setStatus("error");
          setError({
            code: "validation_failure",
            cause: { success: false, error: { code: "validation_failed", issues: nextPreview.issues } }
          });
        } else setStatus("ready");
        return next;
      } catch (cause) {
        if (requestId.current !== nextRequestId) return undefined;
        controller.current = undefined;
        if (nextController.signal.aborted) {
          setStatus("idle");
          setError({ code: "cancelled", cause });
          return undefined;
        }
        setStatus("error");
        setError({ code: "provider_failure", cause });
        return undefined;
      }
    },
    [adapter, policy, schema]
  );

  const apply = useCallback(
    (operationIds?: readonly string[]): AuthoringApplyResult | undefined => {
      if (suggestion === undefined) return undefined;
      setStatus("applying");
      const result = applyAuthoringSuggestion(schema, suggestion, operationIds, {
        ...(policy === undefined ? {} : { policy }),
        ...(idFactory === undefined ? {} : { idFactory })
      });
      if (result.success) {
        onChange(result.schema);
        setStatus("idle");
        setSuggestion(undefined);
        setPreview(undefined);
      } else {
        setStatus("error");
        setError({ code: result.error.code === "stale_schema" ? "stale_schema" : "validation_failure", cause: result });
      }
      return result;
    },
    [idFactory, onChange, policy, schema, suggestion]
  );

  const reject = useCallback(() => {
    setSuggestion(undefined);
    setPreview(undefined);
    setError(undefined);
    setStatus("idle");
  }, []);

  return {
    status,
    ...(suggestion === undefined ? {} : { suggestion }),
    ...(preview === undefined ? {} : { preview }),
    ...(error === undefined ? {} : { error }),
    suggest,
    apply,
    reject,
    cancel
  };
}
