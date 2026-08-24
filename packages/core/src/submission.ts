import { assertValidFormSchema } from "./schema";
import type { ExtensibleNode, FormSchema, FormSubmission, FormValues } from "./types";
import { validateAnswers } from "./validation";
import { selectVisibleAnswers } from "./visibility";

export interface CreateSubmissionOptions extends ExtensibleNode {
  readonly id: string;
  readonly locale: string;
  readonly submittedAt: string;
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
  if (!result.valid) {
    throw new TypeError(
      `Invalid form answers: ${result.issues.map((item) => `${item.fieldId}:${item.code}`).join(", ")}`
    );
  }
  if (options.submittedAt.trim().length === 0 || !Number.isFinite(Date.parse(options.submittedAt))) {
    throw new TypeError("submittedAt must be a valid date string.");
  }
  const visibleValues = selectVisibleAnswers(schema, values);
  return Object.freeze({
    id: options.id,
    formId: schema.id,
    formVersion: schema.version,
    locale: options.locale,
    values: Object.freeze(cloneValues(visibleValues)),
    submittedAt: options.submittedAt,
    ...(options.metadata === undefined ? {} : { metadata: Object.freeze({ ...options.metadata }) }),
    ...(options.translationMetadata === undefined
      ? {}
      : { translationMetadata: Object.freeze({ ...options.translationMetadata }) })
  });
}
