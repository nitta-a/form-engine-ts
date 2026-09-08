import { EN_MESSAGES, JA_MESSAGES, type KnownBuilderTranslationKey } from "@form-engine-ts/core";

export function contentTranslation(locale: string, translate?: (key: string) => string) {
  return (key: KnownBuilderTranslationKey): string => {
    const value = translate?.(key);
    if (value !== undefined && value !== key) return value;
    return (locale.startsWith("ja") ? JA_MESSAGES : EN_MESSAGES)[key];
  };
}
