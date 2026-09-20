import { z } from "zod";
import type { CreationAssistantResponse, SurveyCreationBrief } from "./types";

const brief = z
  .object({
    purpose: z.string().optional(),
    audience: z.string().optional(),
    goals: z.array(z.string()).optional(),
    constraints: z
      .object({
        targetQuestionCount: z.number().int().nonnegative().optional(),
        targetDurationMinutes: z.number().nonnegative().optional(),
        anonymous: z.boolean().optional(),
        tone: z.enum(["formal", "neutral", "casual"]).optional()
      })
      .strict()
      .optional(),
    locale: z.string().optional(),
    contentMode: z.enum(["survey", "poll", "quiz"]).optional(),
    notes: z.array(z.string()).optional()
  })
  .strict();

const quickReply = z.object({ id: z.string().min(1), label: z.string(), value: z.string() }).strict();

export const SurveyCreationBriefSchema = brief;
export const CreationAssistantResponseSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("clarification"),
      message: z.string(),
      brief,
      missing: z.array(z.enum(["purpose", "audience", "goals", "constraints", "locale", "contentMode"])),
      suggestions: z.array(quickReply).optional()
    })
    .strict(),
  z.object({ type: z.literal("ready"), message: z.string(), brief }).strict()
]);

export const CREATION_ASSISTANT_RESPONSE_JSON_SCHEMA = z.toJSONSchema(CreationAssistantResponseSchema);

function cleanBrief(value: z.infer<typeof brief>): SurveyCreationBrief {
  return {
    ...(value.purpose === undefined ? {} : { purpose: value.purpose }),
    ...(value.audience === undefined ? {} : { audience: value.audience }),
    ...(value.goals === undefined ? {} : { goals: value.goals }),
    ...(value.constraints === undefined
      ? {}
      : {
          constraints: {
            ...(value.constraints.targetQuestionCount === undefined
              ? {}
              : { targetQuestionCount: value.constraints.targetQuestionCount }),
            ...(value.constraints.targetDurationMinutes === undefined
              ? {}
              : { targetDurationMinutes: value.constraints.targetDurationMinutes }),
            ...(value.constraints.anonymous === undefined ? {} : { anonymous: value.constraints.anonymous }),
            ...(value.constraints.tone === undefined ? {} : { tone: value.constraints.tone })
          }
        }),
    ...(value.locale === undefined ? {} : { locale: value.locale }),
    ...(value.contentMode === undefined ? {} : { contentMode: value.contentMode }),
    ...(value.notes === undefined ? {} : { notes: value.notes })
  };
}

export function parseSurveyCreationBrief(value: unknown): SurveyCreationBrief {
  const parsed = SurveyCreationBriefSchema.safeParse(value);
  if (parsed.success) return cleanBrief(parsed.data);
  throw new TypeError(`Invalid survey creation brief: ${parsed.error.issues[0]?.message ?? "invalid brief"}`);
}

export function parseCreationAssistantResponse(value: unknown): CreationAssistantResponse {
  const parsed = CreationAssistantResponseSchema.safeParse(value);
  if (parsed.success) {
    if (parsed.data.type === "clarification")
      return {
        type: "clarification",
        message: parsed.data.message,
        brief: cleanBrief(parsed.data.brief),
        missing: parsed.data.missing,
        ...(parsed.data.suggestions === undefined ? {} : { suggestions: parsed.data.suggestions })
      };
    return { type: "ready", message: parsed.data.message, brief: cleanBrief(parsed.data.brief) };
  }
  throw new TypeError(`Invalid creation assistant response: ${parsed.error.issues[0]?.message ?? "invalid response"}`);
}
