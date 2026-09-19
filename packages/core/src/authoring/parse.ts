import { z } from "zod";
import type { AuthoringSuggestion } from "./types";

const fieldType = z.enum([
  "text",
  "textarea",
  "number",
  "rating",
  "date",
  "time",
  "email",
  "tel",
  "url",
  "select",
  "multi-select",
  "checkbox",
  "radio"
]);
const messages = z.record(z.string(), z.string());
const optionInput = z
  .object({
    label: z.string(),
    textInput: z.boolean().optional(),
    pinned: z.boolean().optional()
  })
  .strict();
const fieldInput = z
  .object({
    type: fieldType,
    title: z.string(),
    description: z.string().optional(),
    required: z.boolean().optional(),
    translationKey: z.string().optional(),
    messages: messages.optional(),
    placeholderKey: z.string().optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    pattern: z.string().optional(),
    minDate: z.string().optional(),
    maxDate: z.string().optional(),
    minTime: z.string().optional(),
    maxTime: z.string().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().optional(),
    shuffleOptions: z.boolean().optional(),
    minSelections: z.number().optional(),
    maxSelections: z.number().optional(),
    options: z.array(optionInput).optional()
  })
  .strict();
const fieldPatch = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    required: z.boolean().optional(),
    placeholderKey: z.string().optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    pattern: z.string().optional(),
    minDate: z.string().optional(),
    maxDate: z.string().optional(),
    minTime: z.string().optional(),
    maxTime: z.string().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().optional(),
    shuffleOptions: z.boolean().optional(),
    minSelections: z.number().optional(),
    maxSelections: z.number().optional(),
    messages: messages.optional()
  })
  .strict();
const formPatch = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    completionMessage: z.string().optional(),
    submitLabelKey: z.string().optional()
  })
  .strict();
const optionPatch = z
  .object({
    label: z.string().optional(),
    textInput: z.boolean().optional(),
    pinned: z.boolean().optional()
  })
  .strict();

const operation = z.discriminatedUnion("type", [
  z
    .object({
      operationId: z.string().min(1),
      type: z.literal("addField"),
      field: fieldInput,
      pageId: z.string().optional()
    })
    .strict(),
  z
    .object({
      operationId: z.string().min(1),
      type: z.literal("updateField"),
      fieldId: z.string().min(1),
      patch: fieldPatch
    })
    .strict(),
  z.object({ operationId: z.string().min(1), type: z.literal("updateForm"), patch: formPatch }).strict(),
  z
    .object({
      operationId: z.string().min(1),
      type: z.literal("addOption"),
      fieldId: z.string().min(1),
      option: optionInput
    })
    .strict(),
  z
    .object({
      operationId: z.string().min(1),
      type: z.literal("updateOption"),
      fieldId: z.string().min(1),
      optionId: z.string().min(1),
      patch: optionPatch
    })
    .strict()
]);

export const AuthoringSuggestionSchema = z
  .object({
    id: z.string().min(1),
    summary: z.string(),
    operations: z.array(operation),
    rationale: z.string().optional(),
    baseSchemaHash: z.string()
  })
  .strict();

export const AUTHORING_SUGGESTION_JSON_SCHEMA = z.toJSONSchema(AuthoringSuggestionSchema);

export function parseAuthoringSuggestion(value: unknown): AuthoringSuggestion {
  const parsed = AuthoringSuggestionSchema.safeParse(value);
  if (parsed.success) return parsed.data as unknown as AuthoringSuggestion;
  throw new TypeError(`Invalid authoring suggestion: ${parsed.error.issues[0]?.message ?? "invalid response"}`);
}
