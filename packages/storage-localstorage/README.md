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

const responses = await storage.listSubmissions(schema.id, schema.version);
```

Outside a browser, pass a compatible `StorageLike` object as the second argument.
