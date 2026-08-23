# @form-engine-ts/storage-d1

Cloudflare D1 implementation of the complete form-engine-ts storage contract using structural Worker API types.

## Install

```bash
pnpm add @form-engine-ts/core @form-engine-ts/storage-d1
```

## Quick start

```ts
import { createD1Storage } from "@form-engine-ts/storage-d1";

export default {
  async fetch(request, env) {
    const storage = createD1Storage({ db: env.DB, autoMigrate: true });
    const submissions = await storage.listSubmissions("contact", 1, {
      since: "2026-01-01T00:00:00.000Z",
      until: "2026-01-31T23:59:59.999Z"
    });
    return Response.json(submissions);
  }
};
```

The adapter depends only on structural `prepare/bind/first/all/run/batch` types, so application code owns the D1 binding and Worker lifecycle. Every value is bound through prepared statements. `autoMigrate` defaults to `false`; when enabled, migration statements run once in a transactional D1 batch before the first operation. `clear()` also batches deletion from the two configured tables and reports unsuccessful or malformed D1 results.

Schemas use a `(form_id, form_version)` primary key. Full schema/submission JSON is stored as text with searchable response metadata. Range boundaries are inclusive and results are ordered by submission time and then ID. Schema deletion does not cascade; `clearResponses(formId)` preserves schemas and other forms, while `clear()` retains both tables.
