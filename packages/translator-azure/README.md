# @form-engine-ts/translator-azure

Server-side Azure AI Translator REST API v3.0 adapter for form-engine-ts.

## Install

```bash
pnpm add @form-engine-ts/core @form-engine-ts/translator-azure
```

## Quick start

```ts
import { createAzureTranslator } from "@form-engine-ts/translator-azure";

const translator = createAzureTranslator({
  apiKey: process.env.AZURE_TRANSLATOR_KEY!,
  region: "japaneast"
});

const japanese = await translator.translateText("Thank you", "ja", "en");
```

Keep credentials on a trusted server. Custom-domain endpoints must include the complete Translate operation path.
