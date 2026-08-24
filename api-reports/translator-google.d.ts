import { AsyncTranslationAdapter } from '@form-engine-ts/core';

interface GoogleTranslatorOptions {
    readonly apiKey?: string;
    readonly getAccessToken?: () => Promise<string> | string;
    readonly fetchFn?: typeof fetch;
    readonly apiEndpoint?: string;
}
declare function createGoogleTranslator(options: GoogleTranslatorOptions): AsyncTranslationAdapter;

export { type GoogleTranslatorOptions, createGoogleTranslator };
