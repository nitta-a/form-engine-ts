# @form-engine-ts/translator-i18next

Official i18next adapter for the form-engine-ts `TranslationAdapter` contract.

## Install

```bash
pnpm add @form-engine-ts/core @form-engine-ts/translator-i18next i18next
```

## Quick start

```ts
import i18next from "i18next";
import { createI18nextTranslator } from "@form-engine-ts/translator-i18next";

const translator = createI18nextTranslator({ i18n: i18next });
translator.translate("builder.questionTitle", "ja", { count: 2 });
```

The adapter passes the requested locale as `lng` and returns `undefined` for missing keys when i18next's `exists`
method reports that the key is unavailable. This allows form-engine-ts to use its normal fallback catalog and legacy
translation aliases. Use `keyPrefix` for catalogs nested below a namespace and `fallbackLocales` to try additional
locales:

```ts
const translator = createI18nextTranslator({
  i18n,
  namespace: "common",
  keyPrefix: "formEngine",
  fallbackLocales: ["ja"]
});
```
