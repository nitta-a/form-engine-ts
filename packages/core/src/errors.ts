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

export type TrpcProcedureType = "query" | "mutation" | "subscription";

/** Structural equivalent of tRPC's ErrorFormatter input; no `@trpc/server` dependency is required. */
export interface TrpcSubmissionErrorFormatterOptions<TShape extends Record<string, unknown> = Record<string, unknown>> {
  readonly error: unknown;
  readonly type: TrpcProcedureType | undefined;
  readonly path: string | undefined;
  readonly input: unknown;
  readonly ctx: unknown;
  readonly shape: TShape & { readonly data?: unknown };
}

export type TrpcSubmissionErrorShape<TShape extends Record<string, unknown>> = Omit<TShape, "data"> & {
  readonly data: Partial<TrpcFormSubmissionErrorData> &
    Omit<
      TShape extends { readonly data?: infer TData }
        ? TData extends object
          ? TData
          : Record<string, unknown>
        : Record<string, unknown>,
      keyof TrpcFormSubmissionErrorData
    >;
};

export type TrpcSubmissionErrorFormatter<TShape extends Record<string, unknown> = Record<string, unknown>> = (
  options: TrpcSubmissionErrorFormatterOptions<TShape>
) => TrpcSubmissionErrorShape<TShape>;

/** A ready-to-use server/client tRPC boundary for FormSubmissionError. */
export interface TrpcSubmissionErrorIntegration {
  readonly errorFormatter: TrpcSubmissionErrorFormatter;
  readonly deserialize: (error: unknown) => FormSubmissionError | undefined;
  readonly getData: (error: unknown) => TrpcFormSubmissionErrorData | undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSensitiveDataFinding(value: unknown): value is SensitiveDataFinding {
  return (
    isRecord(value) &&
    typeof value.fieldId === "string" &&
    typeof value.type === "string" &&
    (value.fieldTitle === undefined || typeof value.fieldTitle === "string") &&
    (value.typeLabel === undefined || typeof value.typeLabel === "string") &&
    (value.start === undefined || typeof value.start === "number") &&
    (value.end === undefined || typeof value.end === "number") &&
    (value.matchedText === undefined || typeof value.matchedText === "string") &&
    (value.maskedText === undefined || typeof value.maskedText === "string")
  );
}

export function isFormSubmissionSerializedError(value: unknown): value is FormSubmissionSerializedError {
  if (!isRecord(value)) return false;
  const fieldErrors = value.fieldErrors;
  const formErrors = value.formErrors;
  const piiFindings = value.piiFindings;
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
      (Array.isArray(formErrors) && formErrors.every((message) => typeof message === "string"))) &&
    (piiFindings === undefined || (Array.isArray(piiFindings) && piiFindings.every(isSensitiveDataFinding))) &&
    (value.piiWarningAcknowledged === undefined || typeof value.piiWarningAcknowledged === "boolean")
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
  const candidates = [value.payload, value.data, value.shape, value.cause];
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
  if (error instanceof FormSubmissionError) return error;
  const payload = findTrpcSubmissionErrorPayload(error);
  return payload === undefined ? undefined : new FormSubmissionError(payload);
}

/** Returns the typed Form Engine payload from a tRPC error shape without an application cast. */
export function getTrpcSubmissionErrorData(error: unknown): TrpcFormSubmissionErrorData | undefined {
  const payload = findTrpcSubmissionErrorPayload(error);
  return payload === undefined ? undefined : { ...payload, source: "form-engine" };
}

/** Standard transport adapter for tRPC server/client boundaries. */
export const trpcSubmissionErrorAdapter: TrpcSubmissionErrorAdapter = {
  serialize: serializeSubmissionErrorForTrpc,
  deserialize: deserializeSubmissionErrorFromTrpc
};

export const createTrpcSubmissionErrorAdapter = (): TrpcSubmissionErrorAdapter => trpcSubmissionErrorAdapter;

/**
 * Creates the tRPC integration used by both a server `errorFormatter` and a client error boundary.
 * The formatter preserves tRPC's existing `shape.data` values and adds the typed submission payload
 * only when the thrown error is a FormSubmissionError.
 */
export function createTrpcSubmissionErrorIntegration(): TrpcSubmissionErrorIntegration {
  return {
    errorFormatter: ({ error, shape }) => {
      const submissionError = deserializeSubmissionErrorFromTrpc(error);
      const existingData = isRecord(shape.data) ? shape.data : {};
      if (submissionError === undefined) return { ...shape, data: existingData };
      return {
        ...shape,
        data: { ...existingData, ...serializeSubmissionErrorForTrpc(submissionError) }
      };
    },
    deserialize: deserializeSubmissionErrorFromTrpc,
    getData: getTrpcSubmissionErrorData
  };
}

/** Server-side convenience helper for tRPC's `errorFormatter` option. */
export const createTrpcSubmissionErrorFormatter = () => createTrpcSubmissionErrorIntegration().errorFormatter;
