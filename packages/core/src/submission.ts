import { assertValidFormSchema } from "./schema";
import type { FormSubmissionWireSchemaType } from "./schemas/submission.zod";
import type {
  BaseSubmissionMetadata,
  CreateSubmissionInput,
  ExtensibleNode,
  FormSchema,
  FormSubmission,
  FormSubmissionWire,
  FormValues,
  JsonValue,
  StrictFormSubmission,
  StrictFormSubmissionWire
} from "./types";
import { validateAnswers } from "./validation";
import { selectVisibleAnswers } from "./visibility";

export interface CreateSubmissionOptions<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata>
  extends ExtensibleNode {
  readonly id: string;
  readonly locale: string;
  readonly submittedAt: string;
  readonly metadata?: TMeta & Readonly<Record<string, JsonValue>>;
}

function cloneValues(values: FormValues): FormValues {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, Array.isArray(value) ? Object.freeze([...value]) : value])
  );
}

function generatedSubmissionId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toFormValues(answers: Readonly<Record<string, unknown>>): FormValues {
  const values: Record<string, FormValues[string]> = {};
  for (const [key, value] of Object.entries(answers)) {
    if (isFormValue(value)) values[key] = value;
  }
  return values;
}

function isFormValue(value: unknown): value is FormValues[string] {
  return (
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    (Array.isArray(value) && value.every((item) => typeof item === "string"))
  );
}

export interface ToWireOptions {
  readonly requireLocale?: boolean;
}

export function toFormSubmissionWire<TMeta extends BaseSubmissionMetadata>(
  submission: FormSubmission<TMeta>
): FormSubmissionWire<TMeta>;
export function toFormSubmissionWire(submission: FormSubmission): FormSubmissionWire;
export function toFormSubmissionWire<TMeta extends BaseSubmissionMetadata>(
  submission: StrictFormSubmission<TMeta>,
  options: { readonly requireLocale: true }
): StrictFormSubmissionWire<TMeta>;
export function toFormSubmissionWire(
  submission: FormSubmission | StrictFormSubmission,
  options?: ToWireOptions
): FormSubmissionWire | StrictFormSubmissionWire {
  const { id, formId, formVersion, values, locale, metadata, submittedAt, schemaRevision } = submission;
  if (options?.requireLocale === true && (locale === undefined || locale.trim().length === 0)) {
    throw new Error(`[FormEngine:Submission] Missing required "locale" in submission ID: "${id}"`);
  }
  return {
    id,
    formId,
    formVersion,
    values: { ...values },
    ...(locale === undefined ? {} : { locale }),
    metadata: { ...(metadata ?? {}) },
    submittedAt,
    ...(schemaRevision === undefined ? {} : { schemaRevision })
  };
}

export function fromFormSubmissionWire<TMeta extends BaseSubmissionMetadata>(
  wire: FormSubmissionWire<TMeta>
): FormSubmission<TMeta>;
export function fromFormSubmissionWire(wire: FormSubmissionWireSchemaType): FormSubmission;
export function fromFormSubmissionWire(wire: FormSubmissionWire): FormSubmission;
export function fromFormSubmissionWire(wire: FormSubmissionWire | FormSubmissionWireSchemaType): FormSubmission {
  const { id, formId, formVersion, values, locale, metadata, submittedAt, schemaRevision } = wire;
  const canonicalMetadata = { ...metadata } as BaseSubmissionMetadata;
  return {
    id,
    formId,
    formVersion,
    values: { ...values } as FormValues,
    ...(locale === undefined ? {} : { locale }),
    metadata: canonicalMetadata,
    submittedAt,
    ...(schemaRevision === undefined ? {} : { schemaRevision })
  };
}

export function createSubmission(
  schema: FormSchema,
  values: FormValues,
  options: CreateSubmissionOptions
): FormSubmission;
export function createSubmission<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata>(
  schema: FormSchema,
  values: FormValues,
  options: CreateSubmissionOptions<TMeta>
): FormSubmission<TMeta>;
export function createSubmission<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata>(
  input: CreateSubmissionInput<TMeta>
): FormSubmission<TMeta>;
export function createSubmission<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata>(
  schemaOrInput: FormSchema | CreateSubmissionInput<BaseSubmissionMetadata>,
  values?: FormValues,
  options?: CreateSubmissionOptions<TMeta>
): FormSubmission<TMeta> {
  if ("answers" in schemaOrInput) {
    const input = schemaOrInput;
    const id = input.id ?? generatedSubmissionId();
    if (input.formId.trim().length === 0) throw new TypeError("formId must not be empty.");
    if (!Number.isSafeInteger(input.formVersion) || input.formVersion < 1) {
      throw new TypeError("formVersion must be a positive safe integer.");
    }
    const submittedAt = input.submittedAt ?? new Date().toISOString();
    if (submittedAt.trim().length === 0 || !Number.isFinite(Date.parse(submittedAt))) {
      throw new TypeError("submittedAt must be a valid date string.");
    }
    const answers = Object.freeze({ ...input.answers });
    return Object.freeze({
      id,
      formId: input.formId,
      formVersion: input.formVersion,
      locale: "",
      values: Object.freeze(cloneValues(toFormValues(answers))),
      metadata: input.metadata,
      submittedAt,
      ...(input.schemaRevision === undefined ? {} : { schemaRevision: input.schemaRevision })
    }) as unknown as FormSubmission<TMeta>;
  }

  const schema = schemaOrInput;
  if (values === undefined || options === undefined) throw new TypeError("values and options are required.");
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
  }) as FormSubmission<TMeta>;
}
