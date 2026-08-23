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
