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

## AI authoring suggestions

Core keeps AI provider code outside the library. An application injects an `AuthoringAssistantAdapter` that returns
operations, then previews and applies them only after policy and schema validation. Suggestions carry a deterministic
`baseSchemaHash`; applying one after the form changed returns a stale-schema error. Added field and option IDs are
created by the apply boundary, never by the provider.

```ts
import {
  applyAuthoringSuggestion,
  computeAuthoringSchemaHash,
  previewAuthoringSuggestion,
  type AuthoringSuggestion
} from "@form-engine-ts/core";

const suggestion: AuthoringSuggestion = await adapter.generate({ intent: "add_questions", prompt, schema });
const preview = previewAuthoringSuggestion(schema, suggestion, policy);
// Re-preview a subset after the user unchecks an operation.
const selectedPreview = previewAuthoringSuggestion(schema, suggestion, ["question-1"], policy);
if (preview.valid) {
  const result = applyAuthoringSuggestion(schema, suggestion, ["question-1"], { policy });
  if (result.success) save(result.schema);
}
```

`preview.operationPreviews` contains operation-level validation plus optional before/after values for form, field, and
option changes. The selected-operation overload keeps the schema hash check and cumulative policy validation intact.

The MVP supports independent `addField`, `updateField`, `updateForm`, `addOption`, and `updateOption` operations.
Removal, moving, pages, conditions, locale/translation, submission settings, and direct Azure/OpenAI SDK usage stay
in the host application.

For a server-backed provider, keep credentials in the host server and inject a small HTTP adapter. The preview app
includes `createHttpAuthoringAssistantAdapter()` as a reference; the server endpoint should return an
`AuthoringSuggestion` structured response, which Core validates before apply.

Security responsibilities remain with the host application: do not put provider API keys in the browser, keep Azure
OpenAI/OpenAI/Bedrock calls server-side, never let this package manage provider credentials, and always validate an AI
response through `previewAuthoringSuggestion`/`applyAuthoringSuggestion` before persisting it.

## Built-in templates

Core includes four purpose-oriented templates for survey, poll, and quiz creation. Select them by mode and locale,
then pass the selected template to `createSchemaFromTemplate` with an application-issued ID and title:

```ts
import { createSchemaFromTemplate, getFormTemplates } from "@form-engine-ts/core";

const [template] = getFormTemplates({ mode: "survey", locale: "ja-JP" });
if (template) {
  const schema = createSchemaFromTemplate({ template, id: "feedback-2026", title: "春の満足度" });
}
```

Templates provide Japanese text for Japanese locales and English text otherwise. The returned templates and schemas
are defensive copies, so changing one form does not change another. Core owns definitions and generation; the host
application owns the new-form entry point, ID issuance, persistence, and navigation. Built-in open-text prompts ask
respondents not to include personal information and do not promise a reply or a storage-specific anonymity guarantee.
Use `createInitialSchemaByMode` when a blank form is preferred.

## Selective imports

The root import remains supported. For smaller consumer module graphs, import a focused entry instead:

```ts
import { validateFormSchema } from "@form-engine-ts/core/schema";
import { validateSubmission } from "@form-engine-ts/core/validation";
import { EN_MESSAGES } from "@form-engine-ts/core/i18n/en";
```

Core also provides subpaths for analytics, aggregation, visibility, pipeline, submission, policy, translation,
versioning, and the other public top-level modules. Locale catalogs are available from `@form-engine-ts/core/i18n/en`
and `@form-engine-ts/core/i18n/ja` without importing them from an application feature entry.

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
payloads with `answers` must be migrated to the canonical `values` contract by the application.
`serializeSubmissionError` and `deserializeSubmissionError` provide the JSON boundary for `FormSubmissionError`, while
`trpcSubmissionErrorAdapter` handles tRPC `data` and `shape.data` boundaries.
`TrpcSubmissionErrorFormatter` is structurally compatible with tRPC's standard formatter input;
`getTrpcSubmissionErrorData` restores typed `fieldErrors`, `formErrors`, and PII payloads without an application cast.
Use `createTrpcSubmissionErrorIntegration()` to obtain a server `errorFormatter` and matching client `deserialize` and
`getData` functions without manually spreading a payload into tRPC data. `runSubmissionPipeline` and
`createSubmissionPipeline` combine codec normalization, schema validation, PII confirmation, idempotent saving, and
typed `FormSubmissionError` results.

`createSubmissionId("ulid")` and `createSubmission`'s `idFormat` option use the same generator used by React's
`createSubmissionIdentity`. Pass one identity object to a Controller and Renderer to share `idFormat`, scope,
attemptStore, receiptStore, and the generated submission/attempt ID.

Fields can use a `displayRule` with nested `all`/`any` condition groups and `show` or `hide` actions. Supported
operators include equality, containment, emptiness, and numeric comparisons; the legacy `displayCondition` and
`not_empty` forms remain supported. `submissionSettings` can enable pre-submit confirmation and select its
`dialog`, `inline`, or `replace` presentation.

Core supports `text`, `textarea`, `number`, `rating`, `date`, `time`, `email`, `tel`, `url`, `select`, `radio`,
`multi-select`, and `checkbox` fields. Date/time fields use `minDate`/`maxDate` or `minTime`/`maxTime`; typed
string fields receive format validation and native input semantics in the React renderer. Choice fields support
deterministic `shuffleOptions` ordering, with `FieldOption.pinned` preserving selected positions.

For survey radio fields, set `textInput: true` on an option to accept an optional supplement. The submitted value is
`{ optionId, text }`; the legacy option ID string remains valid when no supplement is entered. Other field types and
poll/quiz modes reject this setting.

`submissionSettings` supports `openAt`, `closeAt`, `maxResponses`, custom closed/not-yet-open messages, and
`honeypotFieldId`. `getFormAcceptanceStatus` provides a pure decision, while the submission pipeline rechecks
acceptance before saving. Storage adapters must implement
`countSubmissions(formId, formVersion?, { since, until }?)`; the pipeline uses that count directly instead of scanning
submission pages. Core also exports vendor-neutral honeypot, challenge, and rate-limit guards.

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

## Survey, poll and quiz content modes

`FormContentMode`, `CustomFormMetadata`, `PollMetadata`, `QuizMetadata` and
`QuizFieldMetadata` are optional metadata contracts. `getFormContentMode(metadata)`
returns `survey` for absent or unrecognized modes. `validateFormSchema` now also
enforces mode-specific structure: polls have at least one radio/multi-select question
with at least two options, and every quiz choice question must reference an existing
correct option. `getContentModeDiagnostics(schema)` returns stable issue codes for
localized UIs; `validateContentMode(schema)` retains its path/message result for
editor and respondent diagnostics.

```ts
import { createInitialSchemaByMode, getContentModePolicy } from "@form-engine-ts/core";

const schema = createInitialSchemaByMode("poll", {
  id: "lunch-vote", title: "Lunch", locale: "en"
});
const policy = getContentModePolicy("poll", { maxOptionsPerField: 8 });
```

Presets are deterministic: version 1, default ID `form-draft` (supply a unique ID
before persistence), no survey questions, or one required radio question with two
options for poll/quiz. An empty survey is an editing draft and still fails the base
validator until a question is added. Quiz presets include `option-1` as a valid
correct answer so they can be validated and rendered immediately. Poll allows
`radio` / `multi-select`; the default poll has no maximum question count.
quiz allows `radio`. Mode policy intersects allowed types and never raises a host
limit. React's low-level builder applies it through `policy`; `MuiFormBuilder`
applies it automatically for poll/quiz unless `contentModeOptions.applyPolicy` is false.

Use `FormPolicy.contentMode` to configure the same limits for validation, diagnostics,
Builder and respondent evaluation. For example, `getContentModePolicy("poll", {
contentMode: { maxFields: 10, minOptionsPerField: 2 } })` produces the effective policy.
Quiz formats that are not radio can provide `contentMode.evaluateQuiz`; the evaluator
result is checked at the boundary before it is used.

`mapField`, `mapOption`, `mapPage`, `mapSchema` and `createSchemaDomainCodec` preserve
unknown JSON properties, page/condition references and typed metadata while validating both
conversion boundaries. `aggregateForms` adds locale, content-mode, metadata and optional
quiz score groups without changing `aggregateResponses`.

Use `TypedFormSchema<TMetadata, TTranslationMetadata>` when an application owns metadata
types; the legacy `FormSchema` shape remains available without type arguments.

`contentMetadataToJson` copies JSON metadata and rejects undefined, non-finite,
cyclic and non-JSON data. `readPollMetadata`, `readQuizMetadata` and
`readQuizFieldMetadata` provide typed reads; unknown metadata stays in the original
schema. Store correct answers at `field.metadata.quiz.correctOptionId`.
`ResponseSummaryData` and related neutral contracts describe display-ready analytics.
`toResponseSummary(summary, schemaOrVersion, locale)` resolves localized form,
question and option labels without a React or application-domain dependency.
`evaluateQuizLocally(schema, answers)` rejects invalid quizzes and returns the
transport-neutral `QuizEvaluationResult` used by respondent renderers. It scores
visible questions, includes optional explanations and rewards supplied by a server.
`evaluateQuiz(schema, answers)` remains a legacy-shaped adapter over the local result.
Both reject invalid quizzes, score visible questions,
uses 1 point by default and 0 for unanswered questions, and returns optional `passed`
when `passingScore` is configured. Scores and thresholds are finite, non-negative
numbers; the threshold cannot exceed the sum of configured points. Hidden questions
are excluded from the earned and available score; the configured passing threshold
is absolute and is not adjusted for visibility.
When `passingScore` is omitted, callers can use the score for internal evaluation while
respondent-facing result components should omit total-score and pass/fail summaries.

`canShowPollResults(poll, { submitted, closed, canViewResults })` implements all four
policies. `private` never exposes results to respondents, and authorization gates
every policy. `PollRuntimeAdapter<TSummary>` injects result loading (with AbortSignal)
and vote eligibility. The host must enforce authorization and atomic one-vote
persistence; metadata and client-side checks alone are not server enforcement.
Quiz answers are intentionally delivered to the browser for learning/entertainment.
