import { AsyncTranslationAdapter } from '@form-engine-ts/core';

interface GoogleV3GlossaryConfig {
    /** Glossary ID or fully qualified glossary resource name. */
    readonly glossary: string;
    /** Whether glossary matching should ignore case. */
    readonly ignoreCase?: boolean;
}
type GlossaryResolver = (context: {
    readonly sourceLocale: string;
    readonly targetLocale: string;
}) => string | GoogleV3GlossaryConfig | undefined;
interface GoogleV3TranslationAdapter extends AsyncTranslationAdapter {
    /** Returns the glossary resource used for a locale pair, for cache-key isolation. */
    getCacheVariant(targetLocale: string, sourceLocale?: string): string | undefined;
}
interface GoogleV3TranslatorOptions {
    readonly projectId: string;
    readonly location?: string;
    readonly getAccessToken?: () => Promise<string> | string;
    readonly apiKey?: string;
    readonly glossaryConfig?: GoogleV3GlossaryConfig | string;
    readonly glossaryResolver?: GlossaryResolver;
    readonly labels?: Readonly<Record<string, string>>;
    readonly fetchFn?: typeof fetch;
    readonly fetchImpl?: typeof fetch;
    readonly apiEndpoint?: string;
    readonly batchLimits?: BatchSplitLimits;
    readonly retry?: RetryConfig;
    readonly maxBatchSize?: number;
    readonly maxRetries?: number;
    readonly retryBaseDelayMs?: number;
    readonly maxRetryDelayMs?: number;
    readonly sleep?: (milliseconds: number) => Promise<void>;
    readonly random?: () => number;
    readonly now?: () => number;
    readonly onBatchReport?: (report: TranslationBatchReport) => void;
}
interface BatchSplitLimits {
    readonly maxItems?: number;
    /** UTF-8 bytes across all text items in a request. */
    readonly maxCharacters?: number;
}
interface RetryConfig {
    readonly maxRetries?: number;
    readonly baseDelayMs?: number;
    readonly maxDelayMs?: number;
}
interface TranslationBatchReport {
    readonly totalChunks: number;
    readonly totalCharacters: number;
    readonly retryAttempts: number;
    readonly durationMs: number;
    readonly cacheHitCount: number;
    readonly cacheMissCount: number;
    readonly evictionCount: number;
    readonly glossary?: string;
}
declare function splitTranslationBatch(texts: readonly string[], limits?: BatchSplitLimits): string[][];
declare function createGoogleV3Translator(options: GoogleV3TranslatorOptions): AsyncTranslationAdapter;

export { type BatchSplitLimits, type GlossaryResolver, type GoogleV3GlossaryConfig, type GoogleV3TranslationAdapter, type GoogleV3TranslatorOptions, type RetryConfig, type TranslationBatchReport, createGoogleV3Translator, splitTranslationBatch };
