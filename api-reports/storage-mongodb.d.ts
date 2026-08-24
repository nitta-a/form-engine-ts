import { PagedSubmissionStorageAdapter, VersionedFormStorageAdapter, SubmissionFilter } from '@form-engine-ts/core';
import { Db, Document } from 'mongodb';

interface MongoDbStorageOptions {
    readonly db: Db;
    readonly schemasCollectionName?: string;
    readonly responsesCollectionName?: string;
    readonly versionsCollectionName?: string;
    readonly versionStatesCollectionName?: string;
}
interface MongoDbStorageAdapter extends PagedSubmissionStorageAdapter, VersionedFormStorageAdapter {
    createIndexes(): Promise<void>;
}
declare function submissionFilterToMongo(filter: SubmissionFilter): Document;
declare function createMongoDbStorage(options: MongoDbStorageOptions): MongoDbStorageAdapter;

export { type MongoDbStorageAdapter, type MongoDbStorageOptions, createMongoDbStorage, submissionFilterToMongo };
