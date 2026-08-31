import type { FormResponse, TextAnswerItem } from "@form-engine-ts/core";
import type { FreeTextAnswerInput, FreeTextAnswerItem } from "./types";

/** Normalizes Core text-answer pages for translation workflows. */
export function toFreeTextAnswerItems(items: readonly FreeTextAnswerInput[]): readonly FreeTextAnswerItem[] {
  const normalized = items.flatMap((item) => {
    if ("id" in item && "sourceLanguage" in item) return item;
    if ("fieldId" in item) {
      const textAnswer: TextAnswerItem = item;
      return {
        id: `${textAnswer.responseId}:${textAnswer.fieldId}`,
        responseId: textAnswer.responseId,
        fieldId: textAnswer.fieldId,
        text: textAnswer.text,
        sourceLanguage: textAnswer.locale ?? "unknown",
        ...(textAnswer.metadata === undefined ? {} : { metadata: textAnswer.metadata })
      };
    }
    const response: FormResponse = item;
    return Object.entries(response.answers).flatMap(([fieldId, value]) =>
      typeof value === "string"
        ? [
            {
              id: `${response.responseId}:${fieldId}`,
              responseId: response.responseId,
              fieldId,
              text: value,
              sourceLanguage: response.sourceLocale ?? "unknown",
              ...(response.metadata === undefined ? {} : { metadata: response.metadata })
            }
          ]
        : []
    );
  });
  const seen = new Set<string>();
  for (const item of normalized) {
    if (seen.has(item.id)) throw new TypeError(`Free-text answer IDs must be unique: ${item.id}.`);
    seen.add(item.id);
  }
  return normalized;
}
