import * as _form_engine_ts_core from '@form-engine-ts/core';
import { PagedSubmissionStorageAdapter, VersionedFormStorageAdapter, FormSchema, SubmissionPageQueryOptions, FormAnalytics, StorageSubmissionExportOptions, FormSubmission, FormSubmissionValidationSource, FormSubmissionValidator, BaseSubmissionMetadata, TypedSubmissionPageQueryOptions, TypedSubmissionPage, SaveSubmissionOptions, SubmissionSaveResult, TextAnswerPageQueryOptions, TypedTextAnswerPage, JsonValue, SubmissionFilter } from '@form-engine-ts/core';
import { IndexSpecification, CreateIndexesOptions, Db, Document } from 'mongodb';

interface MongoCustomIndexDefinition {
    readonly spec: IndexSpecification;
    readonly options?: CreateIndexesOptions;
}
interface MongoDbStorageOptions {
    readonly db: Db;
    readonly schemasCollectionName?: string;
    readonly responsesCollectionName?: string;
    readonly versionsCollectionName?: string;
    readonly versionStatesCollectionName?: string;
    readonly collectionNames?: {
        readonly forms?: string;
        readonly formVersions?: string;
        readonly formVersionStates?: string;
        readonly formResponses?: string;
    };
    readonly customIndexes?: {
        readonly forms?: readonly MongoCustomIndexDefinition[];
        readonly formVersions?: readonly MongoCustomIndexDefinition[];
        readonly formResponses?: readonly MongoCustomIndexDefinition[];
    };
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
interface MongoDbStorageAdapter extends PagedSubmissionStorageAdapter, VersionedFormStorageAdapter {
    createIndexes(): Promise<void>;
    aggregateResponses(schema: FormSchema, options?: SubmissionPageQueryOptions): Promise<FormAnalytics>;
    exportResponsesToCsv(schema: FormSchema, options?: StorageSubmissionExportOptions): Promise<string>;
    validateSubmission(submission: FormSubmission, source?: FormSubmissionValidationSource): Promise<void>;
}
interface TypedMongoDbStorageAdapter<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata> extends MongoDbStorageAdapter {
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
}
type TypedMongoDbSubmissionStorageAdapter<TMeta extends BaseSubmissionMetadata | undefined = undefined> = Omit<MongoDbStorageAdapter, "saveSubmission" | "listSubmissionPage" | "listTextAnswerPage" | "aggregateResponses" | "exportResponsesToCsv" | "validateSubmission"> & {
    readonly saveSubmission: (submission: FormSubmission<TMeta>, options?: SaveSubmissionOptions) => Promise<undefined | SubmissionSaveResult<TMeta>>;
    readonly listSubmissionPage: (formId: string, options?: _form_engine_ts_core.TypedSubmissionPageQueryOptions<TMeta>) => Promise<_form_engine_ts_core.TypedSubmissionPage<TMeta>>;
    readonly listTextAnswerPage: (formId: string, fieldIdOrOptions?: string | TextAnswerPageQueryOptions, options?: TextAnswerPageQueryOptions) => Promise<TypedTextAnswerPage<TMeta>>;
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
    readonly aggregateResponses: (schema: FormSchema, options?: TypedSubmissionPageQueryOptions<TMeta>) => Promise<FormAnalytics>;
    readonly exportResponsesToCsv: (schema: FormSchema, options?: StorageSubmissionExportOptions<TMeta>) => Promise<string>;
    readonly validateSubmission: (submission: FormSubmission<TMeta>, source?: FormSubmissionValidationSource<TMeta>) => Promise<void>;
};
declare function submissionFilterToMongo(filter: SubmissionFilter): Document;
declare function createMongoDbStorage(options: MongoDbStorageOptions): MongoDbStorageAdapter;
declare function createMongoDbStorage<TMeta extends BaseSubmissionMetadata | undefined = undefined>(options: MongoDbStorageOptions): TypedMongoDbSubmissionStorageAdapter<TMeta>;

export { type MongoCustomIndexDefinition, type MongoDbStorageAdapter, type MongoDbStorageOptions, type TypedMongoDbStorageAdapter, type TypedMongoDbSubmissionStorageAdapter, createMongoDbStorage, submissionFilterToMongo };
