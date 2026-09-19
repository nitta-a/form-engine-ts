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
      onSubmit={async (values, context) => console.log(values, context.attemptId)}
    >
      <FormRenderer />
    </FormProvider>
  );
}
```

Use any compatible `TranslationAdapter` in place of the mock translator.

## Interaction Telemetry

Inject a vendor-neutral adapter when the form should record view, start, page, field, validation, submit, and exit
events. Interaction Telemetry is separate from Submission Analytics and does not include answer values by default:

```tsx
import type { FormTelemetryAdapter } from "@form-engine-ts/core";

const adapter: FormTelemetryAdapter = {
  track(event) {
    console.log(event);
  }
};

<FormRenderer schema={schema} telemetry={{ adapter }} onSubmit={submit} />;
```

Telemetry adapter failures are reported through `telemetry.onError` and never block input, navigation, or submission.
Explicit schema pages emit `page.completed` after validation; the final page emits it before submission success or
failure. Field duration uses focus-to-completion, falling back to presented-to-completion when focus is unavailable.

## Selective imports

The root import remains supported. For smaller consumer module graphs, import a focused entry instead:

```tsx
import { FormBuilder } from "@form-engine-ts/react/builder";
import { FormRenderer } from "@form-engine-ts/react/renderer";
import { useFormBuilder } from "@form-engine-ts/react/hooks";
```

The `@form-engine-ts/react/content-renderer`, `/context`, `/i18n`, `/submission`, `/attempt`, and `/receipt` subpaths
are also available. Import `@form-engine-ts/react/styles.css` explicitly when using the package styles.

## Choice field layout

Radio, checkbox, and multi-select questions use the flat layout by default. Set `appearance.choiceField` to `"grouped"`
to render them as bordered, accessible `<fieldset>` groups with `<legend>` titles:

```tsx
<FormRenderer appearance={{ choiceField: "grouped" }} />
```

Use an object to configure each choice type independently. Unspecified types remain flat:

```tsx
<FormRenderer appearance={{ choiceField: { radio: "grouped", checkbox: "default" } }} />
```

Grouped wrappers can be replaced with `slots.renderChoiceGroup`; `slotProps.choiceGroup` accepts a class name and
inline style for the default wrapper. The exported `ChoiceGroupSlotProps` includes the field, translated error, and
option-list children. Group styling is controlled by the public `--fe-choice-group-*`, `--fe-choice-legend-*`, and
`--fe-choice-options-gap` CSS custom properties.

In survey-mode radio fields, mark an option with `textInput: true` to render an optional native text input after it.
Customize that input with `slots.renderRadioTextInput`; changing to another option clears the supplement.

`groupedChoiceFields={true}` remains available as a deprecated compatibility alias.

Define `schema.pages` to enable Back/Next navigation, page validation, conditional page skipping, and an accessible
progress indicator. Pass `autoSaveKey` to persist a versioned draft in `localStorage` after a 500ms debounce and restore it
on the next mount:

```tsx
<FormRenderer autoSaveKey={`contact-draft:${schema.version}`} />
```

For anonymous respondent resume, combine `autoSaveKey` with `draftResume={{}}`. The renderer asks whether to continue
or start over, stores the current page with the answers, and expires resumable drafts after seven days by default. The
respondent can disable device saving; storage failures never block submission.

The renderer supports native `date`, `time`, `email`, `tel`, and `url` inputs. Its default multi-step progress
indicator counts visible pages and questions only; `slots.renderProgress` receives answered, total, remaining, and
percentage values for custom progress UI.

Set `schema.submissionSettings.openAt`, `closeAt`, or `maxResponses` to control response acceptance. The renderer
accepts an injectable acceptance clock/count context and exposes `slots.renderClosed` for closed, not-yet-open, or
limit-reached states. `honeypotFieldId`, `challengeToken`, and `clientKey` connect application-side submission
protection to `SubmitContext`.

`FormProvider` resolves authoring-time translations synchronously whenever `locale` changes. `FormBuilder` includes page
membership controls and localization editors; pass an `AsyncTranslationAdapter` as `translationAdapter` to enable its
batch-translation action.

For large multi-page forms, set `pageEditorMode="single"` to show a page picker and edit one page's questions at a time;
the default `"all"` mode keeps the existing full page list. New questions are assigned to the selected page in single
mode, while the existing rule that every page keeps at least one question remains enforced.

`useTranslationWorkspace` exposes locale management, translation slots, completion summaries, manual editing, and
single-slot or batch translation with stale/manual status handling. The MUI package exports a ready-made
`TranslationWorkspace` surface. For large forms, set `fieldEditorMode="single"` and use `activeFieldId` or the hook's
`setActiveFieldId` to keep one field editor open at a time. Set `submissionSettingsOptions={{ enabled: true }}` to expose
schema-driven pre-submit confirmation controls in the builder.
Use `sectionVisibility` to hide individual builder sections, such as `basicSettings` and `completionMessage`, while
keeping `questions` visible. Set `autoFocusActiveField` to focus the selected question's title input whenever
`activeFieldId` changes; it does not focus an input during the initial mount.
Pass `activeFieldId={undefined}` explicitly when the common settings view is selected; omit the prop to retain the
single-mode default selection.

`useTranslationWorkspace` validates added locales against `policy.allowedLocales` and `policy.maxLocales` and returns
a structured `{ success, error }` result from `addLocale`, `translateAll`, and `translateSlot`. Errors use the exported
`TranslationWorkspaceError` discriminated union. Built-in BCP 47, duplicate, and policy checks always run
before the optional `validateLocale` callback, which receives the canonical locale and a plain context object containing
the canonical default locale, current locales, and policy.
Locale input is normalized to its canonical BCP 47 form before duplicate, policy, custom-validation, and schema updates;
underscore-separated values such as `EN_us` are accepted as compatibility input.
Use `isAddLocaleAllowed` to disable locale controls before submission. Removing a locale also clears its
localized values and metadata; the default locale remains protected.

`useTranslationWorkspace` accepts either a synchronous or asynchronous translation adapter, forwards an optional
`AbortSignal`, and exposes `cancelTranslation`, progress, and typed partial-failure/cancellation errors. It can notify
`onTranslationStart`, `onTranslationSuccess`, `onTranslationReport`, `onTranslationError`, and `onTranslationChange`
with typed lifecycle payloads. The MUI workspace accepts a `confirmRemoveLocale` slot for an async confirmation UI;
its `onConfirm` callback completes the locale removal.

`useTranslationComparison` provides a focused, controlled comparison model for form, page, field, and option text.
Its items expose source text, target text, status, canonical metadata, and path-based `updateTranslation`,
`translateSingle`, and `translateAll` actions. Comparison row slots receive `nodeKind`, locale labels, read-only state,
field type, question and option indexes, metadata, plus async single-translation actions. Use
`createTranslationMetadata` to add provider/model/hash fields while the canonical metadata fields are retained.

Wrap a builder or renderer in `FormEngineI18nProvider` to supply a UI locale and typed Core translator independently
from the schema's `defaultLocale` and `supportedLocales`:

```tsx
<FormEngineI18nProvider locale="ja">
  <MuiFormBuilder schema={schema} onChange={setSchema} />
</FormEngineI18nProvider>
```

## Headless builder and renderer lifecycle

`useFormBuilder({ schema, onChange, policy, idFactory, factories })` exposes controlled field, option, page, condition,
source-text, and localized-text actions. Core's `FormPolicy` enforces allowed field types, field/option limits, text and
schema-byte limits, and required/allowed/maximum locale constraints identically in browser and server code. Every mutation returns a typed
`BuilderActionResult`; invalid, empty, or duplicate generated IDs leave the schema unchanged. `BuilderFactories` injects
initial field, option, and page shapes. `<FormBuilder>` delegates its UI mutations to this hook and accepts the same
options. Its completion-message editors cover both source and locale text. `translationOptions` and
`onTranslationReport` expose automatic-translation policy and reporting.

`useAuthoringAssistant({ schema, adapter, policy, onChange })` coordinates provider-agnostic AI suggestions. The adapter
must implement `generate()`; the hook adds a bounded authoring context without sending the full schema and parses provider output before previewing it. It exposes
`generating`/`ready`/`applying`/`error` state, cancellation, preview data, `selectedOperationIds` with selection helpers,
selected-operation apply, reject, and stale schema protection. The adapter remains an application concern; the hook never
sends a schema mutation directly to a model.

Visual-builder field creation uses `defaultFieldType` when it is allowed, otherwise the first allowed policy type, then
`text` when unrestricted. The add button is disabled when no type is allowed or `maxFields` is reached.
`onActionError` receives typed failures from visual headless actions, and `createManualTranslationMetadata` can attach
per-locale/property metadata to manual edits. Automatic translation defaults to `overwrite: "missing-only"`; explicitly
pass `{ overwrite: "all" }` to replace existing translations.

Pass `readOnly` to keep the complete builder visible while disabling every mutation. The `features` prop independently
controls `pages`, `localization`, and `conditions` authoring surfaces; each defaults to `true`. When `allowedLocales` is
set, locale addition becomes a selector containing only unregistered allowed locales, and the action is disabled at
`maxLocales`.

`fieldEditorControls` makes the standard field editor's title, description, required flag, type selector, options,
display conditions, text limits, rating bounds, and number limits independently `editable`, `readOnly`, or `hidden`.
`fieldTypeOptions` can provide an explicit order, comparator, or transformation for generated type choices; the default
choices are copied before they are changed.

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
`moveUp`, `moveDown`, `delete`, and `add`. `renderFieldTypeIcon` supplies icons for field-type selectors. Select
options may be strings or `BuilderSelectOption` objects with `icon`, `description`, `group`, `groupLabel`, `kind`, and
`metadata`; custom
`renderOption` and `renderValue` functions can control their presentation. `BUILDER_TRANSLATION_KEYS` exposes the
canonical typed builder translation keys while legacy catalog aliases remain supported.

The `fieldEditor` slot can expose only the type selector or header through `fieldTypeSelect` and `fieldEditorHeader`:
The `fieldTypeSelect` slot receives the resolved `id`, `name`, `label`, `options`, and accessibility attributes in addition
to `currentType`, `allowedTypes`, and `onChangeType`.

```tsx
<FormBuilder
  schema={schema}
  onChange={setSchema}
  slots={{
    fieldTypeSelect: ({ currentType, onChangeType }) => (
      <button type="button" onClick={() => onChangeType("textarea")}>{currentType}</button>
    ),
    fieldEditorHeader: ({ field }) => <h3>{field.title}</h3>
  }}
/>
```

In `fieldEditorMode="single"`, `slots.fieldEditorPreview` customizes the non-selected question preview. The slot
receives the field, its zero-based absolute `index`, `totalFields`, and `onSelect`; when it is omitted, the existing
title-only preview remains unchanged.

```tsx
<FormBuilder
  schema={schema}
  onChange={setSchema}
  fieldEditorMode="single"
  slots={{
    fieldEditorPreview: ({ field, index, onSelect }) => (
      <button type="button" onClick={onSelect}>
        {index + 1}. {field.title}
      </button>
    )
  }}
/>
```

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

Set `submissionConfirmation={{ enabled: true, renderMode: "replace" }}` to show a standard answer review before
submission even when no submission guard is configured. The default `inline` mode keeps the form visible; `replace` and
`dialog` provide alternate presentations. The standard review lists visible answers with their resolved labels and
formatted display values. `renderSubmissionConfirmation` receives these as `visibleItems`; guard confirmations continue
to receive their findings, while generic confirmations provide an empty findings array.

The Builder basic-settings section edits source `title` and `description` through the same policy-aware action pipeline.
Submission confirmation slots receive the effective message, localized schema, visible answers, and formatted
`visibleItems`. An `onSubmit` result
may provide `submissionId` and `submittedAt`, which Renderer copies into its receipt. Receipt stores support `getBatch`,
and `useSubmissionReceipts` loads multiple form/version receipts for list and dashboard surfaces.

Receipt persistence is best-effort: `onReceiptError` observes storage failures while the successful completion screen is
preserved. Pass an SSR-safe `createLocalStorageSubmissionAttemptStore()` as `attemptStore` to reserve an ID immediately
before submission. `onSubmit(answers, context)` keeps `attemptId`, `formId`, `formVersion`, `locale`, and `submittedAt`
outside the answers object, retains the same attempt after a failed request, promotes it to the receipt after success,
and then clears the attempt. Custom receipt stores may omit `getBatch`; the hook falls back to concurrent `get` calls.

After success, completion rendering receives a typed `FormCompletionSlotProps` snapshot of `answers`, `schema`, the
optional response, and `submittedItems`. Each summary item includes the field title, raw value, formatted display value,
visibility, and field metadata. Use `renderSubmittedValues` for a typed summary slot; hidden fields are omitted by default
and can be included with `showHiddenFieldsInSummary`. Supply `messages` or `messageResolver` to localize standard buttons,
validation (including `validationSummary` and `validationSummaryPlural` with `{{count}}`), retry, already-submitted,
server-error, and sensitive-data confirmation UI. Server validation can be returned
by throwing `FormSubmissionError` or a payload with `fieldErrors` and `formError`; field messages are mapped back to the
form, scrolled into view, and focused. Use `submissionConfirmationRenderMode="replace"` or `"dialog"` for alternate
confirmation presentations, and `fieldsClassName` or `renderFields` to control the fields wrapper.

`FormRenderer` accepts typed `submissionMetadata`, which is passed to `onSubmit` as `context.metadata`. Receipt queries
preserve optional `deckId` and `sessionId` scopes even when a custom store does not implement `getBatch`. The exported
`createSubmissionController` and `useSubmissionController` provide a reusable lifecycle with idle, submitting, success,
and error states, duplicate-request protection, retry, and reset. Receipt stores accept optional `deckId` and
`sessionId` scopes; pass the same values as `submissionScope` to make completion state deck- or session-specific.
For lower-level viewer flows, `useSubmissionController` also accepts a schema/scope configuration and creates
UUID, ULID, or custom-ID `StrictFormSubmission` payloads with scoped duplicate protection and receipt state.
`FormRenderer` accepts `controller` directly, so controller state, retry behavior, and submission identity do not need
a local `onSubmit` adapter. `submissionController` remains as a deprecated compatibility alias.
`FormRendererFieldConfig.a11y` customizes field labels, descriptions, required indicators, error placement metadata,
and option labels.
`submissionConfirmation` can configure title, message, button labels, finding display (`full`, `masked`, `type`, or
`hidden`), visibility, and recheck behavior (`always`, `on-change`, or `once`).

## Content mode composition

Pass Core's `getContentModePolicy(mode, hostPolicy)` to `FormBuilder` or
`useFormBuilder` to constrain both controls and actions. `addFieldDisabledReason`
provides a tooltip and visible status text when adding a question is unavailable.
`slots.optionEditorAfter` and `slots.fieldEditorAfter` append controls to the default
editors. Custom field editor replacements receive these slots and must render them;
the MUI field editor supports them. Slot props expose `onChange` for metadata edits.

`usePollResults({ schema, adapter, submitted, alreadyVoted, closed, canViewResults,
submissionRevision })` returns `enabled`, `loading`, `data`, `error`, `reload` and
`applyOptimisticVote`. The hook is specialized to Core's `FormAnalytics`; a vote can
be reflected locally before the delayed aggregate response arrives, then replaced by
the server value when loading completes.
`alreadyVoted` is an optional host-provided boolean for a previously persisted vote;
for `after_submit` polls it is treated like a successful submission when deciding
whether to load results.
It does not load unauthorized/private results, aborts obsolete requests, hides data
from a previous schema/adapter, and refetches after submission revision changes.
Keep the adapter reference stable. The host remains responsible for enforcing access
in `loadResults` and vote eligibility atomically when persisting submissions.

Use the existing `FormRenderer.slots.renderCompletion` `schema` and `answers`
snapshot for final quiz evaluation. Immediate feedback can observe `useForm().values`;
changing a choice updates feedback, while final scoring uses submitted answers.
`slots.renderAfterForm` receives the current `schema`, `answers`, `submitStatus` and
optional response after the form. Adapter packages can use it for live feedback or
results without replacing field rendering or submission behavior.

### Headless respondent renderer

`ContentRenderer` combines survey, poll and quiz respondent flows without a MUI or
Tailwind dependency. Its typed `classNames` add utility classes while retaining
`fe-*` classes, and slots can replace fields, feedback, summaries and poll results.
Poll results are shown inside each choice row as a progress bar and vote count;
an already-voted respondent can receive the same inline results on the initial render;
`renderPollResultOption`, `renderPollResultsLoading`, and `renderPollResultsError`
customize those inline states. `renderPollResults` remains an explicit aggregate
override, and the exported `PollResults`/`PollResultView` components remain available
for standalone summaries.

```tsx
import { ContentRenderer } from "@form-engine-ts/react";

<ContentRenderer
  schema={schema}
  onSubmit={saveSubmission}
  classNames={{
    form: "mx-auto max-w-xl space-y-6",
    fieldInput: "rounded border px-3 py-2",
    quizQuestionCorrect: "border-green-600",
    quizQuestionIncorrect: "border-red-600"
  }}
/>
```

Quiz feedback appears inside each answer field with text, an icon and `aria-live`.
The completion area contains the submission message and the score returned by
`QuizEvaluationResult`; pass/fail is shown when a passing threshold is configured.
`SubmitResponse.quizEvaluation` can carry a server-side evaluation (including rewards)
and takes precedence over local evaluation.
`PollResults`/`PollResultView`, `QuizQuestionFeedback` and `QuizResultSummary` are
also exported. `QuizResultSummary` supports Web Share API and clipboard fallback through its `share` option, and
`PollResultsEmbed` renders read-only poll results without a form with optional interval refresh. Hosts remain
responsible for persistence, authorization and vote eligibility.

### Headless回答 renderer

`ContentRenderer` はアンケート・投票・クイズの回答フローを共通化したMUI非依存の
rendererです。`classNames`でTailwind utility classを追加でき、既存の`fe-*` classは
残ります。投票の送信直後は集計取得を待たずに選択肢行へ楽観的に票数・割合を反映し、
クイズの正誤は回答欄内に文字・アイコン・`aria-live`付きで表示します。完了領域には
`QuizEvaluationResult`の合計点を表示し、閾値がある場合は合否も表示します。保存・認可・
一人一票の原子性はホスト側で強制してください。

### Reusing page condition controls in custom builder slots

`BuilderPageConditionEditor` and `BuilderPageConditionEditorProps` expose the default page-condition controls.
Pass `schema`, `page`, the slot's `components` and `translate`, optional `readOnly`, and an `onChange` callback.
It restricts source choices to preceding pages and shares the default builder's operator/value behavior. It renders
through injected builder primitives, so adapters such as MUI can reuse it without importing vendor UI into React.
Apply its result using `actions.updatePage`; remove the `displayCondition` property when the result is `undefined`.

### Additional basic settings

`slots.basicSettingsAfter` optionally renders inside the basic settings section, after the common controls.
Its exported `BuilderBasicSettingsSlotProps` provides `schema`, optional `onChange`, UI `locale`, `readOnly`,
`actions`, resolved `components`, and `translate`. No content is added when the slot is omitted.
This framework-neutral extension lets adapters add settings without replacing the standard builder.
Custom slots must respect `readOnly` before emitting schema updates.

日本語: `slots.basicSettingsAfter`で基本設定の末尾へUIを追加できます。
`BuilderBasicSettingsSlotProps`からschema・更新コールバック・表示言語・readOnly・共通部品・翻訳を受け取ります。
