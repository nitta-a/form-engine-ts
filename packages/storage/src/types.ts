export type {
  CursorPagingOptions,
  PaginatedResult,
  StorageCursor,
  StorageFilterCriteria,
  StorageSubmissionExportOptions,
  SubmissionCursorPayload,
  TextAnswerCursorPayload,
  UnifiedSubmissionStorageAdapter
} from "@form-engine-ts/core";

import type { StorageFilterCriteria } from "@form-engine-ts/core";

export interface StorageFilterPushdownContract {
  readonly supportedMetadataFields: readonly string[];
  readonly canPushdown: (criteria: StorageFilterCriteria) => boolean;
  readonly compileFilterQuery: (criteria: StorageFilterCriteria) => {
    readonly query: unknown;
    readonly postFilterRequired: boolean;
  };
}

export interface TenantIsolationOptions {
  readonly tenantIdProperty?: string;
  readonly enforceIsolation?: boolean;
}
