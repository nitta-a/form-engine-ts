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
gaps, input height, label position, and responsive mode; `appearance.status` controls visibility, labels, colors, icons,
and badge placement. The existing `i18n.messages`/`customCatalogs` options override FormEngine's built-in Japanese or
English catalog, so application dictionaries can remove residual English UI text.

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
for focused customization. `muiSlotProps` also supports `textField`, `select`, `selectMenu`, `checkbox`, `button`, and
`iconButton` MUI props in addition to the layout props.
`fieldEditorOptions.fieldTypeOptions` can explicitly order, sort, or transform the generated type choices without
mutating the defaults.

`MuiFormBuilder` supplies options through `MuiFormBuilderContext` to module-stable adapter and slot component types.
Controlled schema updates therefore preserve input focus and uncontrolled MUI state such as an open localization
accordion even when the parent passes inline option objects.
