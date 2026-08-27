import { TranslationAdapter } from '@form-engine-ts/core';

interface I18nextInstance {
    t(key: string, options?: Readonly<Record<string, unknown>>): unknown;
    exists?(key: string, options?: Readonly<Record<string, unknown>>): boolean;
}
interface I18nextTranslatorOptions {
    readonly i18n: I18nextInstance;
    /** Optional namespace passed to i18next for every lookup. */
    readonly namespace?: string;
    /** Treat a result equal to the lookup key as unresolved when `exists` is unavailable. */
    readonly checkUnresolvedKey?: boolean;
}
/** Create a form-engine translation adapter from an i18next instance. */
declare function createI18nextTranslator(options: I18nextTranslatorOptions): TranslationAdapter;
/** Convenience overload for callers that already have the i18next instance. */
declare function createI18nextTranslationAdapter(i18n: I18nextInstance, options?: Omit<I18nextTranslatorOptions, "i18n">): TranslationAdapter;

export { type I18nextInstance, type I18nextTranslatorOptions, createI18nextTranslationAdapter, createI18nextTranslator };
