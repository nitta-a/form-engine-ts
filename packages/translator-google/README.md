# @form-engine/translator-google

Server-side Google Cloud Translation Basic v2 adapter for form-engine-ts with API Key or Bearer authentication.

## Install

```bash
pnpm add @form-engine/core @form-engine/translator-google
```

## Quick start

```ts
import { createGoogleTranslator } from "@form-engine/translator-google";

const translator = createGoogleTranslator({
  apiKey: process.env.GOOGLE_TRANSLATE_API_KEY!
});

const japanese = await translator.translateText("Thank you", "ja", "en");
```

Keep credentials on a trusted server. For OAuth2 or Service Account authentication, provide `getAccessToken` instead of `apiKey`.
