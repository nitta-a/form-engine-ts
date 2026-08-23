# @form-engine-ts/zod

Generates a Zod 3 answer validator from a form-engine-ts `FormSchema` while preserving Core-compatible validation issues.

## Install

```bash
pnpm add @form-engine-ts/core @form-engine-ts/zod zod@^3
```

## Quick start

```ts
import type { FormSchema } from "@form-engine-ts/core";
import { createZodFormSchema } from "@form-engine-ts/zod";

const schema: FormSchema = {
  id: "contact",
  version: 1,
  title: "Contact",
  fields: [{ id: "name", type: "text", title: "Name", required: true }]
};

const result = createZodFormSchema(schema).safeParse({ name: "Ada" });
```

Generate a validator for one wizard page while preserving passthrough values from other pages:

```ts
const firstPageResult = createZodFormSchema(schema, { pageIndex: 0 }).safeParse(values);
```
