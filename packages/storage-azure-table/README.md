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

Submission entities use `formId` as `PartitionKey` and `submittedAt_responseId` as `RowKey`. Built-in date, locale,
version, and cursor constraints are sent as OData filters. `listSubmissionPage` calls the Azure iterator's
`.byPage({ maxPageSize, continuationToken })` and consumes exactly one native page per request; the returned service token
remains opaque. Scalar metadata filters can be converted to OData with `metadataFiltersToOData` or a custom
`toODataFilter`. Supply `submissionCodec` for custom entity layouts. The deprecated single `client` option remains
available for compatibility. The caller owns table creation, credentials, retries, and the client lifecycle.
