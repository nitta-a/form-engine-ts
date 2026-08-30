import { FormSubmissionError, type FormSubmissionSerializedError } from "./errors";
import { assertValidFormSchema } from "./schema";
import { type CreateSubmissionOptions, createSubmission, hashFormSubmissionPayload } from "./submission";
import type {
  BaseSubmissionMetadata,
  FormSchema,
  FormSubmission,
  FormValue,
  FormValues,
  JsonValue,
  SaveSubmissionOptions,
  SubmissionSaveResult,
  UnifiedSubmissionStorageAdapter
} from "./types";
import { type PrivacyEngine, validateAnswers } from "./validation";

export interface SubmissionCodecResult<
  TValues extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>
> {
  readonly success: true;
  readonly data: TValues;
}

export interface SubmissionCodecFailure {
  readonly success: false;
  readonly error: unknown;
}

/** Minimal codec contract accepted by the submission pipeline, including Zod codecs. */
export interface SubmissionCodec<
  TInput = unknown,
  TValues extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>
> {
  readonly safeParse: (input: TInput) => SubmissionCodecResult<TValues> | SubmissionCodecFailure;
}

export interface SubmissionPipelineOptions<
  TInput = unknown,
  TMeta extends BaseSubmissionMetadata | undefined = undefined,
  TValues extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>
> {
  readonly schema: FormSchema;
  readonly storage: UnifiedSubmissionStorageAdapter<TMeta>;
  readonly codec?: SubmissionCodec<TInput, TValues>;
  readonly id: string;
  readonly locale: string;
  readonly metadata?: TMeta;
  readonly submittedAt?: string;
  readonly schemaRevision?: number;
  readonly privacyEngine?: PrivacyEngine;
  /** Must be true when the client has reviewed the PII findings. */
  readonly piiWarningAcknowledged?: boolean;
  /** Idempotency is enabled by default for pipeline saves. */
  readonly idempotent?: boolean;
}

export type SubmissionPipelineResult<TMeta extends BaseSubmissionMetadata | undefined = undefined> =
  | SubmissionSaveResult<TMeta>
  | {
      readonly status: "created";
      readonly submission: FormSubmission<TMeta>;
      readonly payloadHash: string;
    };

export interface SubmissionPipeline<TInput, TMeta extends BaseSubmissionMetadata | undefined = undefined> {
  submit(input: TInput): Promise<SubmissionPipelineResult<TMeta>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validationError(
  message: string,
  cause?: unknown,
  fieldErrors?: Readonly<Record<string, string>>
): FormSubmissionError {
  const payload: FormSubmissionSerializedError = {
    code: "VALIDATION_FAILED",
    messageKey: "validation.submission",
    ...(fieldErrors === undefined ? {} : { fieldErrors }),
    formErrors: [message],
    ...(cause === undefined ? {} : { messageParams: { cause: String(cause) } })
  };
  return new FormSubmissionError(payload);
}

function storageError(cause: unknown): FormSubmissionError {
  return new FormSubmissionError({
    code: "STORAGE_ERROR",
    messageKey: "submission.storageError",
    formErrors: ["Submission could not be saved."],
    messageParams: { cause: cause instanceof Error ? cause.message : String(cause) }
  });
}

function normalizeCodecFailure(error: unknown): FormSubmissionError {
  if (!isRecord(error)) return validationError("Submission values are invalid.", error);
  const issues = error.issues;
  if (!Array.isArray(issues)) return validationError("Submission values are invalid.", error);
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    if (!isRecord(issue) || !Array.isArray(issue.path) || typeof issue.path[0] !== "string") continue;
    const fieldId = issue.path[0];
    const message = typeof issue.message === "string" ? issue.message : "Submission value is invalid.";
    fieldErrors[fieldId] ??= message;
  }
  return validationError(
    "Submission values are invalid.",
    error,
    Object.keys(fieldErrors).length ? fieldErrors : undefined
  );
}

function isFormValue(value: unknown): value is FormValue {
  return (
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    (Array.isArray(value) && value.every((item) => typeof item === "string"))
  );
}

function toAnswerRecord<TValues extends Readonly<Record<string, unknown>>>(
  values: TValues
): Readonly<Record<string, FormValue>> {
  const answers: Record<string, FormValue> = {};
  for (const [key, value] of Object.entries(values)) {
    if (key === "metadata" || key === "translationMetadata") continue;
    if (!isFormValue(value)) throw validationError(`Submission value for ${key} is invalid.`);
    answers[key] = value;
  }
  return answers;
}

function validationFieldErrors(schema: FormSchema, values: FormValues): Readonly<Record<string, string>> | undefined {
  const result = validateAnswers(schema, values);
  if (result.valid) return undefined;
  const fieldErrors: Record<string, string> = {};
  for (const issue of result.issues) fieldErrors[issue.fieldId] ??= issue.messageKey;
  return fieldErrors;
}

async function executeSubmissionPipeline<
  TInput,
  TMeta extends BaseSubmissionMetadata | undefined,
  TValues extends Readonly<Record<string, unknown>>
>(options: SubmissionPipelineOptions<TInput, TMeta, TValues>, input: TInput): Promise<SubmissionPipelineResult<TMeta>> {
  try {
    assertValidFormSchema(options.schema);
  } catch (cause) {
    throw validationError("Form schema is invalid.", cause);
  }

  let values: TValues;
  if (options.codec === undefined) {
    if (!isRecord(input)) throw validationError("Submission values must be an object.");
    values = input as TValues;
  } else {
    const parsed = options.codec.safeParse(input);
    if (!parsed.success) throw normalizeCodecFailure(parsed.error);
    values = parsed.data;
  }

  let answers: FormValues;
  try {
    answers = toAnswerRecord(values);
  } catch (cause) {
    if (cause instanceof FormSubmissionError) throw cause;
    throw validationError("Submission values are invalid.", cause);
  }
  const fieldErrors = validationFieldErrors(options.schema, answers);
  if (fieldErrors !== undefined) throw validationError("Submission answers are invalid.", undefined, fieldErrors);

  const findings = options.privacyEngine?.detect(options.schema, answers) ?? [];
  if (findings.length > 0 && options.piiWarningAcknowledged !== true) {
    throw new FormSubmissionError({
      code: "PII_CONFIRMATION_REQUIRED",
      messageKey: "renderer.confirmSensitiveDataMessage",
      fieldErrors: Object.fromEntries(findings.map((finding) => [finding.fieldId, "validation.sensitiveData"])),
      formErrors: ["Personal information confirmation is required."],
      piiFindings: findings,
      piiWarningAcknowledged: false
    });
  }

  let submission: FormSubmission<TMeta>;
  try {
    const definedMetadata =
      options.metadata === undefined
        ? undefined
        : (Object.fromEntries(
            Object.entries(options.metadata).filter((entry): entry is [string, JsonValue] => entry[1] !== undefined)
          ) as Readonly<Record<string, JsonValue>>);
    const createOptions: CreateSubmissionOptions = {
      id: options.id,
      locale: options.locale,
      submittedAt: options.submittedAt ?? new Date().toISOString(),
      ...(definedMetadata === undefined ? {} : { metadata: definedMetadata })
    };
    const created = createSubmission(options.schema, answers, {
      ...createOptions,
      ...(options.schemaRevision === undefined ? {} : { schemaRevision: options.schemaRevision })
    });
    submission = created as unknown as FormSubmission<TMeta>;
  } catch (cause) {
    throw validationError("Submission could not be created.", cause);
  }

  const saveOptions: SaveSubmissionOptions = { idempotent: options.idempotent ?? true };
  let saved: undefined | SubmissionSaveResult<TMeta>;
  try {
    saved = await options.storage.saveSubmission(submission, saveOptions);
  } catch (cause) {
    if (cause instanceof FormSubmissionError) throw cause;
    throw storageError(cause);
  }
  if (saved !== undefined) return saved;
  return {
    status: "created",
    submission,
    payloadHash: await hashFormSubmissionPayload(submission)
  };
}

/** Runs the complete normalized, validated, privacy-checked, idempotent save flow. */
export function runSubmissionPipeline<
  TInput,
  TMeta extends BaseSubmissionMetadata | undefined = undefined,
  TValues extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>
>(options: SubmissionPipelineOptions<TInput, TMeta, TValues>, input: TInput): Promise<SubmissionPipelineResult<TMeta>> {
  return executeSubmissionPipeline(options, input);
}

/** Creates a reusable submission pipeline with fixed schema, storage, and submission identity settings. */
export function createSubmissionPipeline<
  TInput,
  TMeta extends BaseSubmissionMetadata | undefined = undefined,
  TValues extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>
>(
  options: Omit<SubmissionPipelineOptions<TInput, TMeta, TValues>, "submittedAt"> & {
    readonly submittedAt?: string;
  }
): SubmissionPipeline<TInput, TMeta> {
  return { submit: (input) => executeSubmissionPipeline(options, input) };
}
