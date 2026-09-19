import {
  type AuthoringApplyResult,
  type AuthoringAssistantAdapter,
  type AuthoringPreview,
  type AuthoringRequest,
  type AuthoringSuggestion,
  applyAuthoringSuggestion,
  buildAuthoringContext,
  computeAuthoringSchemaHash,
  type FormPolicy,
  type FormSchema,
  parseAuthoringSuggestion,
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
  readonly isStale: boolean;
  readonly selectedOperationIds: readonly string[];
  readonly setSelectedOperationIds: (operationIds: readonly string[]) => void;
  readonly toggleOperation: (operationId: string) => void;
  readonly selectAll: () => void;
  readonly clearSelection: () => void;
  readonly applySelected: () => AuthoringApplyResult | undefined;
  readonly error?: AuthoringAssistantError;
  readonly suggest: (request: AuthoringRequest) => Promise<AuthoringSuggestion | undefined>;
  readonly apply: (operationIds?: readonly string[]) => AuthoringApplyResult | undefined;
  readonly reject: () => void;
  readonly cancel: () => void;
}

function validOperationIds(preview: AuthoringPreview): readonly string[] {
  return preview.operationPreviews.filter((item) => item.valid).map((item) => item.operationId);
}

export function useAuthoringAssistant(options: UseAuthoringAssistantOptions): UseAuthoringAssistantResult {
  const { schema, adapter, policy, onChange, idFactory } = options;
  const [status, setStatus] = useState<AuthoringAssistantStatus>("idle");
  const [suggestion, setSuggestion] = useState<AuthoringSuggestion>();
  const [preview, setPreview] = useState<AuthoringPreview>();
  const [error, setError] = useState<AuthoringAssistantError>();
  const [selectedOperationIds, setSelectedOperationIdsState] = useState<readonly string[]>([]);
  const controller = useRef<AbortController | undefined>(undefined);
  const requestId = useRef(0);
  const schemaHash = computeAuthoringSchemaHash(schema);
  const isStale = suggestion !== undefined && suggestion.baseSchemaHash !== schemaHash;

  useEffect(() => {
    return () => {
      requestId.current += 1;
      controller.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (suggestion === undefined || suggestion.baseSchemaHash === schemaHash) return;
    const stalePreview = previewAuthoringSuggestion(schema, suggestion, {
      operationIds: selectedOperationIds,
      ...(policy === undefined ? {} : { policy })
    });
    setPreview(stalePreview);
    setStatus("error");
    setError({
      code: "stale_schema",
      cause: {
        success: false,
        error: { code: "stale_schema", issues: stalePreview.issues }
      }
    });
  }, [policy, schema, schemaHash, selectedOperationIds, suggestion]);

  const setSelectedOperationIds = useCallback(
    (operationIds: readonly string[]) => {
      setSelectedOperationIdsState(operationIds);
      if (suggestion !== undefined) {
        const nextPreview = previewAuthoringSuggestion(schema, suggestion, {
          operationIds,
          ...(policy === undefined ? {} : { policy })
        });
        setPreview(nextPreview);
        if (nextPreview.valid) {
          setStatus("ready");
          setError(undefined);
        } else {
          setStatus("error");
          setError({
            code: "validation_failure",
            cause: { success: false, error: { code: "validation_failed", issues: nextPreview.issues } }
          });
        }
      }
    },
    [policy, schema, suggestion]
  );

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
      setSelectedOperationIdsState([]);
      try {
        const nextResponse = await adapter.generate(
          {
            ...request,
            context: buildAuthoringContext({ schema, request, ...(policy === undefined ? {} : { policy }) })
          },
          nextController.signal
        );
        if (nextController.signal.aborted || requestId.current !== nextRequestId) return undefined;
        let next: AuthoringSuggestion;
        try {
          next = parseAuthoringSuggestion(nextResponse);
        } catch (cause) {
          setStatus("error");
          setError({ code: "invalid_response", cause });
          return undefined;
        }
        const initialPreview = previewAuthoringSuggestion(schema, next, {
          ...(policy === undefined ? {} : { policy })
        });
        const initialSelection = validOperationIds(initialPreview);
        const nextPreview = previewAuthoringSuggestion(schema, next, {
          operationIds: initialSelection,
          ...(policy === undefined ? {} : { policy })
        });
        controller.current = undefined;
        setSuggestion(next);
        setPreview(nextPreview);
        setSelectedOperationIdsState(initialSelection);
        if (!initialPreview.valid) {
          setStatus("error");
          setError({
            code: initialPreview.issues.some((issue) => issue.code === "stale_schema")
              ? "stale_schema"
              : "validation_failure",
            cause: {
              success: false,
              error: {
                code: initialPreview.issues.some((issue) => issue.code === "stale_schema")
                  ? "stale_schema"
                  : "validation_failed",
                issues: initialPreview.issues
              }
            }
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
        setSelectedOperationIdsState([]);
      } else {
        setStatus("error");
        setError({ code: result.error.code === "stale_schema" ? "stale_schema" : "validation_failure", cause: result });
      }
      return result;
    },
    [idFactory, onChange, policy, schema, suggestion]
  );

  const toggleOperation = useCallback(
    (operationId: string) => {
      setSelectedOperationIds(
        selectedOperationIds.includes(operationId)
          ? selectedOperationIds.filter((value) => value !== operationId)
          : [...selectedOperationIds, operationId]
      );
    },
    [selectedOperationIds, setSelectedOperationIds]
  );
  const selectAll = useCallback(() => {
    if (preview !== undefined) setSelectedOperationIds(validOperationIds(preview));
  }, [preview, setSelectedOperationIds]);
  const clearSelection = useCallback(() => setSelectedOperationIds([]), [setSelectedOperationIds]);
  const applySelected = useCallback(() => apply(selectedOperationIds), [apply, selectedOperationIds]);

  const reject = useCallback(() => {
    setSuggestion(undefined);
    setPreview(undefined);
    setSelectedOperationIdsState([]);
    setError(undefined);
    setStatus("idle");
  }, []);

  return {
    status,
    isStale,
    ...(suggestion === undefined ? {} : { suggestion }),
    ...(preview === undefined ? {} : { preview }),
    ...(error === undefined ? {} : { error }),
    suggest,
    apply,
    reject,
    cancel,
    selectedOperationIds,
    setSelectedOperationIds,
    toggleOperation,
    selectAll,
    clearSelection,
    applySelected
  };
}
