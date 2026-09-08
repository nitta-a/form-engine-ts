import {
  createFormEngineTranslator,
  EN_MESSAGES,
  type FormEngineTranslationKey,
  JA_MESSAGES
} from "@form-engine-ts/core";
import type { MuiFormEngineI18nOptions } from "./types";

export function contentTranslation(locale: string, translate?: (key: string) => string) {
  return (key: FormEngineTranslationKey): string => {
    const value = translate?.(key);
    if (value !== undefined && value !== key) return value;
    return (locale.startsWith("ja") ? JA_MESSAGES : EN_MESSAGES)[key];
  };
}

export function muiContentTranslation(locale: string, i18n?: MuiFormEngineI18nOptions) {
  const resolvedLocale = i18n?.locale ?? locale;
  if (i18n === undefined) return { locale: resolvedLocale, translate: contentTranslation(resolvedLocale) };
  const translator =
    i18n.translator ??
    createFormEngineTranslator({
      locale: resolvedLocale,
      fallbackLocale: i18n.fallbackLocale ?? "en",
      ...(i18n.messages === undefined ? {} : { messages: i18n.messages }),
      ...(i18n.customCatalogs === undefined ? {} : { customCatalogs: i18n.customCatalogs }),
      ...(i18n.customDictionary === undefined ? {} : { customDictionary: i18n.customDictionary }),
      ...(i18n.onMissingKey === undefined ? {} : { onMissingKey: i18n.onMissingKey }),
      ...(i18n.strict === undefined ? {} : { strict: i18n.strict })
    });
  return { locale: resolvedLocale, translate: contentTranslation(resolvedLocale, translator) };
}
