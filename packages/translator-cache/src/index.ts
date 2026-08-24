import type { AsyncTranslationAdapter } from "@form-engine-ts/core";

export interface TranslationCacheStorage {
  get(key: string): Promise<string | undefined> | string | undefined;
  set(key: string, value: string, ttlMs?: number): Promise<void> | void;
}

export interface TranslationCacheOptions {
  readonly ttlMs?: number;
  readonly keyPrefix?: string;
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
    const keys = texts.map((text) => `${prefix}:${source}:${target}:${hashTranslationText(text)}`);
    const cached = await Promise.all(keys.map((key) => cache.get(key)));
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
    return cached.map((value) => {
      if (value === undefined) throw new Error("Translation cache result is unavailable.");
      return value;
    });
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
