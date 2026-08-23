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

await storage.saveSchema(schema);
```

The caller owns the MongoDB connection lifecycle. Collection names can be customized in the factory options.
