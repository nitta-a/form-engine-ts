# @form-engine-ts/translator-google-v3

Google Cloud Translation Advanced v3 adapter for form-engine-ts. It supports regional endpoints, glossaries, labels,
automatic batch chunking, and exponential retry for HTTP 429 and 5xx responses.

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
  labels: { application: "survey" }
});

const japanese = await translator.translateText("Thank you", "ja", "en");
```

Keep OAuth access tokens on a trusted server. `translateBatch` automatically divides large arrays into bounded requests.
