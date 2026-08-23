# @form-engine-ts/storage-sqlite

SQLite implementation of the complete form-engine-ts storage contract using a small injected executor that supports synchronous or asynchronous drivers.

## Install

```bash
pnpm add @form-engine-ts/core @form-engine-ts/storage-sqlite
```

## Quick start

```ts
import Database from "better-sqlite3";
import { createSqliteStorage, type SqliteExecutor } from "@form-engine-ts/storage-sqlite";

const db = new Database("forms.sqlite");
const executor: SqliteExecutor = {
  run: (sql, params = []) => {
    db.prepare(sql).run(...params);
  },
  get: (sql, params = []) => db.prepare(sql).get(...params),
  all: (sql, params = []) => db.prepare(sql).all(...params)
};
const storage = createSqliteStorage({ db: executor, autoMigrate: true });
```

`better-sqlite3` is only an example and is not a runtime dependency. Wrap `bun:sqlite`, libSQL, or another driver in the same `run/get/all` interface; return values may be synchronous or promises. The caller owns the database lifecycle and transaction policy.

`autoMigrate` defaults to `false`; when enabled, idempotent table/index DDL runs lazily once. Schemas use a `(form_id, form_version)` primary key. Complete schemas and submissions are stored as JSON text alongside searchable response metadata. `listSubmissions` accepts inclusive `since`/`until` ISO 8601 boundaries and orders by timestamp then ID. Schema deletion does not cascade; form-scoped and full clears retain the configured tables.
