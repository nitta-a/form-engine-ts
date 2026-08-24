# @form-engine-ts/storage-mongodb

MongoDB Native Driver implementation of the complete form-engine-ts storage contract.

## Install

```bash
pnpm add @form-engine-ts/core @form-engine-ts/storage-mongodb mongodb
```

## Quick start

```ts
import { createMongoDbStorage } from "@form-engine-ts/storage-mongodb";
import { MongoClient } from "mongodb";

const client = await new MongoClient(process.env.MONGODB_URI!).connect();
const storage = createMongoDbStorage({ db: client.db("forms") });

await storage.createIndexes();
await storage.saveSchema(schema);
const submissions = await storage.listSubmissions(schema.id, schema.version, {
  since: "2026-01-01T00:00:00.000Z",
  until: "2026-01-31T23:59:59.999Z"
});
```

The caller owns the MongoDB connection lifecycle. Collection names can be customized in the factory options. `createIndexes()` creates named indexes for form/timestamp range scans and locale queries. Range boundaries are inclusive, and MongoDB sorts by submission time and then ID. `clearResponses(formId)` preserves schemas and other forms; `clear()` removes documents only from the configured collections and does not drop collections or indexes.

`listSubmissionPage(formId, { version, pageSize, cursor, since, until, locale })` performs bounded reads using the
compound `submittedAt`/response-ID cursor. Run `createIndexes()` after upgrading to create the matching compound index.
Metadata filters and the generic submission-filter AST are translated to MongoDB query operators before page sizing.
Legacy predicate filters remain supported and are applied client-side. `listTextAnswerPage` returns stable cursor pages
of individual text/textarea answers without loading every answer body at once.

Version records are stored in `form_versions`, with a unique `(formId, version)` index. Partial unique indexes allow at
most one Draft and one Published record per form, while any number of Archived records remain available. Transition state
lives in `form_version_states`. `commitVersionTransition(plan)` compares `expectedRevision` atomically and returns
`revision_conflict` to losing concurrent publishers; on a real MongoDB client, the state and record changes are committed
in one transaction. Clone, publish, and draft-delete plans persist complete version state, affected records, and audit
events. State/record/list reads and typed commit errors are exposed through the full `VersionedFormStorageAdapter` API.
