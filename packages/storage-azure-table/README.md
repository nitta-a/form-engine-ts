# @form-engine-ts/storage-azure-table

Azure Table Storage implementation of the paged form-engine-ts storage contract using an injected
`@azure/data-tables`-compatible client.

## Install

```bash
pnpm add @form-engine-ts/core @form-engine-ts/storage-azure-table @azure/data-tables
```

## Quick start

```ts
import { TableClient } from "@azure/data-tables";
import { createAzureTableStorage } from "@form-engine-ts/storage-azure-table";

const schemasTableClient = TableClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING!, "forms");
const submissionsTableClient = TableClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING!,
  "responses"
);
const storage = createAzureTableStorage({ schemasTableClient, submissionsTableClient });

const page = await storage.listSubmissionPage("contact", { pageSize: 500, locale: "ja" });
```

The default codec uses `formId` as `PartitionKey` and `submittedAt_responseId` as `RowKey`. Supply an
`AzureTableSubmissionCodec` to define a completely different entity layout, key strategy, deserializer, and client-side
matcher; custom entities are not polluted with default discriminator fields. `clientResolver` can select a table client
per form and operation. Date, locale, version, cursor, metadata, and supported filter-AST constraints are sent as OData;
unsupported expressions remain client-filtered with identical semantics.

`listSubmissionPage` follows opaque Azure continuation tokens and scans at most `maxScanPages` native pages (default 5)
to fill the requested logical page after client-side filtering. `buildSubmissionFilter` can replace filter generation.
The deprecated `client`, `submissionCodec`, and `toODataFilter` options remain available for compatibility. The caller
owns table creation, credentials, retries, and client lifecycle.
