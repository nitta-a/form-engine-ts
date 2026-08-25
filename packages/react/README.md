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
schema-byte limits, and required/allowed/maximum locale constraints identically in browser and server code. Every mutation returns a typed
`BuilderActionResult`; invalid, empty, or duplicate generated IDs leave the schema unchanged. `BuilderFactories` injects
initial field, option, and page shapes. `<FormBuilder>` delegates its UI mutations to this hook and accepts the same
options. Its completion-message editors cover both source and locale text. `translationOptions` and
`onTranslationReport` expose automatic-translation policy and reporting.

Visual-builder field creation uses `defaultFieldType` when it is allowed, otherwise the first allowed policy type, then
`text` when unrestricted. The add button is disabled when no type is allowed or `maxFields` is reached.
`onActionError` receives typed failures from visual headless actions, and `createManualTranslationMetadata` can attach
per-locale/property metadata to manual edits. Automatic translation defaults to `overwrite: "missing-only"`; explicitly
pass `{ overwrite: "all" }` to replace existing translations.

Pass `readOnly` to keep the complete builder visible while disabling every mutation. The `features` prop independently
controls `pages`, `localization`, and `conditions` authoring surfaces; each defaults to `true`. When `allowedLocales` is
set, locale addition becomes a selector containing only unregistered allowed locales, and the action is disabled at
`maxLocales`.

Visual Builder has two independent design-system extension layers. `components` replaces normalized primitives such as
`Button`, `TextInput`, `TextArea`, `Select`, `Checkbox`, `Section`, and `Fieldset`. `slots` replaces complete authoring
surfaces: `toolbar`, `fieldEditor`, `optionEditor`, `pages`, `localization`, or `translationActions`. Slot props expose
policy-aware `actions` and the builder's resolved `translate(key, params)` function. Feature-aware slots also receive the
relevant feature state, while localization slots receive policy and translation-adapter availability. A custom
`translationActions` slot can therefore call an application-specific AI mutation while the standard manual localization
editors remain unchanged. A slot collection can set `sectionOrder` to arrange `basicSettings`, `completionMessage`,
`questions`, `addQuestion`, and `localization` as independent authoring sections.

Slot actions include `setManualTranslation(locale, target, property, text)`. It resolves the target's source text and
existing translation metadata, invokes `createManualTranslationMetadata`, and then stores the translated text and
generated metadata together. Custom field, page, option, and localization slots should use this action for user-edited
translations; `setLocaleTranslation` remains available for callers that already provide explicit metadata.

Input primitives receive design-system-friendly `name`, `label`, `required`, `error`, and `helperText` props in addition
to their normalized string-value callbacks. The `translationActions` slot also receives `translationError`, the latest
`translationReport`, and `onClearTranslationError`, allowing a custom MUI action surface to represent the complete
translation lifecycle.

`FormBuilder` adds `disableDefaultStyles` and its `unstyled` alias for design systems that provide their own styling.
When either is enabled, the builder omits its `form-engine-builder` and `feb-*` classes. Injected `TextInput`, `TextArea`,
and `Select` components receive the field `label` and accessibility attributes and are responsible for rendering their
own labels. Builder action icons can be supplied with `renderIcon`, which resolves `actionType` values such as
`moveUp`, `moveDown`, `delete`, and `add`.

```tsx
<FormBuilder
  schema={schema}
  onChange={setSchema}
  components={{ Button: MuiButtonAdapter, TextInput: MuiTextFieldAdapter }}
  slots={{ translationActions: ArgsAiTranslationActions }}
/>
```

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
    renderSubmitButton: ({ isSubmitting, disabled, onSubmit }) => (
      <MyButton loading={isSubmitting} disabled={disabled} onClick={onSubmit}>Save</MyButton>
    ),
    renderSubmitError: ({ error, onRetry }) => <MyError error={error} onRetry={onRetry} />
  }}
/>
```

Validation runs before `beforeSubmit`. A `"cancel"` result does not call `onSubmit` and preserves values and drafts.
Header, page-header, field, navigation, submit, validation-summary, completion, and submit-error slots can replace the
default UI. The localized `completionMessage` is displayed after a successful submission. Set
`successRenderMode="replace"` to remove the questions, navigation, and submit button after success and focus the
completion status region; the default `"append"` mode preserves the existing form UI. `hideFormOnSuccess` is retained
as a deprecated alias for `successRenderMode="replace"`. The submit-button slot receives `submitStatus` and `disabled`
in addition to `isSubmitting` and `onSubmit`.

Pass ordered `submissionGuards` to allow, block, or require confirmation before `onSubmit`. Confirmation receives all
guard findings through `renderSubmissionConfirmation`. A `receiptStore` prevents accidental repeat submissions and can
be created with the SSR-safe `createLocalStorageSubmissionReceiptStore`; `renderAlreadySubmitted` customizes its return
state. Text controls forward schema `minLength`, `maxLength`, and `pattern` constraints to the DOM, and
`renderCharacterCount` can replace the default count. Guard evaluation, confirmation, receipt persistence, and provider
submission share an in-flight lock so rapid clicks cannot submit twice.

The Builder basic-settings section edits source `title` and `description` through the same policy-aware action pipeline.
Submission confirmation slots receive the effective message, localized schema, and visible answers. An `onSubmit` result
may provide `submissionId` and `submittedAt`, which Renderer copies into its receipt. Receipt stores support `getBatch`,
and `useSubmissionReceipts` loads multiple form/version receipts for list and dashboard surfaces.

Receipt persistence is best-effort: `onReceiptError` observes storage failures while the successful completion screen is
preserved. Pass an SSR-safe `createLocalStorageSubmissionAttemptStore()` as `attemptStore` to reserve an ID immediately
before submission. Renderer injects it as `attemptId` and `submissionId`, retains it after a failed request, promotes it
to the receipt after success, and then clears the attempt. Custom receipt stores may omit `getBatch`; the hook falls back
to concurrent `get` calls.
