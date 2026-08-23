# @form-engine/zod

Generates a Zod 3 answer validator from a form-engine-ts `FormSchema` while preserving Core-compatible validation issues.

## Install

```bash
pnpm add @form-engine/core @form-engine/zod zod@^3
```

## Quick start

```ts
import type { FormSchema } from "@form-engine/core";
import { createZodFormSchema } from "@form-engine/zod";

const schema: FormSchema = {
  id: "contact",
  version: 1,
  title: "Contact",
  fields: [{ id: "name", type: "text", title: "Name", required: true }]
};

const result = createZodFormSchema(schema).safeParse({ name: "Ada" });
```
