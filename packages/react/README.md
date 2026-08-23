# @form-engine/react

SSR-safe React renderer, visual form builder, provider, hooks, component overrides, and base styles for form-engine-ts.

## Install

```bash
pnpm add @form-engine/core @form-engine/react @form-engine/translator-mock react react-dom
```

## Quick start

```tsx
import type { FormSchema } from "@form-engine/core";
import { FormProvider, FormRenderer } from "@form-engine/react";
import "@form-engine/react/styles.css";
import { mockTranslator } from "@form-engine/translator-mock";

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
