import { EN_MESSAGES } from "./catalogs/en";
import { JA_MESSAGES } from "./catalogs/ja";
import type { FormEngineMessages, FormEngineTranslationKey } from "./keys";

export interface FormEngineTranslatorOptions {
  readonly locale?: string;
  readonly fallbackLocale?: string;
  readonly messages?: FormEngineMessages;
  readonly customCatalogs?: Record<string, FormEngineMessages>;
  readonly fallbackTextResolver?: (key: FormEngineTranslationKey, locale: string) => string;
}

export type FormEngineTranslator = (key: FormEngineTranslationKey | string, params?: Record<string, unknown>) => string;

function formatTemplate(template: string, params: Record<string, unknown> = {}): string {
  return template.replace(/\{\{?(\w+)\}\}?/gu, (token, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : token
  );
}

function defaultCatalog(locale: string): Readonly<Record<FormEngineTranslationKey, string>> {
  return locale.toLowerCase().startsWith("ja") ? JA_MESSAGES : EN_MESSAGES;
}

export const createFormEngineTranslator = (options: FormEngineTranslatorOptions = {}): FormEngineTranslator => {
  const { locale = "ja", fallbackLocale = "en", messages = {}, customCatalogs = {}, fallbackTextResolver } = options;
  const currentCatalog = { ...defaultCatalog(locale), ...customCatalogs[locale], ...messages };
  const fallbackCatalog = { ...defaultCatalog(fallbackLocale), ...customCatalogs[fallbackLocale] };

  return (rawKey, params = {}) => {
    const key = rawKey as FormEngineTranslationKey;
    const template = currentCatalog[key] ?? fallbackCatalog[key];
    if (template !== undefined && template !== "") return formatTemplate(template, params);
    if (fallbackTextResolver !== undefined) return fallbackTextResolver(key, locale);
    return "";
  };
};
