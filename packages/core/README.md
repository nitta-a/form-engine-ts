# @form-engine/core

Framework-independent schemas, validation, submissions, analytics, CSV export, and adapter contracts for form-engine-ts.

## Install

```bash
pnpm add @form-engine/core
```

## Quick start

```ts
import { type FormSchema, validateAnswers } from "@form-engine/core";

const schema: FormSchema = {
  id: "contact",
  version: 1,
  title: "Contact",
  fields: [{ id: "name", type: "text", title: "Name", required: true }]
};

const result = validateAnswers(schema, { name: "Ada" });
if (!result.valid) console.error(result.issues);
```

See the [project documentation](https://github.com/nitta-a/form-engine-ts#readme) for the complete schema and API guide.
