import type { AsyncTranslationAdapter } from "@form-engine-ts/core";
import { hashTranslationText, type TranslationCacheStorage, withTranslationCache } from "../src";

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
    const translator = withTranslationCache(base, cache, { ttlMs: 60_000, keyPrefix: "test" });
    await expect(translator.translateBatch(["hello"], "ja", "en")).resolves.toEqual(["ja:hello"]);
    await expect(translator.translateBatch(["hello"], "ja", "en")).resolves.toEqual(["ja:hello"]);
    expect(translateBatch).toHaveBeenCalledOnce();
    expect(set).toHaveBeenCalledWith(`test:en:ja:${hashTranslationText("hello")}`, "ja:hello", 60_000);
  });

  it("deduplicates misses and restores cached and translated values in input order", async () => {
    const translateBatch = vi.fn(async (texts: readonly string[]) => texts.map((text) => text.toUpperCase()));
    const base: AsyncTranslationAdapter = { translateText: async (text) => text.toUpperCase(), translateBatch };
    const { cache, values } = createCache();
    values.set(`form-engine-ts:en:ja:${hashTranslationText("cached")}`, "CACHED");
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
});
