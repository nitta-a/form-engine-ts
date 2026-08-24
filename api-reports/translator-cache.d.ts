import { AsyncTranslationAdapter } from '@form-engine-ts/core';

interface TranslationCacheStorage {
    readonly size?: number;
    readonly evictionCount?: number;
    get(key: string): Promise<string | undefined> | string | undefined;
    set(key: string, value: string, ttlMs?: number): Promise<void> | void;
}
interface TranslationCacheKeyContext {
    readonly sourceText: string;
    readonly sourceLocale: string;
    readonly targetLocale: string;
    readonly variant?: string;
}
interface TranslationCacheStats {
    readonly hits: number;
    readonly misses: number;
    readonly evictions: number;
    readonly size: number;
}
interface TranslationCacheOptions {
    readonly ttlMs?: number;
    readonly keyPrefix?: string;
    readonly adapterName?: string;
    readonly variant?: string;
    readonly buildKey?: (context: TranslationCacheKeyContext) => string;
    readonly onStatsReport?: (stats: TranslationCacheStats) => void;
}
interface MemoryTranslationCacheOptions {
    readonly maxEntries?: number;
    readonly ttlMs?: number;
    readonly now?: () => number;
}
interface MemoryTranslationCache extends TranslationCacheStorage {
    readonly size: number;
    readonly evictionCount: number;
    clear(): void;
}
declare function hashTranslationText(text: string): string;
declare function createMemoryTranslationCache(options?: MemoryTranslationCacheOptions): MemoryTranslationCache;
declare function withTranslationCache(baseAdapter: AsyncTranslationAdapter, cache: TranslationCacheStorage, options?: TranslationCacheOptions): AsyncTranslationAdapter;

export { type MemoryTranslationCache, type MemoryTranslationCacheOptions, type TranslationCacheKeyContext, type TranslationCacheOptions, type TranslationCacheStats, type TranslationCacheStorage, createMemoryTranslationCache, hashTranslationText, withTranslationCache };
