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

const client = TableClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING!, "forms");
const storage = createAzureTableStorage({ client });

const page = await storage.listSubmissionPage("contact", { pageSize: 500, locale: "ja" });
```

Submission entities use `formId` as `PartitionKey` and `submittedAt_responseId` as `RowKey`. Built-in date, locale,
version, and cursor constraints are sent as OData filters. Custom predicates and metadata filters are applied before page
sizing. The caller owns table creation, credentials, retries, and the client lifecycle.
