# @form-engine-ts/core

Framework-independent schemas, validation, submissions, analytics, CSV export, and adapter contracts for form-engine-ts.

## Install

```bash
pnpm add @form-engine-ts/core
```

## Quick start

```ts
import { type FormSchema, validateAnswers } from "@form-engine-ts/core";

const schema: FormSchema = {
  id: "contact",
  version: 1,
  title: "Contact",
  fields: [{ id: "name", type: "text", title: "Name", required: true }]
};

const result = validateAnswers(schema, { name: "Ada" });
if (!result.valid) console.error(result.issues);
```

## Multi-step, localization, analytics, and events

Add `pages` to partition every field into an accessible wizard and use `validatePageAnswers(schema, pageIndex, values)`
for step-scoped validation. Schemas without `pages` remain single-page forms.

Store authoring-time translations on forms, fields, options, and pages. `resolveLocalizedSchema` applies them synchronously,
while `populateSchemaTranslations` fills them through an injected `AsyncTranslationAdapter`. Population defaults to
`overwrite: "missing-only"`, accepts per-slot `shouldOverwrite` and `createMetadata` callbacks, and returns
`{ schema, report }` with updated and skipped translation slots.

Forms, pages, fields, options, and submissions accept JSON-only `metadata` and per-locale/property
`translationMetadata`. These extension values survive sanitization, localization, submission creation, and storage
round-trips. `completionMessage` is localized with the rest of the form text.

`transformFieldType` changes a question's type without discarding source text, translations, conditions, or extension
metadata. `validateFormSchema(schema, { policy })` applies the framework-independent `FormPolicy`, including field,
option, text, serialized-byte, allowed-type, and locale constraints. `allowedLocales` constrains the default and supported
locales, `maxLocales` limits their unique total, and contradictory required/allowed locale policies are reported.
Required locales cover every source text that exists on the form, its fields, options, and pages.

Translation callbacks receive `nodeMetadata` and `existingTranslationMetadata` separately. The deprecated `metadata`
slot property remains an alias for `nodeMetadata` during migration.

`calculateCrossTabulation` builds a two-question frequency matrix from submissions. `dispatchWebhook` posts typed
`response.submitted` or `schema.updated` events with timeout handling, custom headers, and optional HMAC-SHA256 signing.

CSV export neutralizes string cells whose first non-whitespace character is `=`, `+`, `-`, or `@`. This is enabled by
default; trusted callers can pass `{ neutralizeFormulas: false }`. RFC 4180 quoting and the UTF-8 BOM remain unchanged.
The columns are exactly `submissionId`, `submittedAt`, `locale`, followed by one column per field in schema order.

Storage adapters share inclusive ISO 8601 submission-range filtering:

```ts
import type { SubmissionQueryOptions } from "@form-engine-ts/core";

const range: SubmissionQueryOptions = {
  since: "2026-01-01T00:00:00.000Z",
  until: "2026-01-31T23:59:59.999Z"
};
const submissions = await storage.listSubmissions("contact", 1, range);
```

Results are ordered by `submittedAt`, then submission ID. Both boundaries are inclusive.

See the [project documentation](https://github.com/nitta-a/form-engine-ts#readme) for the complete schema and API guide.
