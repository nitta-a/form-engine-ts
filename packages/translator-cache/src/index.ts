import type { AsyncTranslationAdapter } from "@form-engine-ts/core";

export interface TranslationCacheStorage {
  readonly size?: number;
  readonly evictionCount?: number;
  get(key: string): Promise<string | undefined> | string | undefined;
  set(key: string, value: string, ttlMs?: number): Promise<void> | void;
}

export interface TranslationCacheKeyContext {
  readonly sourceText: string;
  readonly sourceLocale: string;
  readonly targetLocale: string;
  readonly variant?: string;
}

export interface TranslationCacheStats {
  readonly hits: number;
  readonly misses: number;
  readonly evictions: number;
  readonly size: number;
}

export interface TranslationCacheOptions {
  readonly ttlMs?: number;
  readonly keyPrefix?: string;
  readonly adapterName?: string;
  readonly variant?: string;
  readonly buildKey?: (context: TranslationCacheKeyContext) => string;
  readonly onStatsReport?: (stats: TranslationCacheStats) => void;
}

export interface MemoryTranslationCacheOptions {
  readonly maxEntries?: number;
  readonly ttlMs?: number;
  readonly now?: () => number;
}

export interface MemoryTranslationCache extends TranslationCacheStorage {
  readonly size: number;
  readonly evictionCount: number;
  clear(): void;
}

interface MemoryCacheEntry {
  readonly value: string;
  readonly expiresAt: number;
}

const FNV_OFFSET_BASIS = 14_695_981_039_346_656_037n;
const FNV_PRIME = 1_099_511_628_211n;
const UINT64_MASK = 0xffff_ffff_ffff_ffffn;

export function hashTranslationText(text: string): string {
  if (typeof text !== "string") throw new TypeError("text must be a string.");
  let hash = FNV_OFFSET_BASIS;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_PRIME) & UINT64_MASK;
  }
  return hash.toString(16).padStart(16, "0");
}

function requireLocale(value: string, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${name} must not be empty.`);
  return value.trim();
}

function nonNegativeDuration(value: number | undefined, fallback: number, name: string): number {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved < 0) {
    throw new TypeError(`${name} must be a non-negative safe integer.`);
  }
  return resolved;
}

export function createMemoryTranslationCache(options: MemoryTranslationCacheOptions = {}): MemoryTranslationCache {
  const maxEntries = options.maxEntries ?? 500;
  if (!Number.isSafeInteger(maxEntries) || maxEntries < 1) {
    throw new TypeError("maxEntries must be a positive safe integer.");
  }
  const defaultTtlMs = nonNegativeDuration(options.ttlMs, 5 * 60 * 1000, "ttlMs");
  const now = options.now ?? Date.now;
  const entries = new Map<string, MemoryCacheEntry>();
  let evictionCount = 0;

  const evictExpired = (key: string, entry: MemoryCacheEntry): boolean => {
    if (entry.expiresAt > now()) return false;
    entries.delete(key);
    evictionCount += 1;
    return true;
  };

  return {
    get size() {
      for (const [key, entry] of entries) evictExpired(key, entry);
      return entries.size;
    },
    get evictionCount() {
      return evictionCount;
    },
    get(key) {
      const entry = entries.get(key);
      if (entry === undefined || evictExpired(key, entry)) return undefined;
      entries.delete(key);
      entries.set(key, entry);
      return entry.value;
    },
    set(key, value, ttlMs) {
      const resolvedTtlMs = nonNegativeDuration(ttlMs, defaultTtlMs, "ttlMs");
      if (!entries.has(key) && entries.size >= maxEntries) {
        const leastRecentlyUsed = entries.keys().next().value;
        if (leastRecentlyUsed !== undefined) {
          entries.delete(leastRecentlyUsed);
          evictionCount += 1;
        }
      }
      entries.delete(key);
      entries.set(key, { value, expiresAt: now() + resolvedTtlMs });
    },
    clear() {
      entries.clear();
    }
  };
}

export function withTranslationCache(
  baseAdapter: AsyncTranslationAdapter,
  cache: TranslationCacheStorage,
  options: TranslationCacheOptions = {}
): AsyncTranslationAdapter {
  if (typeof baseAdapter?.translateBatch !== "function") throw new TypeError("baseAdapter.translateBatch is required.");
  if (typeof cache?.get !== "function" || typeof cache.set !== "function") {
    throw new TypeError("cache must implement get and set.");
  }
  if (options.ttlMs !== undefined && (!Number.isSafeInteger(options.ttlMs) || options.ttlMs < 0)) {
    throw new TypeError("ttlMs must be a non-negative safe integer.");
  }
  const prefix = options.keyPrefix ?? "form-engine-ts";
  if (prefix.trim().length === 0) throw new TypeError("keyPrefix must not be empty.");
  const adapterName = options.adapterName ?? "anonymous";
  if (adapterName.trim().length === 0) throw new TypeError("adapterName must not be empty.");
  if (options.variant !== undefined && options.variant.trim().length === 0) {
    throw new TypeError("variant must not be empty.");
  }
  if (options.buildKey !== undefined && typeof options.buildKey !== "function") {
    throw new TypeError("buildKey must be a function.");
  }
  const initialEvictionCount = cache.evictionCount ?? 0;
  let hits = 0;
  let misses = 0;

  const reportStats = () => {
    const size = cache.size ?? 0;
    options.onStatsReport?.({
      hits,
      misses,
      evictions: Math.max(0, (cache.evictionCount ?? initialEvictionCount) - initialEvictionCount),
      size
    });
  };

  const translateBatch = async (
    texts: readonly string[],
    targetLocale: string,
    sourceLocale?: string
  ): Promise<readonly string[]> => {
    if (!Array.isArray(texts) || texts.some((text) => typeof text !== "string")) {
      throw new TypeError("texts must be an array of strings.");
    }
    const target = requireLocale(targetLocale, "targetLocale");
    const source = sourceLocale === undefined ? "auto" : requireLocale(sourceLocale, "sourceLocale");
    const keys = texts.map((text) => {
      const context: TranslationCacheKeyContext = {
        sourceText: text,
        sourceLocale: source,
        targetLocale: target,
        ...(options.variant === undefined ? {} : { variant: options.variant })
      };
      const key =
        options.buildKey?.(context) ??
        `${prefix}:${adapterName}:${options.variant === undefined ? "" : `${options.variant}:`}${source}:${target}:${hashTranslationText(text)}`;
      if (typeof key !== "string" || key.length === 0) throw new TypeError("Translation cache key must not be empty.");
      return key;
    });
    const cached = await Promise.all(keys.map((key) => cache.get(key)));
    hits += cached.filter((value) => value !== undefined).length;
    misses += cached.filter((value) => value === undefined).length;
    const missingByKey = new Map<string, { readonly text: string; readonly indices: number[] }>();
    for (let index = 0; index < texts.length; index += 1) {
      if (cached[index] !== undefined) continue;
      const key = keys[index];
      const text = texts[index];
      if (key === undefined || text === undefined) throw new Error("Translation cache index is unavailable.");
      const missing = missingByKey.get(key);
      if (missing === undefined) missingByKey.set(key, { text, indices: [index] });
      else missing.indices.push(index);
    }
    if (missingByKey.size > 0) {
      const missing = [...missingByKey.entries()];
      const translated = await baseAdapter.translateBatch(
        missing.map(([, value]) => value.text),
        target,
        sourceLocale
      );
      if (translated.length !== missing.length) {
        throw new Error(`Translation adapter returned ${translated.length} values for ${missing.length} cache misses.`);
      }
      await Promise.all(
        missing.map(async ([key, value], translatedIndex) => {
          const translation = translated[translatedIndex];
          if (translation === undefined) throw new Error("Translation adapter result is unavailable.");
          await cache.set(key, translation, options.ttlMs);
          for (const index of value.indices) cached[index] = translation;
        })
      );
    }
    const result = cached.map((value) => {
      if (value === undefined) throw new Error("Translation cache result is unavailable.");
      return value;
    });
    reportStats();
    return result;
  };

  return {
    async translateText(text, targetLocale, sourceLocale) {
      const translated = await translateBatch([text], targetLocale, sourceLocale);
      const value = translated[0];
      if (value === undefined) throw new Error("Translation cache returned no translation.");
      return value;
    },
    translateBatch
  };
}
