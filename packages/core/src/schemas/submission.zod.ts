import { z } from "zod";

/** Runtime schema for the JSON metadata carried by a submission wire payload. */
export const FormSubmissionMetadataSchema = z.record(z.string(), z.unknown());

/** Runtime schema for the clean, alias-free submission wire format. */
export const FormSubmissionWireSchema = z.object({
  id: z.string().min(1),
  formId: z.string().min(1),
  formVersion: z.number().int().positive(),
  values: z.record(z.string(), z.unknown()),
  metadata: FormSubmissionMetadataSchema,
  submittedAt: z.string().datetime(),
  schemaRevision: z.number().int().optional()
});

export type FormSubmissionWireSchemaType = z.infer<typeof FormSubmissionWireSchema>;
