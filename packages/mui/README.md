# @form-engine-ts/mui

Official Material UI v6/v7 integration layer for `@form-engine-ts/react`. `MuiFormBuilder` applies MUI controls and
layout slots together, disables the React builder CSS classes, and propagates common size and variant settings.

`MuiChoiceGroupSlot` is an exported renderer slot for grouped choice questions. It uses MUI `Paper`, `FormControl`,
`FormLabel`, and `FormHelperText`, so error state and theme colors follow the active MUI theme:

```tsx
import { FormRenderer } from "@form-engine-ts/react";
import { MuiChoiceGroupSlot } from "@form-engine-ts/mui";

<FormRenderer
  appearance={{ choiceField: { radio: "grouped" } }}
  slots={{ renderChoiceGroup: MuiChoiceGroupSlot }}
  schema={schema}
  onSubmit={save}
/>
```

`ConditionEditor` edits nested `DisplayRule` conditions in the field editor, including `all`/`any` groups and
show/hide actions. `TranslationWorkspace` provides MUI tabs, progress, status chips, manual translation editing, and
single-slot or batch translation through the React translation workspace hook. Enable the builder's submission settings
section with `submissionSettingsOptions={{ enabled: true }}` and use `layoutOptions.sectionOrder` to place it.

`TranslationComparisonWorkspace` provides a responsive source/translation view: two columns at the `md` breakpoint
and a stacked layout on smaller screens. Its source panel is read-only, while the target panel exposes status badges,
manual editing, stale-source highlighting, single-slot automatic translation, and standard batch progress, retry, and
cancellation controls. It accepts both `TranslationAdapter` and `AsyncTranslationAdapter`, and also supports
`availableLocales`, locale add/switch/remove operations, deletion confirmation, `policy`, and typed lifecycle callbacks.
`TranslationWorkspace` exposes the same locale controls for the slot-card surface. Internal paths are hidden by default;
set `showInternalPath` only for developer-facing diagnostics. Both surfaces preserve keyboard access and expose
`renderHeader`/`renderItemRow` customization slots.

Pass `localeSelectorMode="select"` to either workspace to replace registered translation-locale tabs with a MUI Select;
the registered-locale selector is hidden when only one translation locale exists. `TranslationComparisonWorkspace` also
accepts `slots.renderTargetLocaleSelector` for a custom registered-locale control. Configure `i18n.getLocaleLabel` to
show display names such as `日本語` and `English` everywhere locale names are rendered. Comparison rows include the
same default type icon on both sides; replace it with `renderItemIcon` or `getTranslationSlotIcon`. The icon callback
receives the item, `nodeKind`, `targetProperty`, and field/option position metadata.

`TranslationComparisonWorkspace` accepts `appearance` for Maker-specific customization. `appearance.input.borderColor`
supports default, hover, focus, missing, translated, and stale states; `appearance.layout` controls source/target widths,
gaps, input height, label position, and responsive mode. Use `appearance.layout.byTarget` to override those settings for
`title`, `completionMessage`, `question`, or `option` rows. `appearance.status` controls visibility, labels, colors, icons,
and badge placement. The existing `i18n.messages`/`customCatalogs` options override FormEngine's built-in Japanese or
English catalog, so application dictionaries can remove residual English UI text.
`appearance.sourceInput` and `appearance.targetInput` control border, background, radius, and height independently;
`appearance.layout.equalInputHeight` synchronizes both inputs (enabled by default), while `alignInput`, `headerHeight`,
`gridRatio`, row bounds, and `layout.byTarget` provide per-kind layout control. Locale add/remove actions use MUI's
`AddIcon` and `DeleteOutlineIcon` by default; pass `addIcon` or `removeIcon` to replace them, or provide
`renderLocaleActions` to replace the action content while receiving localized labels, icons, disabled states, and
callbacks. `TargetLocaleHeaderToolbar` uses the same icons for its add-language selector and remove action, and accepts
the same icon overrides. It separates registered-language switching/removal from the independent `AddLocaleDropdown`;
a single registered language is shown as a non-interactive chip. `i18n.customDictionary` supports locale names, status
labels, placeholders, headers, and message overrides.

`MuiSurveyResponseSummaryDomain` is the opt-in MUI renderer for response summaries from
`@form-engine-ts/custom-survey-client`. It groups questions into MUI `Card` components, renders choice distributions
with `LinearProgress`, and renders numeric/rating or checkbox statistics as cards. The component consumes the existing
domain adapter and summary aggregate shape, so no application-side question mapping is required:

```tsx
import { MuiSurveyResponseSummaryDomain } from "@form-engine-ts/mui";

<MuiSurveyResponseSummaryDomain
  summary={summary}
  version={version}
  domainAdapter={domainAdapter}
  locale="ja-JP"
  labels={{ answered: "回答済み", unanswered: "未回答", checked: "チェック済み", unchecked: "未チェック" }}
  slotProps={{ questionCard: { sx: { borderRadius: 2 } } }}
/>;
```

Use `MuiSurveyResponseSummary` when the application already has a mapped `SurveyResponseSummaryData` value. Both
components expose `slots.question` / `slots.skipReasons` for application-owned overrides and `slotProps` for MUI
styling. The existing non-MUI summary components and their default renderer are unchanged. MUI and Emotion remain
optional to consumers that do not install `@form-engine-ts/mui`.

```tsx
import { MuiFormBuilder } from "@form-engine-ts/mui";

<MuiFormBuilder
  schema={schema}
  onChange={setSchema}
  translator={translator}
  translationAdapter={translationAdapter}
  muiOptions={{
    size: "small",
    variant: "outlined",
    dense: true,
    inputFullWidth: true,
    buttonFullWidth: false,
    fieldEditorOptions: {
      description: "hidden",
      byType: { rating: { ratingBounds: "readOnly" } }
    },
    getLocaleLabel: (locale) => localeNames[locale] ?? locale,
    buttonVariants: { primary: "contained", secondary: "outlined", danger: "outlined" }
  }}
  layoutOptions={{
    sectionOrder: ["basicSettings", "completionMessage", "questions", "addQuestion", "localization"]
  }}
  localizationOptions={{
    availableLocales: [
      { value: "ja", label: "日本語" },
      { value: "en", label: "English" }
    ],
    placement: "afterQuestions",
    collapsible: true,
    defaultExpanded: "when-configured",
    showSummary: true,
    emptyStateMessage: "No translation locales have been added yet.",
    defaultLocaleControl: "readOnly"
  }}
  muiSlotProps={{
    card: { sx: { p: 2 } },
    accordion: { elevation: 0 },
    textField: { "data-testid": "builder-input" },
    select: { variant: "filled" },
    selectMenu: { PaperProps: { elevation: 4 } }
  }}
/>;
```

The package keeps MUI and Emotion as peer dependencies and exposes `createMuiBuilderComponents` for targeted component
or icon overrides. Install `@mui/material`, `@mui/icons-material`, and Emotion alongside this package.

For low-level composition, `createMuiBuilderProps(options, overrides)` returns `components`, `slots`, and
`disableDefaultStyles: true` for a regular `FormBuilder`. Every primitive and slot is also exported individually, with
factories such as `createMuiTextInputAdapter`, `createMuiIconButtonAdapter`, `createMuiFieldEditorSlot`, and
`createMuiLocalizationSlot`.

All MUI builder slots use the `FormBuilder` translator for labels, actions, tooltips, and accessible names. Use
`getLocaleLabel` for application-specific locale names. The localization UI excludes `schema.defaultLocale` from its
translation tabs and follows `allowedLocales` and `maxLocales` from the builder policy.

Manual edits from the form, field, and option translation controls use the React builder's `setManualTranslation`
action. Consequently, `createManualTranslationMetadata` receives the same source text and existing metadata for the MUI
slots as it does for the standard builder.

`MuiAdapterOptions` defaults to `size: "medium"`, `variant: "outlined"`, `buttonVariant: "contained"`,
`inputFullWidth: true`, and `buttonFullWidth: false`. The legacy `fullWidth` option remains the fallback for both new
width options. `fieldEditorOptions` controls title, description, required, type selection, options, display conditions,
text limits, rating bounds, and number limits. Each control can be `editable`, `readOnly`, or `hidden`, and `byType`
can override controls for individual question types. `localizationOptions.defaultLocaleControl` independently controls
the default locale input. Set `dense` to reduce section, editor, option, and toolbar spacing.
`buttonVariants` can override the MUI variant for `primary`, `secondary`, and `danger` actions independently.
`localizationOptions.availableLocales` supplies display-ready locale candidates independently from the policy; when
both are present, only candidates allowed by `allowedLocales` are shown. `placement` supports `top`,
`beforeQuestions`, `afterQuestions`, and `bottom` section presets. `showSummary` renders a status alert, while
`renderSummary` can provide a custom summary. `emptyStateMessage` customizes the guidance shown before a translation
locale is added. `defaultExpanded` also accepts `"always"`; `autoFocusNewTab` focuses a newly added locale tab by
default.
`layoutOptions`, `localizationOptions`, and `muiSlotProps` are also accepted in `muiOptions` for low-level factories such
as `createMuiBuilderSlots`; the dedicated `MuiFormBuilder` props take precedence.

Select options in the MUI adapter support icons, descriptions, groups (`group`/`groupLabel` or `kind`), custom metadata,
and custom `renderOption`/`renderValue` callbacks, label-only or rich option display, description text, and per-control
size, variant, and width settings. Without a custom renderer, icons appear beside labels in the menu and in the selected
value. The standard
MUI field editor supplies icons for every field type and accepts `slots.fieldTypeSelect` and `slots.fieldEditorHeader`
for focused customization. `muiSlotProps` also supports `textField`, `select`, `selectMenu`, `checkbox`, `radio`,
`button`, and `iconButton` MUI props in addition to the layout props.
`fieldEditorOptions.fieldTypeOptions` can explicitly order, sort, or transform the generated type choices without
mutating the defaults.

`MuiFormBuilder` supplies options through `MuiFormBuilderContext` to module-stable adapter and slot component types.
Controlled schema updates therefore preserve input focus and uncontrolled MUI state such as an open localization
accordion even when the parent passes inline option objects.

## Poll and quiz UI

`MuiFormBuilder` automatically reads `schema.metadata.mode` through Core's `getFormContentMode`.
Poll settings appear inside basic settings; quiz settings, correct-answer radios, explanation and points
appear automatically without manually wiring additive slots. Missing or unknown modes retain the Survey UI.

```tsx
import { createInitialSchemaByMode } from "@form-engine-ts/core";
import { MuiFormBuilder } from "@form-engine-ts/mui";
import { useState } from "react";

function Creator() {
  // Use "poll" for a poll, "quiz" for a quiz, or "survey" for a survey.
  const [schema, setSchema] = useState(() =>
    createInitialSchemaByMode("quiz", { title: "My quiz", locale: "en" })
  );
  return (
    <MuiFormBuilder
      schema={schema}
      onChange={setSchema}
      contentModeOptions={{ showSelector: true }}
      i18n={{ locale: "en" }}
    />
  );
}
```

`contentModeOptions.showSelector` defaults to `false`; automatic Poll/Quiz editing is always enabled.
Switching modes only changes `metadata.mode`, preserving questions, inactive mode settings and unknown metadata.
The selector does not convert question types or enable mode validation. Those remain host policy decisions.

Explicit `slots.basicSettingsAfter` replaces the whole additional settings area, including the selector.
`slots.fieldEditorAfter` and `slots.optionEditorAfter` override the automatic quiz editors independently.
Pass a component returning `null` to suppress a default. Custom `fieldEditor` implementations receive these
additive slots through their existing props and remain responsible for rendering them.
Low-level `createMuiBuilderProps` / `createMuiBuilderSlots` composition keeps its existing manual behavior,
so applications that already render settings elsewhere do not acquire duplicate controls.

Integrated controls respect `readOnly`, `components`, MUI options and applicable `muiSlotProps`.
Labels use `builder.content.*` translation keys, including `builder.content.points` and
`builder.content.mode`, and can be overridden with `i18n.messages`. English and Japanese are included.

日本語: `MuiFormBuilder`単体で投票・クイズの設定と問題を編集できます。
`contentModeOptions={{ showSelector: true }}`で種別切替を表示し、`i18n={{ locale: "ja" }}`で日本語になります。
種別切替では質問や各種設定を保持します。個別slotの指定が自動UIより優先されます。

`ContentModeSettings` edits result visibility, strict-one-vote preference, explanation
timing and optional passing score. It accepts `schema`, `onChange`, `locale`, `readOnly`,
and optional builder `components` / `translate` overrides. `QuizOptionEditor` and
`QuizFieldEditor` fit the additive builder slots
`optionEditorAfter` and `fieldEditorAfter`, including the standard MUI field editor.
They edit a single correct option, explanation and points without replacing the
normal question/option controls. Deleted correct options require explicit reselection.
Keep `createMuiBuilderProps` results stable across renders to preserve editor focus.

`QuizResultView` accepts Core's `QuizResult`, `locale` (English/Japanese) and optional
`showScore` (default true). Use `showScore={false}` for immediate feedback and render
the final result from the renderer completion snapshot. Existing
`MuiSurveyResponseSummary` renders poll percentages from mapped analytics; use the
React `usePollResults` hook to gate and refresh aggregation requests.

## Multi-page editing

`MuiFormBuilder` includes `MuiPagesEditor` (also exported as `MuiPagesEditorSlot`) in `muiBuilderSlots.pages`.
It supports enabling pages, adding/deleting pages, title/description editing, question assignment, keyboard-accessible
move-up/down buttons, page display conditions, and manual page translations with metadata. The controls use the
existing MUI adapters and respect `readOnly`, feature flags, localization, `muiOptions`, and `muiSlotProps.card/stack`.

```tsx
import type { FormSchema } from "@form-engine-ts/core";
import { MuiFormBuilder } from "@form-engine-ts/mui";
import { useState } from "react";

const initialSchema: FormSchema = {
  id: "feedback",
  version: 1,
  title: "Feedback",
  fields: [
    { id: "name", type: "text", title: "Name", required: true },
    { id: "age", type: "number", title: "Age", required: false },
    { id: "comment", type: "textarea", title: "Comment", required: false }
  ],
  pages: [
    { id: "basic", title: "Basic information", questionIds: ["name", "age"] },
    { id: "feedback-page", title: "Feedback", questionIds: ["comment"] }
  ]
};

export function MultiPageSurveyEditor() {
  const [schema, setSchema] = useState(initialSchema);
  return (
    <MuiFormBuilder
      schema={schema}
      onChange={setSchema}
      features={{ pages: true, conditions: true, localization: true }}
      muiOptions={{ size: "small", dense: true }}
    />
  );
}
```

The existing preview application's **MUI Mode** uses this slot automatically when pages are enabled. Use the page
manager to choose a question for a new page, or a question's page selector to move it to another existing page.

The editor delegates mutations to React's `BuilderSlotActions`; it does not maintain a second schema model.
Existing headless rules still apply: pages cannot be created empty; splitting requires a source page with at least two
questions. Deleting a page moves its questions to a neighbor, and deleting the last page returns to single-page mode.
Moving a page removes its condition when the referenced question is no longer on a preceding page. Assigning the
last question away removes the now-empty page. As in the headless API, deletion/assignment do not repair every
pre-existing condition reference; the application should validate the resulting schema before saving.
Page conditions use `FormPage.displayCondition` (one preceding question with the existing operators), not the field
editor's nested `DisplayRule` AND/OR groups. Drag-and-drop ordering is not included; use the move buttons.

`createMuiPagesEditorSlot(options)` creates an independently configured slot, and `MuiPagesEditorProps` extends
React's `BuilderPagesSlotProps`. `createMuiBuilderSlots(options, { pages: CustomPages })` and
`<MuiFormBuilder slots={{ pages: CustomPages }} />` keep custom overrides. For a low-level React builder, use
`createMuiBuilderProps(options)` to apply the MUI components and slots together.
