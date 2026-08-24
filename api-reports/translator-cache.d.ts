import { AsyncTranslationAdapter } from '@form-engine-ts/core';

interface TranslationCacheStorage {
    get(key: string): Promise<string | undefined> | string | undefined;
    set(key: string, value: string, ttlMs?: number): Promise<void> | void;
}
interface TranslationCacheOptions {
    readonly ttlMs?: number;
    readonly keyPrefix?: string;
    readonly adapterName?: string;
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

export { type MemoryTranslationCache, type MemoryTranslationCacheOptions, type TranslationCacheOptions, type TranslationCacheStorage, createMemoryTranslationCache, hashTranslationText, withTranslationCache };
