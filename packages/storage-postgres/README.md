# @form-engine-ts/storage-postgres

PostgreSQL implementation of the complete form-engine-ts storage contract using an injected node-postgres-compatible query client.

## Install

```bash
pnpm add @form-engine-ts/core @form-engine-ts/storage-postgres pg
```

## Quick start

```ts
import { Pool } from "pg";
import { createPostgresStorage } from "@form-engine-ts/storage-postgres";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const storage = createPostgresStorage({ client: pool, autoMigrate: true });

await storage.saveSchema(schema);
await storage.saveSubmission(submission);
const submissions = await storage.listSubmissions(schema.id, schema.version, {
  since: "2026-01-01T00:00:00.000Z",
  until: "2026-01-31T23:59:59.999Z"
});
```

`client` may be a `Pool`, `Client`, or a wrapper exposing the same `query(text, values)` shape. The caller owns connections and transactions. `autoMigrate` defaults to `false`; when enabled, the adapter lazily runs idempotent `CREATE TABLE/INDEX IF NOT EXISTS` statements once before its first operation. Use a migration framework for production schema evolution.

Schemas use a `(form_id, form_version)` primary key and JSONB payload. Responses use their globally unique ID as the primary key, retain searchable form/version/locale/timestamp columns, and store the complete submission as JSONB. Custom table names must be safe SQL identifiers. Range boundaries are inclusive and results are ordered by submission time and then ID. Schema deletion never cascades to responses; `clearResponses(formId)` removes every version of one form, while `clear()` deletes rows only from the configured tables.

`listSubmissionPage(formId, { version, pageSize, cursor, since, until, locale })` uses a parameterized keyset query over
`submitted_at, response_id`. Its opaque cursor handles equal timestamps without `OFFSET` gaps or duplicates.
