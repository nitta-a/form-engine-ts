# @form-engine-ts/legacy

Migration-only `answers` submission contracts and legacy Azure Table codecs for applications moving to the canonical
`values` contract in `@form-engine-ts/core`. New applications should depend on Core and the standard Azure adapter
directly; they should not install this package. The standard Azure adapter does not provide compatibility reads or
migration behavior.

```ts
import { createLegacyArrayAzureTableCodec, fromLegacyFormSubmission } from "@form-engine-ts/legacy";
```

These helpers intentionally remain isolated from the standard package exports.
