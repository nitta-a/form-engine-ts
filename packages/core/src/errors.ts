import type { FormEngineTranslationKey } from "./i18n/keys";
import type { SensitiveDataFinding } from "./validation";

export interface FormSubmissionSerializedError {
  readonly code: "VALIDATION_FAILED" | "PII_CONFIRMATION_REQUIRED" | "SUBMISSION_BLOCKED" | "STORAGE_ERROR";
  readonly messageKey: FormEngineTranslationKey | string;
  readonly messageParams?: Readonly<Record<string, unknown>>;
  readonly fieldErrors?: Readonly<Record<string, string>>;
  readonly formErrors?: readonly string[];
  readonly piiFindings?: readonly SensitiveDataFinding[];
  readonly piiWarningAcknowledged?: boolean;
}

/** JSON payload carried by a tRPC error's `data` or `shape.data` property. */
export interface TrpcFormSubmissionErrorData extends FormSubmissionSerializedError {
  readonly source: "form-engine";
}

export interface TrpcSubmissionErrorAdapter {
  readonly serialize: (error: FormSubmissionError) => TrpcFormSubmissionErrorData;
  readonly deserialize: (error: unknown) => FormSubmissionError | undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isFormSubmissionSerializedError(value: unknown): value is FormSubmissionSerializedError {
  if (!isRecord(value)) return false;
  const fieldErrors = value.fieldErrors;
  const formErrors = value.formErrors;
  return (
    (value.code === "VALIDATION_FAILED" ||
      value.code === "PII_CONFIRMATION_REQUIRED" ||
      value.code === "SUBMISSION_BLOCKED" ||
      value.code === "STORAGE_ERROR") &&
    typeof value.messageKey === "string" &&
    value.messageKey.length > 0 &&
    (fieldErrors === undefined ||
      (isRecord(fieldErrors) && Object.values(fieldErrors).every((message) => typeof message === "string"))) &&
    (formErrors === undefined ||
      (Array.isArray(formErrors) && formErrors.every((message) => typeof message === "string")))
  );
}

/** Error with a stable, JSON-serializable payload for RPC boundaries. */
export class FormSubmissionError extends Error {
  readonly payload: FormSubmissionSerializedError;

  constructor(payload: FormSubmissionSerializedError) {
    super(payload.formErrors?.[0] ?? payload.messageKey);
    this.name = "FormSubmissionError";
    this.payload = payload;
  }

  toJSON(): FormSubmissionSerializedError {
    return this.payload;
  }
}

export const serializeSubmissionError = (error: FormSubmissionError): FormSubmissionSerializedError => error.toJSON();

export const deserializeSubmissionError = (json: FormSubmissionSerializedError): FormSubmissionError =>
  new FormSubmissionError(json);

function findTrpcSubmissionErrorPayload(
  value: unknown,
  seen: Set<object> = new Set()
): FormSubmissionSerializedError | undefined {
  if (!isRecord(value)) return undefined;
  if (seen.has(value)) return undefined;
  seen.add(value);
  if (isFormSubmissionSerializedError(value)) return value;
  const candidates = [value.data, value.shape, value.cause];
  for (const candidate of candidates) {
    const payload = findTrpcSubmissionErrorPayload(candidate, seen);
    if (payload !== undefined) return payload;
  }
  return undefined;
}

/** Converts a FormSubmissionError into data safe to return from a tRPC procedure. */
export function serializeSubmissionErrorForTrpc(error: FormSubmissionError): TrpcFormSubmissionErrorData {
  return { ...error.payload, source: "form-engine" };
}

/** Restores a FormSubmissionError from a tRPC error, including `data` and `shape.data`. */
export function deserializeSubmissionErrorFromTrpc(error: unknown): FormSubmissionError | undefined {
  const payload = findTrpcSubmissionErrorPayload(error);
  return payload === undefined ? undefined : new FormSubmissionError(payload);
}

/** Standard transport adapter for tRPC server/client boundaries. */
export const trpcSubmissionErrorAdapter: TrpcSubmissionErrorAdapter = {
  serialize: serializeSubmissionErrorForTrpc,
  deserialize: deserializeSubmissionErrorFromTrpc
};

export const createTrpcSubmissionErrorAdapter = (): TrpcSubmissionErrorAdapter => trpcSubmissionErrorAdapter;
