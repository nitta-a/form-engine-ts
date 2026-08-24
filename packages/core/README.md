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

`collectSchemaLocales(schema)` scans registrations plus every form/page/field/option `translations` and
`translationMetadata` key. Validation reports unregistered translation locales and applies `allowedLocales` and
`maxLocales` to the complete collected set. `sanitizeSchema` purges unregistered locale content. Pass
`{ policy: { allowedLocales, maxLocales } }` to `populateSchemaTranslations` to reject inadmissible targets before the
translation adapter runs.

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

## Versioning, incremental analytics, and paged storage

`cloneVersionToDraft`, asynchronous `publishDraft`, and `deleteDraft` implement revision-checked version transitions as
pure functions. `createCloneTransitionPlan`, `createPublishTransitionPlan`, and `createDeleteDraftTransitionPlan` produce
complete persistence plans with the next state, affected records, and immutable audit events.
Clone/delete operations accept `expectedRevision`; cloning rejects non-published sources, publish validation failures are
returned as typed `validation_failed` issues, and successful publishing archives only a supplied actual published record,
preserving its schema and metadata. `createPublishTransitionPlan` returns complete records plus expected/next revisions for
storage adapters implementing `VersionedFormStorageAdapter` to commit atomically. Versioned adapters expose state/record
reads and return a typed `Result` from `commitVersionTransition`, including the actual revision on concurrency conflicts.
`createResponseAccumulator` incrementally counts choices, answered/unanswered values, and numeric summaries without retaining
free-text bodies. In lenient mode, mismatched responses are skipped and exposed by `addMany()` and `getReport()` instead of
being included silently. Independent accumulators for the same schema can be merged, and `finalize()` matches
`aggregateResponses`.

`exportResponsesToCsvStream` accepts an `AsyncIterable`, emits the BOM/header and one chunk per response, and supports
custom `CsvColumnDef` columns. Custom getters may be asynchronous and receive the submission, form version, and schema. Use
`pipeResponsesToCsvStream` to write to a Web `WritableStream` or Node-compatible writable while honoring backpressure.
Formula-injection neutralization applies to both default and custom columns.

Adapters implementing `PagedSubmissionStorageAdapter` expose `listSubmissionPage(formId, options)`. The opaque Base64
cursor combines `submittedAt` and response ID, so equal timestamps do not produce gaps or duplicates. `metadataFilters`
and `filter` are applied before page sizing. `filter` accepts a composable `eq`/`in`/`range`/`exists` and/or AST; adapters
may push supported nodes to their native query language while preserving identical client-side semantics. Adapters that
implement `listTextAnswerPage` expose stable cursor pagination over individual text answers.

See the [project documentation](https://github.com/nitta-a/form-engine-ts#readme) for the complete schema and API guide.
