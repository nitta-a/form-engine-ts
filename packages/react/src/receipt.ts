export interface SubmissionReceipt {
  readonly formId: string;
  readonly formVersion: number;
  readonly submissionId?: string;
  readonly submittedAt: string;
}

export interface SubmissionReceiptStore {
  get(formId: string, formVersion: number): Promise<SubmissionReceipt | null>;
  save(receipt: SubmissionReceipt): Promise<void>;
  remove(formId: string, formVersion: number): Promise<void>;
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
  return {
    async get(formId, formVersion) {
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
