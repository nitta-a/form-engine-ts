# @form-engine-ts/storage-memory

In-process implementation of the form-engine-ts storage contract. It is useful for tests, demos, and ephemeral server workloads.

## Install

```bash
pnpm add @form-engine-ts/core @form-engine-ts/storage-memory
```

## Quick start

```ts
import { createMemoryStorageAdapter } from "@form-engine-ts/storage-memory";

const storage = createMemoryStorageAdapter();
await storage.saveSchema(schema);
await storage.saveSubmission(submission);

const responses = await storage.listSubmissions(schema.id, schema.version);
```

Data is cleared when the JavaScript process is restarted.
