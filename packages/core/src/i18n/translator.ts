import type { TranslationStatus } from "../translation";
import { EN_MESSAGES } from "./catalogs/en";
import { JA_MESSAGES } from "./catalogs/ja";
import type { FormEngineMessages, FormEngineTranslationKey } from "./keys";

export type TranslationTargetKind = "title" | "completionMessage" | "question" | "option";

export interface TranslationWorkspaceCustomDictionary {
  readonly messages?: Partial<Record<FormEngineTranslationKey, string>>;
  readonly localeNames?: Readonly<Record<string, string>>;
  readonly statusLabels?: Partial<Record<TranslationStatus, string>>;
  readonly placeholders?: Partial<Record<TranslationTargetKind, string>>;
  readonly headers?: {
    readonly sourceTitle?: string;
    readonly targetTitle?: string;
  };
}

export interface FormEngineTranslatorOptions {
  readonly locale?: string;
  readonly fallbackLocale?: string;
  readonly messages?: FormEngineMessages;
  readonly customCatalogs?: Record<string, FormEngineMessages>;
  readonly customDictionary?: TranslationWorkspaceCustomDictionary;
  readonly fallbackTextResolver?: (key: FormEngineTranslationKey, locale: string) => string;
  readonly onMissingKey?: (event: TranslationMissingKeyEvent) => void;
  readonly strict?: boolean;
}

export interface TranslationMissingKeyEvent {
  readonly key: string;
  readonly locale: string;
  readonly fallbackLocale: string;
  readonly resolvedValue: string;
  readonly reason: "missing_in_current_locale" | "missing_in_all_catalogs";
}

export type FormEngineTranslator = (key: FormEngineTranslationKey | string, params?: Record<string, unknown>) => string;

function formatTemplate(template: string, params: Record<string, unknown> = {}): string {
  return template.replace(/\{\{?(\w+)\}\}?/gu, (token, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : token
  );
}

function isExposedTranslationKey(value: string, key: string): boolean {
  return value === key || /^(?:builder|fields|form|renderer|validation|workspace)(?:\.[a-zA-Z0-9_-]+)+$/u.test(value);
}

function defaultCatalog(locale: string): Readonly<Record<FormEngineTranslationKey, string>> {
  return locale.toLowerCase().startsWith("ja") ? JA_MESSAGES : EN_MESSAGES;
}

export const createFormEngineTranslator = (options: FormEngineTranslatorOptions = {}): FormEngineTranslator => {
  const {
    locale = "ja",
    fallbackLocale = "en",
    messages = {},
    customCatalogs = {},
    customDictionary,
    fallbackTextResolver,
    onMissingKey,
    strict = false
  } = options;
  const currentCatalog = {
    ...defaultCatalog(locale),
    ...customCatalogs[locale],
    ...(customDictionary?.messages ?? {}),
    ...messages
  };
  const fallbackCatalog = { ...defaultCatalog(fallbackLocale), ...customCatalogs[fallbackLocale] };

  return (rawKey, params = {}) => {
    const key = rawKey as FormEngineTranslationKey;
    const currentTemplate = currentCatalog[key];
    if (currentTemplate !== undefined && currentTemplate !== "") return formatTemplate(currentTemplate, params);
    const fallbackTemplate = fallbackCatalog[key];
    if (fallbackTemplate !== undefined && fallbackTemplate !== "") {
      const resolvedValue = formatTemplate(fallbackTemplate, params);
      onMissingKey?.({
        key: rawKey,
        locale,
        fallbackLocale,
        resolvedValue,
        reason: "missing_in_current_locale"
      });
      return resolvedValue;
    }
    if (fallbackTextResolver !== undefined) {
      const candidate = fallbackTextResolver(key, locale);
      const resolvedValue = isExposedTranslationKey(candidate, rawKey) ? "" : candidate;
      onMissingKey?.({
        key: rawKey,
        locale,
        fallbackLocale,
        resolvedValue,
        reason: resolvedValue.length === 0 ? "missing_in_all_catalogs" : "missing_in_current_locale"
      });
      return resolvedValue;
    }
    onMissingKey?.({
      key: rawKey,
      locale,
      fallbackLocale,
      resolvedValue: "",
      reason: "missing_in_all_catalogs"
    });
    if (strict) console.warn(`[FormEngine:i18n] Missing translation key "${rawKey}" for locale "${locale}"`);
    return "";
  };
};
