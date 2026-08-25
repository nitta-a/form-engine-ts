# @form-engine-ts/mui

Official Material UI v6/v7 integration layer for `@form-engine-ts/react`. `MuiFormBuilder` applies MUI controls and
layout slots together, disables the React builder CSS classes, and propagates common size and variant settings.

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
    getLocaleLabel: (locale) => localeNames[locale] ?? locale,
    buttonVariants: { primary: "contained", secondary: "outlined", danger: "outlined" }
  }}
  layoutOptions={{
    sectionOrder: ["basicSettings", "completionMessage", "questions", "addQuestion", "localization"]
  }}
  localizationOptions={{ collapsible: true, defaultExpanded: "when-configured" }}
  muiSlotProps={{ card: { sx: { p: 2 } }, accordion: { elevation: 0 } }}
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

`MuiAdapterOptions` defaults to `size: "medium"`, `variant: "outlined"`, `buttonVariant: "contained"`, and
`fullWidth: true`. Set `dense` to reduce section, editor, option, and toolbar spacing. `buttonVariants` can override the
MUI variant for `primary`, `secondary`, and `danger` actions independently. `layoutOptions`, `localizationOptions`, and
`muiSlotProps` are also accepted in `muiOptions` for low-level factories such as `createMuiBuilderSlots`; the dedicated
`MuiFormBuilder` props take precedence.
