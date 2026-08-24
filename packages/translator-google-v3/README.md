# @form-engine-ts/translator-google-v3

Google Cloud Translation Advanced v3 adapter for form-engine-ts. It supports regional endpoints, glossaries, labels,
UTF-8-aware batch chunking, and transient network/HTTP retry with `Retry-After`-aware full jitter.

## Install

```bash
pnpm add @form-engine-ts/core @form-engine-ts/translator-google-v3
```

## Quick start

```ts
import { createGoogleV3Translator } from "@form-engine-ts/translator-google-v3";

const translator = createGoogleV3Translator({
  projectId: "my-project",
  location: "us-central1",
  getAccessToken: () => getGoogleAccessToken(),
  glossaryConfig: {
    glossary: "projects/my-project/locations/us-central1/glossaries/product-terms"
  },
  labels: { application: "survey" },
  onBatchReport: (report) => console.info(report)
});

const japanese = await translator.translateText("Thank you", "ja", "en");
```

Keep OAuth access tokens on a trusted server. `translateBatch` defaults to at most 250 items and 25,000 UTF-8 bytes per
request (hard limits: 1,024 items and 30,000 bytes). Network errors, HTTP 429, and HTTP 5xx responses are retried; customize
batch and retry behavior with `batchLimits` and `retry`.

Blank and whitespace-only inputs are omitted from API requests and restored as empty output strings in their original
positions. `onBatchReport` receives `totalChunks`, Unicode-code-point `totalCharacters`, aggregate retry attempts, total
duration, `cacheHitCount`, `cacheMissCount`, and `evictionCount` after each `translateBatch` call.
