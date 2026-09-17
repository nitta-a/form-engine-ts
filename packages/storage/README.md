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

## Migration notes

`StorageAdapter`, `TypedStorageAdapter`, and `UnifiedSubmissionStorageAdapter` now require
`countSubmissions(formId, formVersion?, options?)`. Implementations must apply inclusive `since` and `until` filters
from `SubmissionQueryOptions`; submission pipelines no longer fall back to scanning every page.

Built-in adapters also expose `saveSubmissionWithinLimit(submission, maxResponses, options?)`. This operation checks
capacity and saves atomically for one form version, preserves idempotent duplicate/conflict results, and returns
`{ status: "limit_reached" }` without writing when full. Database adapters require their documented transaction or
conditional-write capability; they throw `transaction_unsupported` rather than performing a racy check-then-save.

The `./testing` subpath exports framework-independent JSON fixtures and contract runners for pagination,
idempotency, revision conflicts, translation metadata, CSV, and form deletion. Adapters expose
`inspectFormDeletion` and `deleteForm` through the lifecycle contract when their implementation supports it;
transactional deletion is required by default and `allowNonAtomic: true` is an explicit fallback.

| Package | v8 contract status |
| --- | --- |
| `storage-memory` | lifecycle, pagination, idempotency, process-local atomic response limits |
| `storage-mongodb` | lifecycle, version state/events, transaction-backed response limits |
| `storage-azure-table` | lifecycle, pagination, same-partition transactional response limits |
| `storage-postgres` / `storage-sqlite` | lifecycle, pagination, transaction-backed response limits |
| `storage-d1` | lifecycle, pagination, single-statement conditional response limits |
| `storage-localstorage` | lifecycle, pagination, same-JavaScript-agent response limits |

Existing `StorageAdapter` methods remain valid. To migrate, pass `schemaValidation` to an adapter when
Content Mode policy must be enforced at persistence, then use `inspectFormDeletion` before deletion and
handle `transaction_unsupported` explicitly for adapters without transactions.
