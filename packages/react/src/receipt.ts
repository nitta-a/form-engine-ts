import { useEffect, useMemo, useState } from "react";

export interface SubmissionReceipt {
  readonly formId: string;
  readonly formVersion: number;
  /** Optional application scope. Omit both values for the legacy form scope. */
  readonly deckId?: string;
  readonly sessionId?: string;
  readonly submissionId?: string;
  readonly submittedAt: string;
}

export interface SubmissionReceiptQuery {
  readonly formId: string;
  readonly formVersion: number;
  readonly deckId?: string;
  readonly sessionId?: string;
}

export interface SubmissionReceiptStore {
  get(
    formId: string,
    formVersion: number,
    scope?: Pick<SubmissionReceiptQuery, "deckId" | "sessionId">
  ): Promise<SubmissionReceipt | null>;
  getBatch?(queries: readonly SubmissionReceiptQuery[]): Promise<Map<string, SubmissionReceipt>>;
  save(receipt: SubmissionReceipt): Promise<void>;
  remove(
    formId: string,
    formVersion: number,
    scope?: Pick<SubmissionReceiptQuery, "deckId" | "sessionId">
  ): Promise<void>;
}

export interface UseSubmissionReceiptsResult {
  readonly receipts: ReadonlyMap<string, SubmissionReceipt>;
  readonly isLoading: boolean;
  readonly error: Error | null;
}

export function submissionReceiptQueryKey(
  formId: string,
  formVersion: number,
  scope: Pick<SubmissionReceiptQuery, "deckId" | "sessionId"> = {}
): string {
  if (scope.deckId === undefined && scope.sessionId === undefined) return `${formId}:v${formVersion}`;
  return `${formId}:v${formVersion}:d${scope.deckId ?? ""}:s${scope.sessionId ?? ""}`;
}

function receiptKey(namespace: string, query: SubmissionReceiptQuery): string {
  return `${namespace}:${submissionReceiptQueryKey(query.formId, query.formVersion, query)}`;
}

function browserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function parseReceipt(serialized: string): SubmissionReceipt | null {
  try {
    const value: unknown = JSON.parse(serialized);
    if (
      typeof value !== "object" ||
      value === null ||
      !("formId" in value) ||
      typeof value.formId !== "string" ||
      !("formVersion" in value) ||
      typeof value.formVersion !== "number" ||
      !Number.isSafeInteger(value.formVersion) ||
      ("deckId" in value && value.deckId !== undefined && typeof value.deckId !== "string") ||
      ("sessionId" in value && value.sessionId !== undefined && typeof value.sessionId !== "string") ||
      !("submittedAt" in value) ||
      typeof value.submittedAt !== "string" ||
      !Number.isFinite(Date.parse(value.submittedAt)) ||
      ("submissionId" in value && value.submissionId !== undefined && typeof value.submissionId !== "string")
    ) {
      return null;
    }
    const record = value as Record<string, unknown>;
    const submissionId =
      "submissionId" in value && typeof value.submissionId === "string" ? value.submissionId : undefined;
    return {
      formId: value.formId,
      formVersion: value.formVersion,
      ...(typeof record.deckId === "string" ? { deckId: record.deckId } : {}),
      ...(typeof record.sessionId === "string" ? { sessionId: record.sessionId } : {}),
      submittedAt: value.submittedAt,
      ...(submissionId === undefined ? {} : { submissionId })
    };
  } catch {
    return null;
  }
}

export function createLocalStorageSubmissionReceiptStore(
  options: { readonly namespace?: string } = {}
): SubmissionReceiptStore {
  const namespace = options.namespace ?? "form_engine_receipt";
  if (namespace.trim().length === 0) throw new TypeError("Receipt namespace must not be empty.");
  const get = async (
    formId: string,
    formVersion: number,
    scope: Pick<SubmissionReceiptQuery, "deckId" | "sessionId"> = {}
  ): Promise<SubmissionReceipt | null> => {
    const storage = browserStorage();
    if (storage === null) return null;
    try {
      const serialized = storage.getItem(receiptKey(namespace, { formId, formVersion, ...scope }));
      if (serialized === null) return null;
      const receipt = parseReceipt(serialized);
      return receipt?.formId === formId &&
        receipt.formVersion === formVersion &&
        receipt.deckId === scope.deckId &&
        receipt.sessionId === scope.sessionId
        ? receipt
        : null;
    } catch {
      return null;
    }
  };
  return {
    get,
    async getBatch(queries) {
      const receipts = await Promise.all(queries.map((query) => get(query.formId, query.formVersion, query)));
      return new Map(
        receipts.flatMap((receipt) =>
          receipt === null
            ? []
            : [[submissionReceiptQueryKey(receipt.formId, receipt.formVersion, receipt), receipt] as const]
        )
      );
    },
    async save(receipt) {
      const storage = browserStorage();
      if (storage === null) return;
      storage.setItem(receiptKey(namespace, receipt), JSON.stringify(receipt));
    },
    async remove(formId, formVersion, scope = {}) {
      const storage = browserStorage();
      if (storage === null) return;
      storage.removeItem(receiptKey(namespace, { formId, formVersion, ...scope }));
    }
  };
}

export function useSubmissionReceipts(
  store: SubmissionReceiptStore,
  queries: readonly SubmissionReceiptQuery[]
): UseSubmissionReceiptsResult {
  const querySignature = JSON.stringify(
    queries.map(({ formId, formVersion, deckId, sessionId }) => [formId, formVersion, deckId, sessionId])
  );
  const stableQueries = useMemo<readonly SubmissionReceiptQuery[]>(() => {
    const parsed: unknown = JSON.parse(querySignature);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) =>
      Array.isArray(entry) &&
      typeof entry[0] === "string" &&
      typeof entry[1] === "number" &&
      Number.isSafeInteger(entry[1]) &&
      (entry[2] === undefined || entry[2] === null || typeof entry[2] === "string") &&
      (entry[3] === undefined || entry[3] === null || typeof entry[3] === "string")
        ? [
            {
              formId: entry[0],
              formVersion: entry[1],
              ...(typeof entry[2] === "string" ? { deckId: entry[2] } : {}),
              ...(typeof entry[3] === "string" ? { sessionId: entry[3] } : {})
            }
          ]
        : []
    );
  }, [querySignature]);
  const [state, setState] = useState<UseSubmissionReceiptsResult>({
    receipts: new Map(),
    isLoading: stableQueries.length > 0,
    error: null
  });
  useEffect(() => {
    let active = true;
    if (stableQueries.length === 0) {
      setState({ receipts: new Map(), isLoading: false, error: null });
      return () => {
        active = false;
      };
    }
    setState((current) => ({ ...current, isLoading: true, error: null }));
    const load =
      store.getBatch?.(stableQueries) ??
      Promise.all(stableQueries.map((query) => store.get(query.formId, query.formVersion, query))).then(
        (receipts) =>
          new Map(
            receipts.flatMap((receipt) =>
              receipt === null
                ? []
                : [[submissionReceiptQueryKey(receipt.formId, receipt.formVersion, receipt), receipt] as const]
            )
          )
      );
    void load
      .then((receipts) => {
        if (active) setState({ receipts, isLoading: false, error: null });
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setState({
          receipts: new Map(),
          isLoading: false,
          error: cause instanceof Error ? cause : new Error(String(cause))
        });
      });
    return () => {
      active = false;
    };
  }, [stableQueries, store]);
  return state;
}
