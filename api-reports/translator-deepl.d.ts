import { AsyncTranslationAdapter } from '@form-engine-ts/core';

interface DeeplTranslatorOptions {
    readonly apiKey: string;
    readonly apiType?: "free" | "pro";
    readonly fetchFn?: typeof fetch;
}
declare function createDeeplTranslator(options: DeeplTranslatorOptions): AsyncTranslationAdapter;

export { type DeeplTranslatorOptions, createDeeplTranslator };
