import {
  assertValidFormSchema,
  calculateFieldVisibility,
  type FormField,
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

type ValueForField<TField extends FormField> = TField["type"] extends "number" | "rating"
  ? number
  : TField["type"] extends "checkbox"
    ? boolean
    : TField["type"] extends "multi-select"
      ? readonly string[]
      : string;

type FieldsForSchema<TSchema extends FormSchema> = TSchema["fields"][number];
type FieldIds<TSchema extends FormSchema> = FieldsForSchema<TSchema>["id"];
type RequiredFieldIds<TSchema extends FormSchema> =
  FieldsForSchema<TSchema> extends infer TField
    ? TField extends FormField
      ? TField["required"] extends true
        ? TField["id"]
        : never
      : never
    : never;
type OptionalFieldIds<TSchema extends FormSchema> = Exclude<FieldIds<TSchema>, RequiredFieldIds<TSchema>>;
type FieldById<TSchema extends FormSchema, TId extends string> = Extract<
  FieldsForSchema<TSchema>,
  { readonly id: TId }
>;

/** Values inferred from a schema's field IDs and field types. */
export type FormValuesForSchema<TSchema extends FormSchema> =
  string extends FieldIds<TSchema>
    ? FormValues
    : Readonly<
        {
          readonly [TId in RequiredFieldIds<TSchema>]: ValueForField<FieldById<TSchema, TId>>;
        } & {
          readonly [TId in OptionalFieldIds<TSchema>]?: ValueForField<FieldById<TSchema, TId>>;
        }
      > & {
        readonly metadata?: Readonly<Record<string, JsonValue>>;
        readonly translationMetadata?: Readonly<Record<string, JsonValue>>;
      };

export function createZodFormSchema<TSchema extends FormSchema>(
  schema: TSchema,
  options?: CreateZodFormSchemaOptions
): z.ZodType<FormValuesForSchema<TSchema>>;
export function createZodFormSchema(
  schema: FormSchema,
  options?: CreateZodFormSchemaOptions
): z.ZodType<Record<string, unknown>>;
export function createZodFormSchema<TSchema extends FormSchema>(
  schema: TSchema,
  options?: CreateZodFormSchemaOptions
): z.ZodType<FormValuesForSchema<TSchema>> | z.ZodType<Record<string, unknown>> {
  assertValidFormSchema(schema);
  const resolvedOptions = options ?? {};
  const stableSchema = cloneSchema(schema);
  const page =
    resolvedOptions.pageIndex === undefined || stableSchema.pages === undefined
      ? undefined
      : stableSchema.pages[resolvedOptions.pageIndex];
  const pageIds = page === undefined ? undefined : new Set(page.questionIds);
  const fields =
    resolvedOptions.pageIndex === undefined || stableSchema.pages === undefined
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

  const validator = z
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
        resolvedOptions.pageIndex === undefined
          ? validateAnswers(stableSchema, answerValues)
          : validatePageAnswers(stableSchema, resolvedOptions.pageIndex, answerValues);
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
  return validator as unknown as z.ZodType<FormValuesForSchema<TSchema>> | z.ZodType<Record<string, unknown>>;
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

export function createZodFormCodec<TSchema extends FormSchema>(
  schema: TSchema,
  options?: ZodTransformOptions
): z.ZodType<FormValuesForSchema<TSchema>>;
export function createZodFormCodec(
  schema: FormSchema,
  options?: ZodTransformOptions
): z.ZodPreprocess<
  z.ZodType<Record<string, unknown>, unknown, z.core.$ZodTypeInternals<Record<string, unknown>, unknown>>
>;
export function createZodFormCodec<TSchema extends FormSchema>(
  schema: TSchema,
  options?: ZodTransformOptions
): z.ZodType<FormValuesForSchema<TSchema>> | z.ZodPreprocess<z.ZodType<Record<string, unknown>>> {
  assertValidFormSchema(schema);
  const resolvedOptions = options ?? {};
  const stableSchema = cloneSchema(schema);
  const fieldIds = new Set(stableSchema.fields.map((field) => field.id));
  const recognizedExtensionKeys = new Set(["metadata", "translationMetadata"]);
  const codec = z.preprocess((input) => {
    if (typeof input !== "object" || input === null || Array.isArray(input)) return input;
    const entries = Object.entries(input);
    const normalized = Object.fromEntries(
      entries
        .filter(
          ([key]) =>
            resolvedOptions.stripUnknownFields !== true || fieldIds.has(key) || recognizedExtensionKeys.has(key)
        )
        .map(([key, value]) => [key, resolvedOptions.trimStrings === true ? normalizeCodecValue(value) : value])
    );
    if (resolvedOptions.stripHiddenFields === true) {
      const visibility = calculateFieldVisibility(stableSchema, normalized);
      for (const field of stableSchema.fields) {
        if (visibility[field.id] !== true) delete normalized[field.id];
      }
    }
    return normalized;
  }, createZodFormSchema(stableSchema));
  return codec as unknown as
    | z.ZodType<FormValuesForSchema<TSchema>>
    | z.ZodPreprocess<z.ZodType<Record<string, unknown>>>;
}
