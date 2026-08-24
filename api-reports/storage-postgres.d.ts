import { PagedSubmissionStorageAdapter } from '@form-engine-ts/core';

interface PostgresClientLike {
    query(text: string, params?: unknown[]): Promise<{
        readonly rows: readonly unknown[];
    }>;
}
interface PostgresStorageOptions {
    readonly client: PostgresClientLike;
    readonly schemasTable?: string;
    readonly responsesTable?: string;
    readonly autoMigrate?: boolean;
}
declare function createPostgresStorage(options: PostgresStorageOptions): PagedSubmissionStorageAdapter;

export { type PostgresClientLike, type PostgresStorageOptions, createPostgresStorage };
