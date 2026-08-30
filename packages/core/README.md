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

Store authoring-time translations on forms, fields, options, and pages. `resolveLocalizedSchema(schema, locale)` applies
them synchronously and returns the original schema when no locale is supplied,
while `populateSchemaTranslations` fills them through an injected `AsyncTranslationAdapter`. Population defaults to
`overwrite: "missing-only"`, accepts per-slot `shouldOverwrite` and `createMetadata` callbacks, and returns
`{ schema, report }` with updated and skipped translation slots. The optional `signal` is forwarded to async adapters;
`continueOnError` keeps successful slots and reports failed slots, cancellation, counts, and progress through
`TranslationReport` and `onProgress`.

Forms, pages, fields, options, and submissions accept JSON-only `metadata` and per-locale/property
`translationMetadata`. These extension values survive sanitization, localization, submission creation, and storage
round-trips. `completionMessage` is localized with the rest of the form text.

`transformFieldType` changes a question's type without discarding source text, translations, conditions, or extension
metadata. `validateFormSchema(schema, { policy })` applies the framework-independent `FormPolicy`, including field,
option, text, serialized-byte, allowed-type, locale, and per-field `fieldConstraints` rules. Rating bounds can be fixed
or range-limited, text lengths can have a policy maximum, and required state can be fixed. `allowedLocales` constrains the default and supported
locales, `maxLocales` limits their unique total, and contradictory required/allowed locale policies are reported.
Required locales cover every source text that exists on the form, its fields, options, and pages.

`collectSchemaLocales(schema)` scans registrations plus every form/page/field/option `translations` and
`translationMetadata` key. Validation reports unregistered translation locales and applies `allowedLocales` and
`maxLocales` to the complete collected set. `sanitizeSchema(schema, { policy })` also applies fixed field values and
safe maximum-length corrections while purging unregistered locale content. Pass
`{ policy: { allowedLocales, maxLocales } }` to `populateSchemaTranslations` to reject inadmissible targets before the
translation adapter runs.
`normalizeLocale(locale)` returns the canonical BCP 47 tag, accepts underscore-separated compatibility input such as
`ja_JP`, and returns `null` for invalid tags. Schema validation, sanitization, locale policy checks, and translation
slot lookup use this same normalization so equivalent locale spellings cannot bypass constraints.

Submissions use `values` as their canonical answer property. `FormSubmission<TMeta>` carries application metadata types
through creation and wire conversion. Applications that own storage contracts can use `TypedFormStorageAdapter<TMeta>`
and `TypedPagedSubmissionStorageAdapter<TMeta>` to retain that type through persistence and pagination. `toFormSubmissionWire` and
`fromFormSubmissionWire` preserve the optional submission `locale` across validated wire payloads. Use
`createFormSubmissionSchema({ metadata })` to generate a wire schema with application-owned metadata validation. Legacy
payloads with `answers` are provided by the separate `@form-engine-ts/legacy` package.
`serializeSubmissionError` and `deserializeSubmissionError` provide the JSON boundary for `FormSubmissionError`, while
`trpcSubmissionErrorAdapter` handles tRPC `data` and `shape.data` boundaries.
Use `createTrpcSubmissionErrorIntegration()` to obtain a server `errorFormatter` and matching client `deserialize`
function without manually spreading a payload into tRPC data. `runSubmissionPipeline` and
`createSubmissionPipeline` combine codec normalization, schema validation, PII confirmation, idempotent saving, and
typed `FormSubmissionError` results.

Fields can use a `displayRule` with nested `all`/`any` condition groups and `show` or `hide` actions. Supported
operators include equality, containment, emptiness, and numeric comparisons; the legacy `displayCondition` and
`not_empty` forms remain supported. `submissionSettings` can enable pre-submit confirmation and select its
`dialog`, `inline`, or `replace` presentation.

`collectTranslationSlots`, `computeSourceTextHash`, and `getTranslationStatus` expose canonical translation targets
and missing, translated, stale, or manual states for authoring tools. `populateSchemaTranslations` can populate stale
and missing entries while preserving manual translations and reports skipped reasons.

Legacy translation metadata can be recognized with `isManualTranslationMetadata` and migrated with
`migrateSchemaTranslationMetadata`; pass a custom migrator (directly or as `{ migrator }`) when legacy fields need
application-specific conversion. The migrator receives `TranslationMigrationContext` with the locale, JSON path,
property, node kind, and node identifiers.
`PopulateTranslationsOptions` is a compatibility alias for `PopulateTranslationOptions`, which also accepts custom
manual-translation detection and metadata normalization callbacks. `removeLocaleFromSchema(schema, locale)` removes
the locale from registrations and all form, page, field, option translation values and metadata; the default locale
cannot be removed.

The official catalogs include `JA_COMPARISON_MESSAGES` for comparison-workspace labels. The Core translator returns
an empty string for unresolved keys, including when a fallback resolver returns the key itself, so internal dotted keys
are not rendered as user-facing labels.

The React builder uses canonical keys with legacy aliases when resolving UI translations:

| Canonical key | Legacy alias |
| --- | --- |
| `builder.fields.typeText` | `builder.fieldType.text` |
| `builder.fields.typeTextarea` | `builder.fieldType.textarea` |
| `builder.fields.typeNumber` | `builder.fieldType.number` |
| `builder.fields.typeRating` | `builder.fieldType.rating` |
| `builder.fields.typeRadio` | `builder.fieldType.radio` |
| `builder.fields.typeCheckbox` | `builder.fieldType.checkbox` |
| `builder.fields.typeSelect` | `builder.fieldType.select` |
| `builder.fields.typeMultiSelect` | `builder.fieldType.multi-select` |

Adapters should return `undefined` or `null` for missing keys so the builder can try aliases and its default catalog. For
example, an i18next adapter can avoid treating an unresolved key as translated:

```ts
const i18nextAdapter: TranslationAdapter = {
  translate: (key, locale, params) => {
    if (!i18n.exists(key, { lng: locale })) return undefined;
    return i18n.t(key, { ...params, lng: locale });
  }
};
```

Core also exports the fully typed `FormEngineTranslationKey` union, `JA_MESSAGES`, `EN_MESSAGES`, and
`createFormEngineTranslator`. The built-in translator defaults to Japanese, falls back to English, accepts partial
custom catalogs, formats `{{placeholder}}` values, and returns an empty string for an unresolved key instead of
exposing the key itself.

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

Submission metadata can be strongly typed at the application boundary:

```ts
import { createSubmission, validateSubmission } from "@form-engine-ts/core";

const submission = createSubmission<{ deckId: string; piiConfirmed: boolean }>({
  formId: "guide",
  formVersion: 1,
  answers: { title: "Welcome" },
  metadata: { deckId: "deck_123", piiConfirmed: false }
});
submission.metadata.deckId;
const validation = validateSubmission(schema, submission, { privacyEngine });
```

`validateSubmission` returns one serializable result containing field errors, form errors, and optional PII findings.

## Versioning, incremental analytics, and paged storage

`cloneVersionToDraft`, asynchronous `publishDraft`, and `deleteDraft` implement revision-checked version transitions as
pure functions. `createCloneTransitionPlan`, `createPublishTransitionPlan`, and `createDeleteDraftTransitionPlan` produce
complete persistence plans with the next state, affected records, and immutable audit events.
Publishing when state already identifies a Published version requires its matching `currentPublishedRecord`; omission or
a version mismatch returns the typed `missing_published_record` error. The resulting archive preserves the original
schema, creation timestamp, and metadata.
Clone/delete operations accept `expectedRevision`; cloning rejects non-published sources, publish validation failures are
returned as typed `validation_failed` issues, and successful publishing archives only a supplied actual published record,
preserving its schema and metadata. `createPublishTransitionPlan` returns complete records plus expected/next revisions for
storage adapters implementing `VersionedFormStorageAdapter` to commit atomically. Versioned adapters expose state/record
reads and return a typed `Result` from `commitVersionTransition`, including the actual revision on concurrency conflicts.
`createResponseAccumulator` incrementally counts choices, answered/unanswered values, and numeric summaries without retaining
free-text bodies. In lenient mode, mismatched responses are skipped and exposed by `addMany()` and `getReport()` instead of
being included silently. Independent accumulators for the same schema can be merged, and `finalize()` matches
`aggregateResponses`.

`exportResponsesToCsvStream` accepts synchronous or asynchronous submissions and returns a byte `ReadableStream` that
also remains async-iterable for compatibility. It emits the BOM/header and one chunk per response, and supports
metadata-typed `CsvColumnDefinition<TMeta>` columns. Custom getters may be asynchronous and receive the submission, form version, and schema. Use
`pipeResponsesToCsvStream` to write to a Web `WritableStream` or Node-compatible writable while honoring backpressure.
Formula-injection neutralization applies to both default and custom columns.

Adapters implementing `PagedSubmissionStorageAdapter` expose `listSubmissionPage(formId, options)`. The opaque Base64
cursor combines `submittedAt` and response ID, so equal timestamps do not produce gaps or duplicates. `metadataFilters`
and `filter` are applied before page sizing. `filter` accepts a composable `eq`/`in`/`range`/`exists` and/or AST; adapters
may push supported nodes to their native query language while preserving identical client-side semantics. Adapters that
implement `listTextAnswerPage` expose stable cursor pagination over individual text answers.
`TextAnswerPageQueryOptions.fieldIds` can select multiple free-text fields for item-level paging.

The `paginateWithFilter` helper in `@form-engine-ts/storage` continues fetching native pages until `pageSize` matching
items are collected or the source is exhausted. `totalScannedCount` makes post-filter work observable and
`maxScanPages` bounds low-density scans.

`commitVersionTransition` accepts a typed `domainData` value and carries it through optional before/after hooks and the
persistence adapter without interpreting or modifying it.

`iterateSubmissionPages(adapter, formId, query, options)` safely traverses every page as an async generator. It supports
`pageSize`, `maxItems`, and `AbortSignal`, continues through empty pages with a next cursor, and rejects missing or cyclic
cursors instead of looping indefinitely. Publish transition validation also rejects mismatched form IDs, non-Published
records, and an unexpected current record with typed errors.

See the [project documentation](https://github.com/nitta-a/form-engine-ts#readme) for the complete schema and API guide.
