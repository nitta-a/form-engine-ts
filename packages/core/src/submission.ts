import { assertValidFormSchema } from "./schema";
import type { FormSchema, FormSubmission, FormValues, ValidationIssue } from "./types";
import { validateAnswers } from "./validation";

export interface CreateSubmissionOptions {
  readonly id: string;
  readonly locale: string;
  readonly submittedAt?: string | Date;
}

export class InvalidAnswersError extends Error {
  readonly issues: readonly ValidationIssue[];

  constructor(issues: readonly ValidationIssue[]) {
    super(`Invalid form answers: ${issues.map((item) => `${item.fieldId}:${item.code}`).join(", ")}`);
    this.name = "InvalidAnswersError";
    this.issues = issues;
  }
}

function cloneValues(values: FormValues): FormValues {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, Array.isArray(value) ? Object.freeze([...value]) : value])
  );
}

export function createSubmission(
  schema: FormSchema,
  values: FormValues,
  options: CreateSubmissionOptions
): FormSubmission {
  assertValidFormSchema(schema);
  if (options.id.trim().length === 0) throw new TypeError("Submission ID must not be empty.");
  if (options.locale.trim().length === 0) throw new TypeError("Submission locale must not be empty.");
  const result = validateAnswers(schema, values);
  if (!result.valid) throw new InvalidAnswersError(result.issues);
  const date = options.submittedAt instanceof Date ? options.submittedAt : new Date(options.submittedAt ?? Date.now());
  if (Number.isNaN(date.getTime())) throw new TypeError("submittedAt must be a valid date.");
  return Object.freeze({
    id: options.id,
    formId: schema.id,
    formVersion: schema.version,
    locale: options.locale,
    values: Object.freeze(cloneValues(values)),
    submittedAt: date.toISOString()
  });
}
