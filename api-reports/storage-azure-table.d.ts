import { FormSubmission, SubmissionPageQueryOptions, PagedSubmissionStorageAdapter, SubmissionFilter } from '@form-engine-ts/core';

interface AzureTableListOptions {
    readonly queryOptions?: {
        readonly filter?: string;
    };
}
interface AzureTablePageSettings {
    readonly maxPageSize?: number;
    readonly continuationToken?: string;
}
interface AzureTableEntityPage extends ReadonlyArray<Record<string, unknown>> {
    readonly continuationToken?: string;
}
interface AzureTableEntityIterator extends AsyncIterable<Record<string, unknown>> {
    byPage(settings?: AzureTablePageSettings): AsyncIterableIterator<AzureTableEntityPage>;
}
interface AzureTableClientLike {
    createEntity(entity: Record<string, unknown>): Promise<unknown>;
    upsertEntity(entity: Record<string, unknown>, mode?: "Merge" | "Replace"): Promise<unknown>;
    getEntity(partitionKey: string, rowKey: string): Promise<Record<string, unknown>>;
    listEntities(options?: AzureTableListOptions): AzureTableEntityIterator;
    deleteEntity(partitionKey: string, rowKey: string): Promise<unknown>;
}
/** @deprecated Use AzureTableSubmissionCodec. */
interface AzureTableEntityCodec<T> {
    readonly createPartitionKey: (submission: T) => string;
    readonly createPartitionKeyFromFormId?: (formId: string) => string;
    readonly createRowKey: (submission: T) => string;
    readonly serialize: (submission: T) => Record<string, unknown>;
    readonly deserialize: (entity: Record<string, unknown>) => T;
}
interface AzureTableSubmissionCodec<T = FormSubmission> {
    readonly createEntity: (value: T) => Record<string, unknown>;
    readonly deserialize: (entity: Record<string, unknown>) => T;
    readonly matchesEntity: (entity: Record<string, unknown>) => boolean;
    readonly createPartitionKey: (value: T) => string;
    readonly createPartitionKeyFromQuery: (formId: string, query: SubmissionPageQueryOptions) => string | undefined;
    readonly createRowKey: (value: T) => string;
}
interface AzureTableStorageOptions<T = FormSubmission> {
    /** @deprecated Use schemasTableClient, submissionsTableClient, or clientResolver. */
    readonly client?: AzureTableClientLike;
    readonly schemasTableClient?: AzureTableClientLike;
    readonly submissionsTableClient?: AzureTableClientLike;
    readonly clientResolver?: (context: {
        readonly formId: string;
        readonly query?: SubmissionPageQueryOptions;
    }) => AzureTableClientLike | Promise<AzureTableClientLike>;
    readonly codec?: AzureTableSubmissionCodec<T>;
    /** @deprecated Use codec. */
    readonly submissionCodec?: AzureTableEntityCodec<FormSubmission>;
    readonly buildSubmissionFilter?: (formId: string, query: SubmissionPageQueryOptions) => string;
    /** @deprecated Use buildSubmissionFilter. */
    readonly toODataFilter?: (options: SubmissionPageQueryOptions) => string;
    readonly maxScanPages?: number;
}
interface AzureTextAnswerCursorPayload {
    readonly formatVersion: 1;
    readonly formId: string;
    readonly formVersion?: number;
    readonly fieldIdsSorted: readonly string[];
    readonly filterFingerprint: string;
    readonly tableContinuationToken?: string;
    readonly entityIndex: number;
    readonly fieldIndex: number;
}
declare const defaultAzureTableSubmissionCodec: AzureTableSubmissionCodec<FormSubmission>;
declare function metadataFiltersToOData(options: SubmissionPageQueryOptions): string;
declare function submissionFilterToOData(filter: SubmissionFilter): string | undefined;
declare function createAzureTableStorage(options?: AzureTableStorageOptions): PagedSubmissionStorageAdapter;

export { type AzureTableClientLike, type AzureTableEntityCodec, type AzureTableEntityIterator, type AzureTableEntityPage, type AzureTableListOptions, type AzureTablePageSettings, type AzureTableStorageOptions, type AzureTableSubmissionCodec, type AzureTextAnswerCursorPayload, createAzureTableStorage, defaultAzureTableSubmissionCodec, metadataFiltersToOData, submissionFilterToOData };
