# @form-engine-ts/storage-localstorage

Browser `localStorage` implementation of the form-engine-ts storage contract with prefix isolation and injectable storage.

## Install

```bash
pnpm add @form-engine-ts/core @form-engine-ts/storage-localstorage
```

## Quick start

```ts
import { createLocalStorageAdapter } from "@form-engine-ts/storage-localstorage";

const storage = createLocalStorageAdapter("my-app:");
await storage.saveSchema(schema);
await storage.saveSubmission(submission);

const responses = await storage.listSubmissions(schema.id, schema.version, {
  since: "2026-01-01T00:00:00.000Z",
  until: "2026-01-31T23:59:59.999Z"
});
```

Date boundaries are inclusive, and results are ordered by submission time and then ID. Outside a browser, pass a compatible `StorageLike` object as the second argument.
