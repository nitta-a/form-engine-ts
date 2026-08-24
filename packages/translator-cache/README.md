# @form-engine-ts/translator-cache

Cache decorator for any `AsyncTranslationAdapter`. Cache storage is injected, so applications can use memory, Redis,
durable edge storage, or another TTL-capable backend without coupling the package to a vendor.

## Install

```bash
pnpm add @form-engine-ts/core @form-engine-ts/translator-cache
```

## Usage

```ts
import { createMemoryTranslationCache, withTranslationCache } from "@form-engine-ts/translator-cache";

const cache = createMemoryTranslationCache({ maxEntries: 500, ttlMs: 5 * 60 * 1000 });
const translator = withTranslationCache(baseTranslator, cache, {
  ttlMs: 60 * 60 * 1000,
  keyPrefix: "survey-translations",
  adapterName: "google-v3"
});
```

Keys isolate adapter name, source locale, target locale, and a deterministic UTF-8 hash of the source text. Batch misses
are deduplicated, translated once in source order, cached, and restored to their original positions. The built-in memory
cache applies both TTL expiration and bounded LRU eviction and exposes `size`, `evictionCount`, and `clear()` diagnostics.
Use `variant` to isolate glossary/model/configuration revisions, or `buildKey` for complete key control.
`onStatsReport` receives cumulative real cache hits, misses, evictions, and current size after successful translations.
