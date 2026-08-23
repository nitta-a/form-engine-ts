# @form-engine/translator-mock

Synchronous English/Japanese translation adapter for form-engine-ts demos and tests, with interpolation and locale fallback.

## Install

```bash
pnpm add @form-engine/core @form-engine/translator-mock
```

## Quick start

```ts
import { createMockTranslationAdapter } from "@form-engine/translator-mock";

const translator = createMockTranslationAdapter({
  en: { greeting: "Hello, {{name}}!" },
  ja: { greeting: "こんにちは、{{name}}さん！" }
});

translator.translate("greeting", "ja", { name: "Ada" });
```
