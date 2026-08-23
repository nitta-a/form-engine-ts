import {
  assertValidFormSchema,
  type FormSchema,
  type FormValues,
  validateAnswers,
  validatePageAnswers
} from "@form-engine-ts/core";
import { z } from "zod";

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
  const shape = Object.fromEntries(fields.map((field) => [field.id, z.unknown().optional()]));

  return z
    .object(shape)
    .passthrough()
    .superRefine((values, context) => {
      const result =
        options.pageIndex === undefined
          ? validateAnswers(stableSchema, values as FormValues)
          : validatePageAnswers(stableSchema, options.pageIndex, values as FormValues);
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
