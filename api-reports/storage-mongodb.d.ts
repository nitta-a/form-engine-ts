import { PagedSubmissionStorageAdapter, VersionedFormStorageAdapter, BaseSubmissionMetadata, FormSubmission, SubmissionFilter } from '@form-engine-ts/core';
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
}
interface MongoDbStorageAdapter extends PagedSubmissionStorageAdapter, VersionedFormStorageAdapter {
    createIndexes(): Promise<void>;
}
interface TypedMongoDbStorageAdapter<TMeta extends BaseSubmissionMetadata> extends MongoDbStorageAdapter {
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
declare function submissionFilterToMongo(filter: SubmissionFilter): Document;
declare function createMongoDbStorage(options: MongoDbStorageOptions): MongoDbStorageAdapter;

export { type MongoCustomIndexDefinition, type MongoDbStorageAdapter, type MongoDbStorageOptions, type TypedMongoDbStorageAdapter, createMongoDbStorage, submissionFilterToMongo };
