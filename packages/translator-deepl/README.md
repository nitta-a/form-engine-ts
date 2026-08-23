# @form-engine-ts/translator-deepl

Server-side DeepL Free/Pro asynchronous translation adapter for form-engine-ts.

## Install

```bash
pnpm add @form-engine-ts/core @form-engine-ts/translator-deepl
```

## Quick start

```ts
import { createDeeplTranslator } from "@form-engine-ts/translator-deepl";

const translator = createDeeplTranslator({
  apiKey: process.env.DEEPL_API_KEY!,
  apiType: "pro"
});

const japanese = await translator.translateText("Thank you", "JA", "EN");
```

Keep credentials on a trusted server. Use `apiType: "free"` for DeepL API Free.
