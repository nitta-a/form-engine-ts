# @form-engine-ts/translator-mock

English/Japanese synchronous catalogs and deterministic asynchronous batch translation for form-engine-ts demos and tests.

## Install

```bash
pnpm add @form-engine-ts/core @form-engine-ts/translator-mock
```

## Quick start

```ts
import { createMockTranslationAdapter } from "@form-engine-ts/translator-mock";

const translator = createMockTranslationAdapter({
  en: { greeting: "Hello, {{name}}!" },
  ja: { greeting: "こんにちは、{{name}}さん！" }
});

translator.translate("greeting", "ja", { name: "Ada" });
```

`mockAsyncTranslator` and `createMockAsyncTranslationAdapter()` provide deterministic batch output for exercising the
FormBuilder pre-translation workflow without network access.
