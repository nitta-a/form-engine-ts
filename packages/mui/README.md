# @form-engine-ts/mui

Official Material UI v6/v7 adapters for `@form-engine-ts/react`.

```tsx
import { FormBuilder } from "@form-engine-ts/react";
import { muiBuilderComponents } from "@form-engine-ts/mui";

<FormBuilder schema={schema} onChange={setSchema} components={muiBuilderComponents} />;
```

The package keeps MUI and Emotion as peer dependencies and exposes `createMuiBuilderComponents` for targeted component
or icon overrides. Install `@mui/material`, `@mui/icons-material`, and Emotion alongside this package.
