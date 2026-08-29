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
