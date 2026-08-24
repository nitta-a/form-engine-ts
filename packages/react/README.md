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

Define `schema.pages` to enable Back/Next navigation, page validation, conditional page skipping, and an accessible
progress indicator. Pass `autoSaveKey` to persist a versioned draft in `localStorage` after a 500ms debounce and restore it
on the next mount:

```tsx
<FormRenderer autoSaveKey={`contact-draft:${schema.version}`} />
```

`FormProvider` resolves authoring-time translations synchronously whenever `locale` changes. `FormBuilder` includes page
membership controls and localization editors; pass an `AsyncTranslationAdapter` as `translationAdapter` to enable its
batch-translation action.

## Headless builder and renderer lifecycle

`useFormBuilder({ schema, onChange, policy, idFactory, factories })` exposes controlled field, option, page, condition,
source-text, and localized-text actions. Core's `FormPolicy` enforces allowed field types, field/option limits, text and
schema-byte limits, and required locales identically in browser and server code. Every mutation returns a typed
`BuilderActionResult`; invalid, empty, or duplicate generated IDs leave the schema unchanged. `BuilderFactories` injects
initial field, option, and page shapes. `<FormBuilder>` delegates its UI mutations to this hook and accepts the same
options. Its completion-message editors cover both source and locale text. `translationOptions` and
`onTranslationReport` expose automatic-translation policy and reporting.

`FormRenderer` can also be used without an explicit provider:

```tsx
<FormRenderer
  schema={schema}
  locale="en"
  beforeSubmit={async (values) => (await confirmValues(values) ? "continue" : "cancel")}
  onSubmit={saveValues}
  onDraftSave={saveDraft}
  slots={{
    renderHeader: ({ title }) => <MyHeader>{title}</MyHeader>,
    renderPageHeader: ({ page }) => <MyPageHeader page={page} />,
    renderField: (props) => <MyField {...props} />,
    renderSubmitButton: ({ isSubmitting, onSubmit }) => (
      <MyButton disabled={isSubmitting} onClick={onSubmit}>Save</MyButton>
    ),
    renderSubmitError: ({ error, onRetry }) => <MyError error={error} onRetry={onRetry} />
  }}
/>
```

Validation runs before `beforeSubmit`. A `"cancel"` result does not call `onSubmit` and preserves values and drafts.
Header, page-header, field, navigation, submit, validation-summary, completion, and submit-error slots can replace the
default UI. The localized `completionMessage` is displayed after a successful submission.
