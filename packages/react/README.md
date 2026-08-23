# @form-engine-ts/react

SSR-safe React renderer, visual form builder, provider, hooks, component overrides, and base styles for form-engine-ts.

## Install

```bash
pnpm add @form-engine-ts/core @form-engine-ts/react @form-engine-ts/translator-mock react react-dom
```

## Quick start

```tsx
import type { FormSchema } from "@form-engine-ts/core";
import { FormProvider, FormRenderer } from "@form-engine-ts/react";
import "@form-engine-ts/react/styles.css";
import { mockTranslator } from "@form-engine-ts/translator-mock";

const schema: FormSchema = {
  id: "contact",
  version: 1,
  title: "Contact",
  fields: [{ id: "name", type: "text", title: "Name", required: true }]
};

export function ContactForm() {
  return (
    <FormProvider
      schema={schema}
      locale="en"
      translator={mockTranslator}
      onSubmit={async (values) => console.log(values)}
    >
      <FormRenderer />
    </FormProvider>
  );
}
```

Use any compatible `TranslationAdapter` in place of the mock translator.
