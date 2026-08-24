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

const responses = await storage.listSubmissions(schema.id, schema.version, {
  since: "2026-01-01T00:00:00.000Z",
  until: "2026-01-31T23:59:59.999Z"
});
```

Date boundaries are inclusive, and results are ordered by submission time and then ID. Data is cleared when the JavaScript process is restarted.

For bounded reads, call `listSubmissionPage(formId, { version, pageSize, cursor, since, until, locale })`. Pass the
returned `nextCursor` to the next call while `hasMore` is true. The opaque cursor remains stable when submissions share a timestamp.
Use `metadataFilters` for exact JSON metadata matching or `filter` for a custom predicate; both run before page sizing.
