import { useEffect, useMemo, useState } from "react";

export interface SubmissionReceipt {
  readonly formId: string;
  readonly formVersion: number;
  readonly submissionId?: string;
  readonly submittedAt: string;
}

export interface SubmissionReceiptQuery {
  readonly formId: string;
  readonly formVersion: number;
}

export interface SubmissionReceiptStore {
  get(formId: string, formVersion: number): Promise<SubmissionReceipt | null>;
  getBatch?(queries: readonly SubmissionReceiptQuery[]): Promise<Map<string, SubmissionReceipt>>;
  save(receipt: SubmissionReceipt): Promise<void>;
  remove(formId: string, formVersion: number): Promise<void>;
}

export interface UseSubmissionReceiptsResult {
  readonly receipts: ReadonlyMap<string, SubmissionReceipt>;
  readonly isLoading: boolean;
  readonly error: Error | null;
}

export function submissionReceiptQueryKey(formId: string, formVersion: number): string {
  return `${formId}:v${formVersion}`;
}

function receiptKey(namespace: string, formId: string, formVersion: number): string {
  return `${namespace}:${formId}:v${formVersion}`;
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
      !("submittedAt" in value) ||
      typeof value.submittedAt !== "string" ||
      !Number.isFinite(Date.parse(value.submittedAt)) ||
      ("submissionId" in value && value.submissionId !== undefined && typeof value.submissionId !== "string")
    ) {
      return null;
    }
    const submissionId =
      "submissionId" in value && typeof value.submissionId === "string" ? value.submissionId : undefined;
    return {
      formId: value.formId,
      formVersion: value.formVersion,
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
  const get = async (formId: string, formVersion: number): Promise<SubmissionReceipt | null> => {
    const storage = browserStorage();
    if (storage === null) return null;
    try {
      const serialized = storage.getItem(receiptKey(namespace, formId, formVersion));
      if (serialized === null) return null;
      const receipt = parseReceipt(serialized);
      return receipt?.formId === formId && receipt.formVersion === formVersion ? receipt : null;
    } catch {
      return null;
    }
  };
  return {
    get,
    async getBatch(queries) {
      const receipts = await Promise.all(queries.map((query) => get(query.formId, query.formVersion)));
      return new Map(
        receipts.flatMap((receipt) =>
          receipt === null ? [] : [[submissionReceiptQueryKey(receipt.formId, receipt.formVersion), receipt] as const]
        )
      );
    },
    async save(receipt) {
      const storage = browserStorage();
      if (storage === null) return;
      storage.setItem(receiptKey(namespace, receipt.formId, receipt.formVersion), JSON.stringify(receipt));
    },
    async remove(formId, formVersion) {
      const storage = browserStorage();
      if (storage === null) return;
      storage.removeItem(receiptKey(namespace, formId, formVersion));
    }
  };
}

export function useSubmissionReceipts(
  store: SubmissionReceiptStore,
  queries: readonly SubmissionReceiptQuery[]
): UseSubmissionReceiptsResult {
  const querySignature = JSON.stringify(queries.map(({ formId, formVersion }) => [formId, formVersion]));
  const stableQueries = useMemo<readonly SubmissionReceiptQuery[]>(() => {
    const parsed: unknown = JSON.parse(querySignature);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) =>
      Array.isArray(entry) &&
      typeof entry[0] === "string" &&
      typeof entry[1] === "number" &&
      Number.isSafeInteger(entry[1])
        ? [{ formId: entry[0], formVersion: entry[1] }]
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
      Promise.all(stableQueries.map((query) => store.get(query.formId, query.formVersion))).then(
        (receipts) =>
          new Map(
            receipts.flatMap((receipt) =>
              receipt === null
                ? []
                : [[submissionReceiptQueryKey(receipt.formId, receipt.formVersion), receipt] as const]
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
