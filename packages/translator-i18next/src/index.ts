import type { TranslationAdapter } from "@form-engine-ts/core";

export interface I18nextInstance {
  t(key: string, options?: Readonly<Record<string, unknown>>): unknown;
  exists?(key: string, options?: Readonly<Record<string, unknown>>): boolean;
}

export interface I18nextTranslatorOptions {
  readonly i18n: I18nextInstance;
  /** Optional namespace passed to i18next for every lookup. */
  readonly namespace?: string;
  /** Treat a result equal to the lookup key as unresolved when `exists` is unavailable. */
  readonly checkUnresolvedKey?: boolean;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isUnresolvedKey(value: string, key: string): boolean {
  return value === key || value.endsWith(`.${key}`) || value.endsWith(`:${key}`);
}

function createAdapter({ i18n, namespace, checkUnresolvedKey = true }: I18nextTranslatorOptions): TranslationAdapter {
  if (i18n === null || typeof i18n !== "object" || typeof i18n.t !== "function") {
    throw new TypeError("i18next adapter requires an i18next instance with a t function.");
  }
  return {
    translate(key, locale, params = {}) {
      const lookupOptions: Record<string, unknown> = { ...params, lng: locale };
      if (namespace !== undefined) lookupOptions.ns = namespace;
      const exists = i18n.exists;
      const canCheckExistence = exists !== undefined;
      if (exists !== undefined && !exists(key, lookupOptions)) return undefined;
      const result = i18n.t(key, lookupOptions);
      if (!isNonEmptyString(result)) return undefined;
      return !canCheckExistence && checkUnresolvedKey && isUnresolvedKey(result, key) ? undefined : result;
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
