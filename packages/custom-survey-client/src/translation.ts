import {
  computeSourceTextHash,
  type FormSchema,
  type JsonValue,
  populateSchemaTranslations,
  type TranslationReport,
  type TranslationSlot
} from "@form-engine-ts/core";
import type { AsyncTranslationAdapter } from "./types";

export type SurveyTranslationMetadataSource = "AI" | "MANUAL";

export interface SurveyTranslationMetadataPolicy {
  /** Records whether the generated translation came from an AI/automatic or manual source. */
  readonly source: SurveyTranslationMetadataSource;
  /** Leaves existing manually edited target slots untouched. */
  readonly preserveManualEdits: boolean;
  /** Recomputes sourceTextHash for each metadata record written by this operation. */
  readonly updateSourceTextHash: boolean;
}

export interface CreateSurveyTranslationMetadataOptions {
  readonly sourceLocale: string;
  readonly policy: Pick<SurveyTranslationMetadataPolicy, "source" | "updateSourceTextHash">;
}

/** Creates the canonical metadata owned by the package translation operation. */
export function createSurveyTranslationMetadata(
  slot: TranslationSlot,
  options: CreateSurveyTranslationMetadataOptions
): Readonly<Record<string, JsonValue>> {
  return {
    ...slot.existingTranslationMetadata,
    sourceLocale: options.sourceLocale,
    ...(options.policy.updateSourceTextHash ? { sourceTextHash: computeSourceTextHash(slot.sourceText) } : {}),
    translationSource: options.policy.source === "MANUAL" ? "manual" : "automatic",
    translatedAt: new Date().toISOString()
  };
}

export interface TranslateSurveySchemaOptions {
  readonly schema: FormSchema;
  readonly sourceLocale: string;
  readonly targetLocale: string;
  readonly signal?: AbortSignal;
  readonly translationAdapter: AsyncTranslationAdapter;
  readonly metadataPolicy: SurveyTranslationMetadataPolicy;
  readonly onReport?: (report: TranslationReport) => void;
}

export interface TranslateSurveySchemaResult {
  readonly schema: FormSchema;
  readonly report: TranslationReport;
}

/** Translates form, question, choice, page, and translation metadata in one package operation. */
export async function translateSurveySchema(
  options: TranslateSurveySchemaOptions
): Promise<TranslateSurveySchemaResult> {
  const { schema, sourceLocale, targetLocale, signal, translationAdapter, metadataPolicy } = options;
  const originalDefaultLocale = schema.defaultLocale;
  const sourceSchema = originalDefaultLocale === sourceLocale ? schema : { ...schema, defaultLocale: sourceLocale };
  const result = await populateSchemaTranslations(sourceSchema, [targetLocale], translationAdapter, {
    overwrite: "all",
    preserveManualTranslations: metadataPolicy.preserveManualEdits,
    createMetadata: (slot: TranslationSlot) =>
      createSurveyTranslationMetadata(slot, { sourceLocale, policy: metadataPolicy }),
    ...(signal === undefined ? {} : { signal })
  });
  options.onReport?.(result.report);
  if (originalDefaultLocale === sourceLocale) return result;
  const { defaultLocale: _sourceDefaultLocale, ...schemaWithoutSourceDefault } = result.schema;
  return { ...result, schema: schemaWithoutSourceDefault };
}
