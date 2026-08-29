# @form-engine-ts/storage

Shared storage cursor contracts and filter-aware pagination helpers for Form Engine storage adapters.

## Install

```bash
pnpm add @form-engine-ts/storage
```

The package exports `StorageCursor`, cursor payload contracts, cursor encoders/decoders, and
`paginateWithFilter` for adapters that need to scan native pages until enough filtered items are collected.
`maxScanPages` bounds low-density scans, and `totalScannedCount` reports the amount of source data inspected.
