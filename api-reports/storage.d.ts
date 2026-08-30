import { StorageFilterCriteria, BaseSubmissionMetadata, TypedSubmissionPageQueryOptions, TypedSubmissionPage, FormSubmission, StorageCursor, PaginatedResult } from '@form-engine-ts/core';
export { CursorPagingOptions, PaginatedResult, StorageCursor, StorageFilterCriteria, StorageSubmissionExportOptions, SubmissionCursorPayload, TextAnswerCursorPayload, TypedSubmissionPage, TypedSubmissionPageQueryOptions, UnifiedSubmissionStorageAdapter, decodeStorageSubmissionCursor, decodeStorageTextAnswerCursor, encodeStorageSubmissionCursor, encodeStorageTextAnswerCursor } from '@form-engine-ts/core';

interface StorageFilterPushdownContract {
    readonly supportedMetadataFields: readonly string[];
    readonly canPushdown: (criteria: StorageFilterCriteria) => boolean;
    readonly compileFilterQuery: (criteria: StorageFilterCriteria) => {
        readonly query: unknown;
        readonly postFilterRequired: boolean;
    };
}
interface TenantIsolationOptions {
    readonly tenantIdProperty?: string;
    readonly enforceIsolation?: boolean;
}

interface TypedPagedSubmissionStorageAdapter<TMeta extends BaseSubmissionMetadata> {
    readonly fetchPage: (formId: string, options?: TypedSubmissionPageQueryOptions<TMeta>) => Promise<TypedSubmissionPage<TMeta>>;
}
declare function iterateTypedSubmissionPages<TMeta extends BaseSubmissionMetadata>(adapter: TypedPagedSubmissionStorageAdapter<TMeta>, formId: string, options?: TypedSubmissionPageQueryOptions<TMeta>): AsyncIterable<readonly FormSubmission<TMeta>[]>;
declare function paginateWithFilter<T>(params: {
    readonly pageSize: number;
    readonly cursor?: StorageCursor;
    readonly maxScanPages?: number;
    readonly fetchPage: (rawCursor: StorageCursor | undefined, limit: number) => Promise<{
        readonly rawItems: readonly T[];
        readonly rawNextCursor?: StorageCursor;
    }>;
    readonly filterPredicate: (item: T) => boolean;
    readonly encodeCursor: (lastItem: T) => StorageCursor;
}): Promise<PaginatedResult<T>>;

export { type StorageFilterPushdownContract, type TenantIsolationOptions, type TypedPagedSubmissionStorageAdapter, iterateTypedSubmissionPages, paginateWithFilter };
