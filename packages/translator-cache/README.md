# @form-engine-ts/translator-cache

Cache decorator for any `AsyncTranslationAdapter`. Cache storage is injected, so applications can use memory, Redis,
durable edge storage, or another TTL-capable backend without coupling the package to a vendor.

## Install

```bash
pnpm add @form-engine-ts/core @form-engine-ts/translator-cache
```

## Usage

```ts
import { withTranslationCache } from "@form-engine-ts/translator-cache";

const translator = withTranslationCache(baseTranslator, cacheStorage, {
  ttlMs: 60 * 60 * 1000,
  keyPrefix: "survey-translations"
});
```

Keys isolate source locale, target locale, and a deterministic UTF-8 hash of the source text. Batch misses are deduplicated,
translated once in source order, cached, and restored to their original positions.
