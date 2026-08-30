import { BaseSubmissionMetadata, PagedSubmissionStorageAdapter, TextAnswerPageQueryOptions, TextAnswerPage, TypedSubmissionPageQueryOptions, TypedSubmissionPage, FormSubmission, FormSchema, SubmissionPageQueryOptions, FormAnalytics, StorageSubmissionExportOptions, FormSubmissionValidationSource, FormSubmissionValidator, SaveSubmissionOptions, SubmissionSaveResult, SubmissionFilter, JsonValue, TypedTextAnswerPage } from '@form-engine-ts/core';

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
type AzureTableSubmissionEntity = Record<string, unknown> & {
    readonly answers?: never;
};
interface AzureTableSubmissionCodec<T = FormSubmission> {
    readonly createEntity: (value: T) => AzureTableSubmissionEntity;
    readonly deserialize: (entity: AzureTableSubmissionEntity) => T;
    readonly matchesEntity: (entity: AzureTableSubmissionEntity) => boolean;
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
    readonly buildSubmissionFilter?: (formId: string, query: SubmissionPageQueryOptions) => string;
    readonly maxScanPages?: number;
    readonly fieldMapping?: AzureTableFieldMapping;
    readonly readOnly?: boolean;
    /** Enable typed duplicate/conflict results for submission IDs. */
    readonly idempotentSubmissions?: boolean;
    /** Alias for idempotentSubmissions. */
    readonly idempotency?: boolean;
    /** Re-validate a submission against the stored FormSchema before saving. */
    readonly validateSubmissions?: boolean;
    /** Validate every saved submission with an application-owned schema or callback. */
    readonly submissionSchema?: FormSubmissionValidationSource;
    readonly submissionValidator?: FormSubmissionValidator;
    /** Alias for `submissionValidator`/`submissionSchema`. */
    readonly validation?: FormSubmissionValidationSource;
    readonly validator?: FormSubmissionValidationSource;
    readonly schema?: FormSubmissionValidationSource;
}
interface AzureTableStorageAdapter<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata> extends PagedSubmissionStorageAdapter {
    readonly listTextAnswerPage: (formId: string, fieldIdOrOptions?: string | TextAnswerPageQueryOptions, options?: TextAnswerPageQueryOptions) => Promise<TextAnswerPage>;
    readonly fetchSubmissionPage?: (formId: string, options?: TypedSubmissionPageQueryOptions<TMeta>) => Promise<TypedSubmissionPage<TMeta>>;
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
    readonly aggregateResponses: (schema: FormSchema, options?: SubmissionPageQueryOptions) => Promise<FormAnalytics>;
    readonly exportResponsesToCsv: (schema: FormSchema, options?: StorageSubmissionExportOptions) => Promise<string>;
    readonly validateSubmission: (submission: FormSubmission, source?: FormSubmissionValidationSource) => Promise<void>;
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
    readonly fetchSubmissionPage?: (formId: string, options?: TypedSubmissionPageQueryOptions<TMeta>) => Promise<TypedSubmissionPage<TMeta>>;
    readonly listTextAnswerPage: (formId: string, fieldIdOrOptions?: string | TextAnswerPageQueryOptions, options?: TextAnswerPageQueryOptions) => Promise<TypedTextAnswerPage<TMeta>>;
    readonly aggregateResponses: (schema: FormSchema, options?: TypedSubmissionPageQueryOptions<TMeta>) => Promise<FormAnalytics>;
    readonly exportResponsesToCsv: (schema: FormSchema, options?: StorageSubmissionExportOptions<TMeta>) => Promise<string>;
    readonly validateSubmission: (submission: FormSubmission<TMeta>, source?: FormSubmissionValidationSource<TMeta>) => Promise<void>;
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
declare function createAzureTableStorage(options?: AzureTableStorageOptions): AzureTableStorageAdapter;
declare function createAzureTableStorage<TMeta extends BaseSubmissionMetadata | undefined = undefined>(options?: AzureTableStorageOptions): TypedAzureTableStorageAdapter<TMeta>;

export { type AzureTableClientLike, type AzureTableEntityIterator, type AzureTableEntityPage, type AzureTableFieldMapping, type AzureTableListOptions, type AzureTablePageSettings, type AzureTableStorageAdapter, type AzureTableStorageOptions, type AzureTableSubmissionCodec, type AzureTableSubmissionEntity, type AzureTableValueCodec, type AzureTextAnswerCursorPayload, type TypedAzureTableStorageAdapter, createAzureTableStorage, createAzureTableSubmissionCodec, defaultAzureTableSubmissionCodec, metadataFiltersToOData, submissionFilterToOData };
