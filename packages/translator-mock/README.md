# @form-engine-ts/translator-mock

Synchronous English/Japanese translation adapter for form-engine-ts demos and tests, with interpolation and locale fallback.

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
