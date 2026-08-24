import {
  assertValidFormSchema,
  calculateFieldVisibility,
  type FormSchema,
  type FormValues,
  type JsonValue,
  validateAnswers,
  validatePageAnswers
} from "@form-engine-ts/core";
import { z } from "zod";

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema)
  ])
);

function cloneSchema(schema: FormSchema): FormSchema {
  return JSON.parse(JSON.stringify(schema)) as FormSchema;
}

export interface CreateZodFormSchemaOptions {
  readonly pageIndex?: number;
}

export function createZodFormSchema(
  schema: FormSchema,
  options: CreateZodFormSchemaOptions = {}
): z.ZodType<Record<string, unknown>> {
  assertValidFormSchema(schema);
  const stableSchema = cloneSchema(schema);
  const page =
    options.pageIndex === undefined || stableSchema.pages === undefined
      ? undefined
      : stableSchema.pages[options.pageIndex];
  const pageIds = page === undefined ? undefined : new Set(page.questionIds);
  const fields =
    options.pageIndex === undefined || stableSchema.pages === undefined
      ? stableSchema.fields
      : stableSchema.fields.filter((field) => pageIds?.has(field.id) === true);
  const allFieldIds = new Set(stableSchema.fields.map((field) => field.id));
  const acceptsMetadata = !allFieldIds.has("metadata");
  const acceptsTranslationMetadata = !allFieldIds.has("translationMetadata");
  const shape = {
    ...Object.fromEntries(fields.map((field) => [field.id, z.unknown().optional()])),
    ...(acceptsMetadata ? { metadata: z.record(z.string(), jsonValueSchema).optional() } : {}),
    ...(acceptsTranslationMetadata ? { translationMetadata: z.record(z.string(), jsonValueSchema).optional() } : {})
  };

  return z
    .object(shape)
    .passthrough()
    .superRefine((values, context) => {
      const answerValues = Object.fromEntries(
        Object.entries(values).filter(
          ([key]) =>
            !(acceptsMetadata && key === "metadata") && !(acceptsTranslationMetadata && key === "translationMetadata")
        )
      ) as FormValues;
      const result =
        options.pageIndex === undefined
          ? validateAnswers(stableSchema, answerValues)
          : validatePageAnswers(stableSchema, options.pageIndex, answerValues);
      if (result.valid) return;
      for (const issue of result.issues) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [issue.fieldId],
          message: issue.messageKey,
          params: {
            formEngineCode: issue.code,
            messageKey: issue.messageKey,
            validationParams: issue.params
          }
        });
      }
    });
}

export interface ZodTransformOptions {
  readonly stripHiddenFields?: boolean;
  readonly stripUnknownFields?: boolean;
  readonly trimStrings?: boolean;
}

function normalizeCodecValue(value: unknown): unknown {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === "string" ? item.trim() : item)).filter((item) => item !== "");
  }
  return value;
}

export function createZodFormCodec(schema: FormSchema, options: ZodTransformOptions = {}) {
  assertValidFormSchema(schema);
  const stableSchema = cloneSchema(schema);
  const fieldIds = new Set(stableSchema.fields.map((field) => field.id));
  const recognizedExtensionKeys = new Set(["metadata", "translationMetadata"]);
  return z.preprocess((input) => {
    if (typeof input !== "object" || input === null || Array.isArray(input)) return input;
    const entries = Object.entries(input);
    const normalized = Object.fromEntries(
      entries
        .filter(([key]) => options.stripUnknownFields !== true || fieldIds.has(key) || recognizedExtensionKeys.has(key))
        .map(([key, value]) => [key, options.trimStrings === true ? normalizeCodecValue(value) : value])
    );
    if (options.stripHiddenFields === true) {
      const visibility = calculateFieldVisibility(stableSchema, normalized);
      for (const field of stableSchema.fields) {
        if (visibility[field.id] !== true) delete normalized[field.id];
      }
    }
    return normalized;
  }, createZodFormSchema(stableSchema));
}
