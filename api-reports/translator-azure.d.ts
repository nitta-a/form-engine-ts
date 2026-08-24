import { AsyncTranslationAdapter } from '@form-engine-ts/core';

interface AzureTranslatorOptions {
    readonly apiKey: string;
    readonly region?: string;
    readonly endpoint?: string;
    readonly fetchFn?: typeof fetch;
}
declare function createAzureTranslator(options: AzureTranslatorOptions): AsyncTranslationAdapter;

export { type AzureTranslatorOptions, createAzureTranslator };
