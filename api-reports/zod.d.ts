import { FormSchema, FormValues, FormField, JsonValue } from '@form-engine-ts/core';
import { z } from 'zod';

interface CreateZodFormSchemaOptions {
    readonly pageIndex?: number;
}
type ValueForField<TField extends FormField> = TField["type"] extends "number" | "rating" ? number : TField["type"] extends "checkbox" ? boolean : TField["type"] extends "multi-select" ? readonly string[] : string;
type FieldsForSchema<TSchema extends FormSchema> = TSchema["fields"][number];
type FieldIds<TSchema extends FormSchema> = FieldsForSchema<TSchema>["id"];
type RequiredFieldIds<TSchema extends FormSchema> = FieldsForSchema<TSchema> extends infer TField ? TField extends FormField ? TField["required"] extends true ? TField["id"] : never : never : never;
type OptionalFieldIds<TSchema extends FormSchema> = Exclude<FieldIds<TSchema>, RequiredFieldIds<TSchema>>;
type FieldById<TSchema extends FormSchema, TId extends string> = Extract<FieldsForSchema<TSchema>, {
    readonly id: TId;
}>;
/** Values inferred from a schema's field IDs and field types. */
type FormValuesForSchema<TSchema extends FormSchema> = string extends FieldIds<TSchema> ? FormValues : Readonly<{
    readonly [TId in RequiredFieldIds<TSchema>]: ValueForField<FieldById<TSchema, TId>>;
} & {
    readonly [TId in OptionalFieldIds<TSchema>]?: ValueForField<FieldById<TSchema, TId>>;
}> & {
    readonly metadata?: Readonly<Record<string, JsonValue>>;
    readonly translationMetadata?: Readonly<Record<string, JsonValue>>;
};
declare function createZodFormSchema<TSchema extends FormSchema>(schema: TSchema, options?: CreateZodFormSchemaOptions): z.ZodType<FormValuesForSchema<TSchema>>;
declare function createZodFormSchema(schema: FormSchema, options?: CreateZodFormSchemaOptions): z.ZodType<Record<string, unknown>>;
interface ZodTransformOptions {
    readonly stripHiddenFields?: boolean;
    readonly stripUnknownFields?: boolean;
    readonly trimStrings?: boolean;
}
declare function createZodFormCodec<TSchema extends FormSchema>(schema: TSchema, options?: ZodTransformOptions): z.ZodType<FormValuesForSchema<TSchema>>;
declare function createZodFormCodec(schema: FormSchema, options?: ZodTransformOptions): z.ZodPreprocess<z.ZodType<Record<string, unknown>, unknown, z.core.$ZodTypeInternals<Record<string, unknown>, unknown>>>;

export { type CreateZodFormSchemaOptions, type FormValuesForSchema, type ZodTransformOptions, createZodFormCodec, createZodFormSchema };
