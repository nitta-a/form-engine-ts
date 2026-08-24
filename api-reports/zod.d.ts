import { FormSchema } from '@form-engine-ts/core';
import { z } from 'zod';

interface CreateZodFormSchemaOptions {
    readonly pageIndex?: number;
}
declare function createZodFormSchema(schema: FormSchema, options?: CreateZodFormSchemaOptions): z.ZodType<Record<string, unknown>>;
interface ZodTransformOptions {
    readonly stripHiddenFields?: boolean;
    readonly stripUnknownFields?: boolean;
    readonly trimStrings?: boolean;
}
declare function createZodFormCodec(schema: FormSchema, options?: ZodTransformOptions): z.ZodPreprocess<z.ZodType<Record<string, unknown>, unknown, z.core.$ZodTypeInternals<Record<string, unknown>, unknown>>>;

export { type CreateZodFormSchemaOptions, type ZodTransformOptions, createZodFormCodec, createZodFormSchema };
