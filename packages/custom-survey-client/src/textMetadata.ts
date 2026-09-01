import { computeSourceTextHash, type JsonValue, normalizeTranslationMetadata } from "@form-engine-ts/core";
import type {
  CreateSurveyTextMetadataCodecOptions,
  SurveyEngineTextMetadata,
  SurveyTextMetadata,
  SurveyTextMetadataCodec
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (!isRecord(value)) return false;
  return Object.values(value).every(isJsonValue);
}

function jsonMetadata(value: unknown): Readonly<Record<string, JsonValue>> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, candidate]) => isJsonValue(candidate))) as Readonly<
    Record<string, JsonValue>
  >;
}

function isManual(metadata: SurveyTextMetadata | SurveyEngineTextMetadata): boolean {
  return (
    metadata.isManuallyEdited === true ||
    metadata.isManual === true ||
    (typeof metadata.translationSource === "string" && metadata.translationSource.toLowerCase() === "manual")
  );
}

function canonicalSource(metadata: SurveyTextMetadata | SurveyEngineTextMetadata): "automatic" | "manual" {
  return isManual(metadata) ? "manual" : "automatic";
}

export function createSurveyTextMetadataCodec(
  options: CreateSurveyTextMetadataCodecOptions = {}
): SurveyTextMetadataCodec {
  const preserveUnknown = options.preserveUnknown ?? false;
  const sourceTextHashMode = options.sourceTextHash ?? "auto";
  return {
    toEngine: ({ value, metadata, sourceText, sourceLocale }) => {
      const input = metadata ?? {};
      const canonical = canonicalSource(input);
      const unknown = preserveUnknown ? jsonMetadata(input) : {};
      const sourceTextHash =
        sourceTextHashMode === "auto"
          ? computeSourceTextHash(sourceText)
          : (input.sourceTextHash ?? computeSourceTextHash(sourceText));
      const nextMetadata = {
        ...unknown,
        sourceText,
        sourceTextHash,
        ...(sourceLocale === undefined && input.sourceLocale === undefined
          ? {}
          : { sourceLocale: sourceLocale ?? input.sourceLocale }),
        translationSource: canonical,
        isManuallyEdited: canonical === "manual",
        ...(input.translatedAt === undefined ? {} : { translatedAt: input.translatedAt }),
        ...(input.editedAt === undefined ? {} : { editedAt: input.editedAt })
      } satisfies Readonly<Record<string, JsonValue>>;
      return { value, sourceText, metadata: nextMetadata };
    },
    fromEngine: ({ metadata, sourceText }) => {
      const input = metadata ?? {};
      const normalized = normalizeTranslationMetadata(input, sourceText, input.sourceLocale ?? "");
      const canonical = canonicalSource(input);
      const unknown = preserveUnknown ? jsonMetadata(input) : {};
      return {
        ...unknown,
        sourceText: typeof input.sourceText === "string" ? input.sourceText : sourceText,
        sourceTextHash: sourceTextHashMode === "auto" ? computeSourceTextHash(sourceText) : normalized.sourceTextHash,
        ...(normalized.sourceLocale.length === 0 ? {} : { sourceLocale: normalized.sourceLocale }),
        translationSource: canonical,
        isManuallyEdited: canonical === "manual",
        ...(normalized.translatedAt === undefined ? {} : { translatedAt: normalized.translatedAt }),
        ...(normalized.editedAt === undefined ? {} : { editedAt: normalized.editedAt })
      };
    }
  };
}
