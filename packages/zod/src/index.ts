import { assertValidFormSchema, type FormSchema, type FormValues, validateAnswers } from "@form-engine-ts/core";
import { z } from "zod";

function cloneSchema(schema: FormSchema): FormSchema {
  return JSON.parse(JSON.stringify(schema)) as FormSchema;
}

export function createZodFormSchema(schema: FormSchema): z.ZodType<Record<string, unknown>> {
  assertValidFormSchema(schema);
  const stableSchema = cloneSchema(schema);
  const shape = Object.fromEntries(stableSchema.fields.map((field) => [field.id, z.unknown().optional()]));

  return z
    .object(shape)
    .passthrough()
    .superRefine((values, context) => {
      const result = validateAnswers(stableSchema, values as FormValues);
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
