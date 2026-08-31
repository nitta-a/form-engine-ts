import {
  computeSourceTextHash,
  type FormSchema,
  populateSchemaTranslations,
  type TranslationReport,
  type TranslationSlot
} from "@form-engine-ts/core";
import type { SurveyTranslationAdapter } from "./types";

export interface TranslateSurveySchemaOptions {
  readonly schema: FormSchema;
  readonly sourceLocale: string;
  readonly targetLocale: string;
  readonly signal?: AbortSignal;
  readonly translationAdapter: SurveyTranslationAdapter;
  /** Keeps manual translations intact and retains per-slot translation metadata. */
  readonly preserveMetadata?: boolean;
}

export interface TranslateSurveySchemaResult {
  readonly schema: FormSchema;
  readonly report: TranslationReport;
}

function createAsyncTranslationAdapter(adapter: SurveyTranslationAdapter) {
  return {
    translate: adapter.translate,
    translateText: async (text: string, targetLocale: string, sourceLocale?: string, signal?: AbortSignal) => {
      if (adapter.translateText !== undefined) {
        return adapter.translateText(text, targetLocale, sourceLocale, signal);
      }
      if (signal?.aborted) throw signal.reason ?? new DOMException("The translation was cancelled.", "AbortError");
      return adapter.translate(text, targetLocale, sourceLocale === undefined ? undefined : { sourceLocale }) ?? text;
    },
    translateBatch: async (
      texts: readonly string[],
      targetLocale: string,
      sourceLocale?: string,
      signal?: AbortSignal
    ): Promise<readonly string[]> => {
      if (adapter.translateBatch !== undefined) {
        return adapter.translateBatch(texts, targetLocale, sourceLocale, signal);
      }
      const translated: string[] = [];
      for (const text of texts) {
        if (signal?.aborted) throw signal.reason ?? new DOMException("The translation was cancelled.", "AbortError");
        translated.push(
          (await adapter.translateText?.(text, targetLocale, sourceLocale, signal)) ??
            adapter.translate(text, targetLocale, sourceLocale === undefined ? undefined : { sourceLocale }) ??
            text
        );
      }
      return translated;
    }
  };
}

/** Translates form, question, choice, page, and translation metadata in one package operation. */
export async function translateSurveySchema(
  options: TranslateSurveySchemaOptions
): Promise<TranslateSurveySchemaResult> {
  const { schema, sourceLocale, targetLocale, signal, translationAdapter, preserveMetadata = true } = options;
  const originalDefaultLocale = schema.defaultLocale;
  const sourceSchema = originalDefaultLocale === sourceLocale ? schema : { ...schema, defaultLocale: sourceLocale };
  const result = await populateSchemaTranslations(
    sourceSchema,
    [targetLocale],
    createAsyncTranslationAdapter(translationAdapter),
    {
      overwrite: "all",
      preserveManualTranslations: preserveMetadata,
      ...(preserveMetadata
        ? {
            createMetadata: (slot: TranslationSlot) => ({
              ...slot.existingTranslationMetadata,
              sourceLocale,
              sourceTextHash: computeSourceTextHash(slot.sourceText),
              translationSource: "automatic" as const,
              translatedAt: new Date().toISOString()
            })
          }
        : {}),
      ...(signal === undefined ? {} : { signal })
    }
  );
  if (originalDefaultLocale === sourceLocale) return result;
  const { defaultLocale: _sourceDefaultLocale, ...schemaWithoutSourceDefault } = result.schema;
  return { ...result, schema: schemaWithoutSourceDefault };
}
