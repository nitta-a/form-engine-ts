import type { FormEngineTranslationKey } from "./i18n/keys";
import type { SensitiveDataFinding } from "./validation";

export interface FormSubmissionSerializedError {
  readonly code: "VALIDATION_FAILED" | "PII_CONFIRMATION_REQUIRED" | "SUBMISSION_BLOCKED" | "STORAGE_ERROR";
  readonly messageKey: FormEngineTranslationKey | string;
  readonly messageParams?: Readonly<Record<string, unknown>>;
  readonly fieldErrors: Readonly<Record<string, string>>;
  readonly formErrors: readonly string[];
  readonly piiFindings?: readonly SensitiveDataFinding[];
  readonly piiWarningAcknowledged?: boolean;
}

/** Error with a stable, JSON-serializable payload for RPC boundaries. */
export class FormSubmissionError extends Error {
  readonly payload: FormSubmissionSerializedError;

  constructor(payload: FormSubmissionSerializedError) {
    super(payload.messageKey);
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
