# @form-engine-ts/storage

Shared storage cursor contracts and filter-aware pagination helpers for Form Engine storage adapters.

## Install

```bash
pnpm add @form-engine-ts/storage
```

The package exports `StorageCursor`, cursor payload contracts, cursor encoders/decoders, and
`paginateWithFilter` for adapters that need to scan native pages until enough filtered items are collected.
`maxScanPages` bounds low-density scans, and `totalScannedCount` reports the amount of source data inspected.

`TypedPagedSubmissionStorageAdapter<TMeta>` and `iterateTypedSubmissionPages` preserve application metadata types
through page fetching. MongoDB and Azure Table expose the same typed `fetchSubmissionPage` arguments and the same
`{ items, hasMore, nextCursor }` page result when called as `createMongoDbStorage<TMeta>(...)` or
`createAzureTableStorage<TMeta>(...)`. The older `fetchPage` helper remains available for compatibility.

Both adapters implement the required `UnifiedSubmissionStorageAdapter` surface: typed submission paging and filters,
free-text answer paging, idempotent saving, typed validation, response aggregation, and CSV export. These common
operations use the same core contracts regardless of the backing database.

The `./testing` subpath exports framework-independent JSON fixtures and contract runners for pagination,
idempotency, revision conflicts, translation metadata, CSV, and form deletion. Adapters expose
`inspectFormDeletion` and `deleteForm` through the lifecycle contract when their implementation supports it;
transactional deletion is required by default and `allowNonAtomic: true` is an explicit fallback.

| Package | 7.18.x contract status |
| --- | --- |
| `storage-memory` | lifecycle, pagination, idempotency |
| `storage-mongodb` | lifecycle, version state/events, transactions |
| `storage-azure-table` | lifecycle, pagination; no native transaction |
| `storage-postgres` / `storage-sqlite` / `storage-d1` | lifecycle, pagination; transaction depends on injected client |
| `storage-localstorage` | lifecycle, pagination; non-atomic only |

Existing `StorageAdapter` methods remain valid. To migrate, pass `schemaValidation` to an adapter when
Content Mode policy must be enforced at persistence, then use `inspectFormDeletion` before deletion and
handle `transaction_unsupported` explicitly for adapters without transactions.
