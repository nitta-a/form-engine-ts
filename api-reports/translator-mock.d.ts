import { AsyncTranslationAdapter, TranslationAdapter } from '@form-engine-ts/core';

type TranslationCatalog = Readonly<Record<string, string>>;
type TranslationCatalogs = Readonly<Record<string, TranslationCatalog>>;
declare const mockCatalogs: TranslationCatalogs;
declare function createMockTranslationAdapter(catalogs?: TranslationCatalogs, fallbackLocale?: string): TranslationAdapter;
declare const mockTranslator: TranslationAdapter;
declare function createMockAsyncTranslationAdapter(): AsyncTranslationAdapter;
declare const mockAsyncTranslator: AsyncTranslationAdapter;

export { type TranslationCatalog, type TranslationCatalogs, createMockAsyncTranslationAdapter, createMockTranslationAdapter, mockAsyncTranslator, mockCatalogs, mockTranslator };
