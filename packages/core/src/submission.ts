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
import { type FormSubmissionValidationSource, type SubmissionValidationResult, validateAnswers } from "./validation";
import { selectVisibleAnswers } from "./visibility";

export interface CreateSubmissionOptions<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata>
  extends ExtensibleNode {
  readonly id?: string;
  readonly idFormat?: SubmissionIdFormat;
  readonly locale: string;
  readonly submittedAt: string;
  readonly schemaRevision?: number;
  readonly metadata?: TMeta & Readonly<Record<string, JsonValue>>;
}

function cloneValues(values: FormValues): FormValues {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, Array.isArray(value) ? Object.freeze([...value]) : value])
  );
}

export type SubmissionIdFormat = "uuid" | "ulid" | "custom";

function generatedUuid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function generatedUlid(): string {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let timestamp = Date.now();
  let timePart = "";
  for (let index = 0; index < 10; index += 1) {
    timePart = alphabet[timestamp % 32] + timePart;
    timestamp = Math.floor(timestamp / 32);
  }
  const bytes = new Uint8Array(16);
  const getRandomValues = globalThis.crypto?.getRandomValues;
  if (typeof getRandomValues === "function") getRandomValues.call(globalThis.crypto, bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  return `${timePart}${Array.from(bytes, (value) => alphabet[value % 32]).join("")}`;
}

/** Generates a submission identity shared by Core, Controller, and Renderer integrations. */
export function createSubmissionId(format: SubmissionIdFormat = "uuid", factory?: () => string): string {
  if (factory !== undefined) {
    const value = factory();
    if (value.trim().length === 0) throw new TypeError("Submission ID factory must return a non-empty string.");
    return value;
  }
  if (format === "custom") throw new TypeError("Submission ID factory is required when idFormat is custom.");
  return format === "ulid" ? generatedUlid() : generatedUuid();
}

export function isSubmissionUlid(value: string): boolean {
  return /^[0-7][0-9ABCDEFGHJKMNPQRSTVWXYZ]{25}$/u.test(value);
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

function canonicalSubmissionValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") return Number.isFinite(value) ? JSON.stringify(value) : JSON.stringify(String(value));
  if (Array.isArray(value)) return `[${value.map(canonicalSubmissionValue).join(",")}]`;
  if (typeof value !== "object") return JSON.stringify(String(value));
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalSubmissionValue(record[key])}`)
    .join(",")}}`;
}

/** Creates a stable SHA-256 hash for idempotent submission persistence. */
export function hashFormSubmissionPayload(submission: FormSubmission): Promise<string>;
export function hashFormSubmissionPayload<TMeta extends BaseSubmissionMetadata | undefined = undefined>(
  submission: FormSubmission<TMeta>
): Promise<string>;
export async function hashFormSubmissionPayload<TMeta extends BaseSubmissionMetadata | undefined = undefined>(
  submission: FormSubmission<TMeta>
): Promise<string> {
  const payload = {
    id: submission.id,
    formId: submission.formId,
    formVersion: submission.formVersion,
    locale: submission.locale,
    values: submission.values,
    metadata: submission.metadata,
    submittedAt: submission.submittedAt,
    schemaRevision: submission.schemaRevision,
    translationMetadata: submission.translationMetadata
  };
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalSubmissionValue(payload))
  );
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Alias kept intentionally descriptive for storage integrations. */
export const createSubmissionPayloadHash = hashFormSubmissionPayload;

/** Re-validates a submission against the exact schema version used to create it. */
function assertValidFormSubmissionInternal<TMeta extends BaseSubmissionMetadata | undefined = undefined>(
  schema: FormSchema,
  submission: FormSubmission<TMeta>
): void {
  assertValidFormSchema(schema);
  if (submission.formId !== schema.id || submission.formVersion !== schema.version) {
    throw new TypeError("Submission form identity does not match the schema.");
  }
  const locale = submission.locale ?? schema.defaultLocale ?? schema.supportedLocales?.[0] ?? "und";
  if (locale.trim().length === 0 || !Number.isFinite(Date.parse(submission.submittedAt))) {
    throw new TypeError("Submission locale and submittedAt must be valid.");
  }
  const result = validateAnswers(schema, submission.values);
  if (!result.valid) {
    throw new TypeError(
      `Invalid form answers: ${result.issues.map((item) => `${item.fieldId}:${item.code}`).join(", ")}`
    );
  }
}

/** Re-validates a submission against the exact schema version used to create it. */
export function assertValidFormSubmission(schema: FormSchema, submission: FormSubmission): void {
  assertValidFormSubmissionInternal(schema, submission);
}

function isFormSchema<TMeta extends BaseSubmissionMetadata | undefined>(
  value: FormSubmissionValidationSource<TMeta>
): value is FormSchema {
  return typeof value === "object" && value !== null && "fields" in value && "id" in value && "version" in value;
}

function validationResultError(result: SubmissionValidationResult): Error {
  return new TypeError(
    [...Object.values(result.fieldErrors), ...result.formErrors].join("; ") || "Submission validation failed.",
    { cause: { code: "VALIDATION_FAILED", messageKey: "validation.submission", ...result } }
  );
}

function isSubmissionValidationResult(value: unknown): value is SubmissionValidationResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "valid" in value &&
    typeof value.valid === "boolean" &&
    "fieldErrors" in value &&
    typeof value.fieldErrors === "object" &&
    value.fieldErrors !== null &&
    "formErrors" in value &&
    Array.isArray(value.formErrors)
  );
}

/** Validates a submission with a FormSchema, a Zod-compatible schema, or a callback. */
export async function assertValidFormSubmissionWith<TMeta extends BaseSubmissionMetadata | undefined = undefined>(
  source: FormSubmissionValidationSource<TMeta>,
  submission: FormSubmission<TMeta>
): Promise<void> {
  if (isFormSchema(source)) {
    assertValidFormSubmissionInternal(source, submission);
    return;
  }
  if (typeof source === "function") {
    const result = await source(submission);
    if (result === false) throw new TypeError("Submission validation failed.");
    if (isSubmissionValidationResult(result) && result.valid === false) {
      throw validationResultError(result);
    }
    return;
  }
  const parsed = source.safeParse({
    ...submission,
    values: { ...submission.values },
    metadata: submission.metadata ?? {}
  });
  if (!parsed.success) {
    throw new TypeError("Submission does not match the configured schema.", { cause: parsed.error });
  }
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
    const id = input.id ?? createSubmissionId(input.idFormat);
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
  const id = options.id ?? createSubmissionId(options.idFormat ?? "uuid");
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
    id,
    formId: schema.id,
    formVersion: schema.version,
    locale: options.locale,
    values: Object.freeze(cloneValues(visibleValues)),
    submittedAt: options.submittedAt,
    ...(options.schemaRevision === undefined ? {} : { schemaRevision: options.schemaRevision }),
    ...(options.metadata === undefined ? {} : { metadata: Object.freeze({ ...options.metadata }) }),
    ...(options.translationMetadata === undefined
      ? {}
      : { translationMetadata: Object.freeze({ ...options.translationMetadata }) })
  }) as FormSubmission<TMeta>;
}
