import { FormSubmission, BaseSubmissionMetadata, PagedSubmissionStorageAdapter, SubmissionPageQueryOptions, StrictFormSubmission, SaveSubmissionOptions, SubmissionSaveResult, SubmissionFilter, JsonValue, TextAnswerPageQueryOptions, TypedTextAnswerPage } from '@form-engine-ts/core';

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
interface AzureTableLegacyEntity {
    readonly PartitionKey: string;
    readonly RowKey: string;
    readonly answers?: string;
    readonly answeredAt?: string;
    readonly surveyVersion?: number;
    readonly Timestamp?: string;
    readonly [key: string]: unknown;
}
interface AzureTableLegacyCodec {
    readonly decode: (entity: AzureTableLegacyEntity) => FormSubmission;
    readonly createPartitionKey: (formId: string, submissionId: string) => string;
    readonly createRowKey: (submittedAt: string, submissionId: string) => string;
}
interface LegacyAnswerArrayEntity extends Record<string, unknown> {
    readonly PartitionKey: string;
    readonly RowKey: string;
    readonly answers: string;
    readonly answeredAt: string;
    readonly surveyVersion: number;
    readonly locale?: string;
}
interface LegacyArrayAzureTableCodec<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata> {
    readonly encode: (submission: StrictFormSubmission<TMeta>) => Record<string, unknown>;
    readonly decode: (entity: Record<string, unknown>) => StrictFormSubmission<TMeta>;
}
declare function createLegacyArrayAzureTableCodec<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata>(options?: {
    readonly defaultLocale?: string;
    readonly metadataExtractor?: (entity: Record<string, unknown>) => TMeta;
}): LegacyArrayAzureTableCodec<TMeta>;
declare const createLegacyAzureTableCodec: (options?: {
    readonly partitionKeyGenerator?: (formId: string, submissionId: string) => string;
    readonly rowKeyGenerator?: (submittedAt: string, submissionId: string) => string;
}) => AzureTableLegacyCodec;
interface AzureTableSubmissionCodec<T = FormSubmission> {
    readonly createEntity: (value: T) => Record<string, unknown>;
    readonly deserialize: (entity: Record<string, unknown>) => T;
    readonly matchesEntity: (entity: Record<string, unknown>) => boolean;
    readonly createPartitionKey: (value: T) => string;
    readonly createPartitionKeyFromQuery: (formId: string, query: SubmissionPageQueryOptions) => string | undefined;
    readonly createRowKey: (value: T) => string;
}
interface AzureTableFieldMapping {
    readonly partitionKeyProperty?: string;
    readonly rowKeyProperty?: string;
    readonly formId?: string;
    readonly formVersion?: string;
    readonly submittedAt?: string;
    readonly values?: string;
    readonly metadata?: string;
    readonly customPropertyMappings?: Readonly<Record<string, string>>;
}
interface AzureTableValueCodec {
    readonly encodeValues?: (values: Record<string, unknown>) => string;
    readonly decodeValues?: (raw: string) => Record<string, unknown>;
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
    readonly codec?: AzureTableSubmissionCodec<T> | AzureTableValueCodec;
    /** @deprecated Use codec. */
    readonly submissionCodec?: AzureTableEntityCodec<FormSubmission>;
    readonly buildSubmissionFilter?: (formId: string, query: SubmissionPageQueryOptions) => string;
    /** @deprecated Use buildSubmissionFilter. */
    readonly toODataFilter?: (options: SubmissionPageQueryOptions) => string;
    readonly maxScanPages?: number;
    readonly fieldMapping?: AzureTableFieldMapping;
    readonly readOnly?: boolean;
    /** Detect legacy entities that expose an `answers` column and fail explicitly. */
    readonly rejectLegacyAnswers?: boolean;
    /** Enable typed duplicate/conflict results for submission IDs. */
    readonly idempotentSubmissions?: boolean;
    /** Alias for idempotentSubmissions. */
    readonly idempotency?: boolean;
    /** Re-validate a submission against the stored FormSchema before saving. */
    readonly validateSubmissions?: boolean;
}
interface AzureTableStorageAdapter<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata> extends PagedSubmissionStorageAdapter {
    readonly fetchPage: (formId: string, options?: {
        readonly pageSize?: number;
        readonly fromSubmittedAt?: string;
        readonly toSubmittedAt?: string;
        readonly locale?: string;
        readonly metadataFilters?: Partial<TMeta>;
        readonly cursor?: string;
    }) => Promise<{
        readonly items: readonly FormSubmission<TMeta>[];
        readonly nextCursor?: string;
    }>;
}
type TypedAzureTableStorageAdapter<TMeta extends BaseSubmissionMetadata | undefined = undefined> = Omit<PagedSubmissionStorageAdapter, "saveSubmission" | "listSubmissionPage" | "listTextAnswerPage"> & {
    readonly saveSubmission: (submission: FormSubmission<TMeta>, options?: SaveSubmissionOptions) => Promise<undefined | SubmissionSaveResult<TMeta>>;
    readonly listSubmissionPage: (formId: string, options?: SubmissionPageQueryOptions & {
        readonly filter?: SubmissionFilter | ((submission: FormSubmission<TMeta>) => boolean);
        readonly metadataFilters?: TMeta extends BaseSubmissionMetadata ? Partial<TMeta> : Readonly<Record<string, JsonValue>>;
    }) => Promise<{
        readonly items: readonly FormSubmission<TMeta>[];
        readonly nextCursor?: string;
        readonly hasMore: boolean;
    }>;
    readonly fetchPage: (formId: string, options?: {
        readonly pageSize?: number;
        readonly fromSubmittedAt?: string;
        readonly toSubmittedAt?: string;
        readonly locale?: string;
        readonly metadataFilters?: TMeta extends BaseSubmissionMetadata ? Partial<TMeta> : Readonly<Record<string, JsonValue>>;
        readonly cursor?: string;
    }) => Promise<{
        readonly items: readonly FormSubmission<TMeta>[];
        readonly nextCursor?: string;
    }>;
    readonly listTextAnswerPage: (formId: string, fieldIdOrOptions?: string | TextAnswerPageQueryOptions, options?: TextAnswerPageQueryOptions) => Promise<TypedTextAnswerPage<TMeta>>;
};
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
declare function createAzureTableSubmissionCodec<TMeta extends BaseSubmissionMetadata | undefined = undefined>(): AzureTableSubmissionCodec<FormSubmission<TMeta>>;
declare const defaultAzureTableSubmissionCodec: AzureTableSubmissionCodec<FormSubmission>;
declare function metadataFiltersToOData(options: SubmissionPageQueryOptions, mapping?: AzureTableFieldMapping): string;
declare function submissionFilterToOData(filter: SubmissionFilter, mapping?: AzureTableFieldMapping): string | undefined;
declare function createAzureTableStorage(options?: AzureTableStorageOptions): PagedSubmissionStorageAdapter;
declare function createAzureTableStorage<TMeta extends BaseSubmissionMetadata | undefined = undefined>(options?: AzureTableStorageOptions): TypedAzureTableStorageAdapter<TMeta>;

export { type AzureTableClientLike, type AzureTableEntityCodec, type AzureTableEntityIterator, type AzureTableEntityPage, type AzureTableFieldMapping, type AzureTableLegacyCodec, type AzureTableLegacyEntity, type AzureTableListOptions, type AzureTablePageSettings, type AzureTableStorageAdapter, type AzureTableStorageOptions, type AzureTableSubmissionCodec, type AzureTableValueCodec, type AzureTextAnswerCursorPayload, type LegacyAnswerArrayEntity, type LegacyArrayAzureTableCodec, type TypedAzureTableStorageAdapter, createAzureTableStorage, createAzureTableSubmissionCodec, createLegacyArrayAzureTableCodec, createLegacyAzureTableCodec, defaultAzureTableSubmissionCodec, metadataFiltersToOData, submissionFilterToOData };
