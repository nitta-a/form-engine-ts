# @form-engine-ts/mui

Official Material UI v6/v7 integration layer for `@form-engine-ts/react`. `MuiFormBuilder` applies MUI controls and
layout slots together, disables the React builder CSS classes, and propagates common size and variant settings.

```tsx
import { MuiFormBuilder } from "@form-engine-ts/mui";

<MuiFormBuilder
  schema={schema}
  onChange={setSchema}
  muiOptions={{ size: "small", variant: "outlined", buttonVariant: "contained", dense: true }}
/>;
```

The package keeps MUI and Emotion as peer dependencies and exposes `createMuiBuilderComponents` for targeted component
or icon overrides. Install `@mui/material`, `@mui/icons-material`, and Emotion alongside this package.

For low-level composition, `createMuiBuilderProps(options, overrides)` returns `components`, `slots`, and
`disableDefaultStyles: true` for a regular `FormBuilder`. Every primitive and slot is also exported individually, with
factories such as `createMuiTextInputAdapter`, `createMuiIconButtonAdapter`, `createMuiFieldEditorSlot`, and
`createMuiLocalizationSlot`.

`MuiAdapterOptions` defaults to `size: "medium"`, `variant: "outlined"`, `buttonVariant: "contained"`, and
`fullWidth: true`. Set `dense` to reduce section, editor, option, and toolbar spacing.
