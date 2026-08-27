import type { TranslationAdapter } from "@form-engine-ts/core";

export interface I18nextInstance {
  t(key: string, options?: Readonly<Record<string, unknown>>): unknown;
  exists?(key: string, options?: Readonly<Record<string, unknown>>): boolean;
}

export interface I18nextAdapterOptions {
  /** Optional namespace passed to i18next for every lookup. */
  readonly namespace?: string;
  /** Optional key prefix nested inside the namespace. */
  readonly keyPrefix?: string;
  /** Locales to try after the requested locale cannot resolve the key. */
  readonly fallbackLocales?: readonly string[];
  /** Treat a result equal to the lookup key as unresolved. */
  readonly checkUnresolvedKey?: boolean;
}

export interface I18nextTranslatorOptions {
  readonly i18n: I18nextInstance;
  readonly namespace?: string;
  readonly keyPrefix?: string;
  readonly fallbackLocales?: readonly string[];
  readonly checkUnresolvedKey?: boolean;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isUnresolvedKey(value: string, key: string): boolean {
  return value === key || value.endsWith(`.${key}`) || value.endsWith(`:${key}`);
}

function createAdapter({
  i18n,
  namespace,
  keyPrefix,
  fallbackLocales,
  checkUnresolvedKey = true
}: I18nextTranslatorOptions): TranslationAdapter {
  if (i18n === null || typeof i18n !== "object" || typeof i18n.t !== "function") {
    throw new TypeError("i18next adapter requires an i18next instance with a t function.");
  }
  return {
    translate(key, locale, params = {}) {
      const prefixedKey = keyPrefix === undefined ? key : `${keyPrefix}.${key}`;
      const lookupKey =
        keyPrefix === undefined ? key : namespace === undefined ? prefixedKey : `${namespace}:${prefixedKey}`;
      const locales = [locale, ...(fallbackLocales ?? []).filter((fallback) => fallback !== locale)];
      const exists = i18n.exists;
      for (const candidateLocale of locales) {
        const lookupOptions: Record<string, unknown> = { ...params, lng: candidateLocale };
        if (keyPrefix === undefined && namespace !== undefined) lookupOptions.ns = namespace;
        if (keyPrefix !== undefined) lookupOptions.defaultValue = undefined;
        if (exists !== undefined && !exists(lookupKey, lookupOptions)) continue;
        const result = i18n.t(lookupKey, lookupOptions);
        if (!isNonEmptyString(result)) continue;
        if (checkUnresolvedKey && isUnresolvedKey(result, lookupKey)) continue;
        if (
          keyPrefix !== undefined &&
          (result === lookupKey || result === prefixedKey || result === key || result.endsWith(key))
        ) {
          continue;
        }
        return result;
      }
      return undefined;
    }
  };
}

/** Create a form-engine translation adapter from an i18next instance. */
export function createI18nextTranslator(options: I18nextTranslatorOptions): TranslationAdapter {
  return createAdapter(options);
}

/** Convenience overload for callers that already have the i18next instance. */
export function createI18nextTranslationAdapter(
  i18n: I18nextInstance,
  options: Omit<I18nextTranslatorOptions, "i18n"> = {}
): TranslationAdapter {
  return createAdapter({ ...options, i18n });
}
