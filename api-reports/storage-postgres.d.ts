import { ValidateFormSchemaOptions, FormLifecycleOptions, PagedSubmissionStorageAdapter } from '@form-engine-ts/core';

interface PostgresClientLike {
    readonly transaction?: <T>(operation: (client: PostgresClientLike) => Promise<T>) => Promise<T>;
    query(text: string, params?: unknown[]): Promise<{
        readonly rows: readonly unknown[];
    }>;
}
interface PostgresStorageOptions {
    readonly schemaValidation?: ValidateFormSchemaOptions;
    readonly lifecycle?: FormLifecycleOptions;
    readonly client: PostgresClientLike;
    readonly schemasTable?: string;
    readonly responsesTable?: string;
    readonly autoMigrate?: boolean;
}
declare function createPostgresStorage(options: PostgresStorageOptions): PagedSubmissionStorageAdapter;

export { type PostgresClientLike, type PostgresStorageOptions, createPostgresStorage };
