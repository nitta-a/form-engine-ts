import type { AsyncTranslationAdapter } from "@form-engine-ts/core";
import {
  createMemoryTranslationCache,
  hashTranslationText,
  type TranslationCacheStorage,
  withTranslationCache
} from "../src";

function createCache() {
  const values = new Map<string, string>();
  const set = vi.fn((key: string, value: string) => {
    values.set(key, value);
  });
  const cache: TranslationCacheStorage = {
    get: (key) => values.get(key),
    set
  };
  return { cache, set, values };
}

describe("withTranslationCache", () => {
  it("bypasses the base batch adapter for a repeated translation", async () => {
    const translateBatch = vi.fn(async (texts: readonly string[], target: string) =>
      texts.map((text) => `${target}:${text}`)
    );
    const base: AsyncTranslationAdapter = {
      translateText: async (text, target) => `${target}:${text}`,
      translateBatch
    };
    const { cache, set } = createCache();
    const translator = withTranslationCache(base, cache, {
      ttlMs: 60_000,
      keyPrefix: "test",
      adapterName: "google-v3"
    });
    await expect(translator.translateBatch(["hello"], "ja", "en")).resolves.toEqual(["ja:hello"]);
    await expect(translator.translateBatch(["hello"], "ja", "en")).resolves.toEqual(["ja:hello"]);
    expect(translateBatch).toHaveBeenCalledOnce();
    expect(set).toHaveBeenCalledWith(`test:google-v3:en:ja:${hashTranslationText("hello")}`, "ja:hello", 60_000);
  });

  it("deduplicates misses and restores cached and translated values in input order", async () => {
    const translateBatch = vi.fn(async (texts: readonly string[]) => texts.map((text) => text.toUpperCase()));
    const base: AsyncTranslationAdapter = { translateText: async (text) => text.toUpperCase(), translateBatch };
    const { cache, values } = createCache();
    values.set(`form-engine-ts:anonymous:en:ja:${hashTranslationText("cached")}`, "CACHED");
    const translator = withTranslationCache(base, cache);
    await expect(translator.translateBatch(["new", "cached", "new"], "ja", "en")).resolves.toEqual([
      "NEW",
      "CACHED",
      "NEW"
    ]);
    expect(translateBatch).toHaveBeenCalledWith(["new"], "ja", "en");
  });

  it("isolates locale pairs and validates adapter result lengths", async () => {
    const translateBatch = vi.fn(async () => [] as string[]);
    const base: AsyncTranslationAdapter = { translateText: async () => "", translateBatch };
    const { cache } = createCache();
    const translator = withTranslationCache(base, cache);
    await expect(translator.translateBatch(["text"], "ja", "en")).rejects.toThrow(/0 values for 1/);
  });

  it("provides a bounded LRU cache with deterministic TTL expiry and eviction metrics", () => {
    let time = 100;
    const cache = createMemoryTranslationCache({ maxEntries: 2, ttlMs: 50, now: () => time });
    cache.set("a", "A");
    cache.set("b", "B");
    expect(cache.get("a")).toBe("A");
    cache.set("c", "C");
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe("A");
    expect(cache.evictionCount).toBe(1);
    time = 151;
    expect(cache.get("a")).toBeUndefined();
    expect(cache.size).toBe(0);
    expect(cache.evictionCount).toBe(3);
  });

  it("reports exact cumulative hits, misses, evictions, and variant-isolated keys", async () => {
    const cache = createMemoryTranslationCache({ maxEntries: 1 });
    const reports: Array<{ hits: number; misses: number; evictions: number; size: number }> = [];
    const translateBatch = vi.fn(async (texts: readonly string[]) => texts.map((text) => text.toUpperCase()));
    const base: AsyncTranslationAdapter = { translateText: async (text) => text.toUpperCase(), translateBatch };
    const translator = withTranslationCache(base, cache, {
      adapterName: "google-v3",
      variant: "glossary-a",
      onStatsReport: (stats) => reports.push(stats)
    });
    await translator.translateBatch(["hello"], "ja", "en");
    await translator.translateBatch(["hello"], "ja", "en");
    await translator.translateBatch(["other"], "ja", "en");
    expect(reports).toEqual([
      { hits: 0, misses: 1, evictions: 0, size: 1 },
      { hits: 1, misses: 1, evictions: 0, size: 1 },
      { hits: 1, misses: 2, evictions: 1, size: 1 }
    ]);
    expect(translateBatch).toHaveBeenCalledTimes(2);
  });

  it("supports a custom key builder with variant context", async () => {
    const { cache, set } = createCache();
    const buildKey = vi.fn(
      ({ sourceText, variant }: { sourceText: string; variant?: string }) => `${variant}:${sourceText}`
    );
    const base: AsyncTranslationAdapter = {
      translateText: async (text) => text,
      translateBatch: async (texts) => texts
    };
    const translator = withTranslationCache(base, cache, { variant: "model-2", buildKey });
    await translator.translateText("hello", "ja", "en");
    expect(buildKey).toHaveBeenCalledWith({
      sourceText: "hello",
      sourceLocale: "en",
      targetLocale: "ja",
      variant: "model-2"
    });
    expect(set).toHaveBeenCalledWith("model-2:hello", "hello", undefined);
  });

  it("bypasses cache get and set failures while reporting them", async () => {
    const getError = new Error("cache get unavailable");
    const setError = new Error("cache set unavailable");
    const onCacheError = vi.fn();
    const translateBatch = vi.fn(async (texts: readonly string[]) => texts.map((text) => text.toUpperCase()));
    const translator = withTranslationCache(
      { translateText: async (text) => text.toUpperCase(), translateBatch },
      {
        get() {
          throw getError;
        },
        async set() {
          throw setError;
        }
      },
      { onCacheError }
    );
    await expect(translator.translateBatch(["hello"], "ja", "en")).resolves.toEqual(["HELLO"]);
    expect(translateBatch).toHaveBeenCalledWith(["hello"], "ja", "en");
    expect(onCacheError).toHaveBeenNthCalledWith(1, getError, "get");
    expect(onCacheError).toHaveBeenNthCalledWith(2, setError, "set");
  });

  it("propagates cache errors when cacheErrorPolicy is throw", async () => {
    const error = new Error("strict cache failure");
    const translateBatch = vi.fn(async (texts: readonly string[]) => texts);
    const translator = withTranslationCache(
      { translateText: async (text) => text, translateBatch },
      {
        async get() {
          throw error;
        },
        async set() {}
      },
      { cacheErrorPolicy: "throw" }
    );
    await expect(translator.translateText("hello", "ja", "en")).rejects.toBe(error);
    expect(translateBatch).not.toHaveBeenCalled();
  });
});
