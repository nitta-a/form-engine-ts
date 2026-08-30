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
