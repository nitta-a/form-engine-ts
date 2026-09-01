import {
  computeSourceTextHash,
  type FormSchema,
  type JsonValue,
  populateSchemaTranslations,
  type TranslationReport,
  type TranslationSlot
} from "@form-engine-ts/core";
import type { AsyncTranslationAdapter, SurveyTextMetadataCodec } from "./types";

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
  const timestamp = new Date().toISOString();
  return {
    ...slot.existingTranslationMetadata,
    sourceLocale: options.sourceLocale,
    ...(options.policy.updateSourceTextHash ? { sourceTextHash: computeSourceTextHash(slot.sourceText) } : {}),
    translationSource: options.policy.source === "MANUAL" ? "manual" : "automatic",
    translatedAt: timestamp,
    ...(options.policy.source === "MANUAL" ? { editedAt: timestamp } : {})
  };
}

export interface TranslateSurveySchemaOptions {
  readonly schema: FormSchema;
  readonly sourceLocale: string;
  readonly targetLocale: string;
  readonly signal?: AbortSignal;
  readonly translationAdapter: AsyncTranslationAdapter;
  readonly metadataPolicy: SurveyTranslationMetadataPolicy;
  /** Optional common codec for application-owned translation metadata. */
  readonly metadataCodec?: SurveyTextMetadataCodec;
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
  const { schema, sourceLocale, targetLocale, signal, translationAdapter, metadataPolicy, metadataCodec } = options;
  const originalDefaultLocale = schema.defaultLocale;
  const sourceSchema = originalDefaultLocale === sourceLocale ? schema : { ...schema, defaultLocale: sourceLocale };
  const result = await populateSchemaTranslations(sourceSchema, [targetLocale], translationAdapter, {
    overwrite: "all",
    preserveManualTranslations: metadataPolicy.preserveManualEdits,
    createMetadata: (slot: TranslationSlot, translatedText: string) => {
      const metadata = createSurveyTranslationMetadata(slot, { sourceLocale, policy: metadataPolicy });
      if (metadataCodec === undefined) return metadata;
      return (
        metadataCodec.toEngine({ value: translatedText, sourceText: slot.sourceText, sourceLocale, metadata })
          .metadata ?? metadata
      );
    },
    ...(signal === undefined ? {} : { signal })
  });
  options.onReport?.(result.report);
  if (originalDefaultLocale === sourceLocale) return result;
  const { defaultLocale: _sourceDefaultLocale, ...schemaWithoutSourceDefault } = result.schema;
  return { ...result, schema: schemaWithoutSourceDefault };
}
