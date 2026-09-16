import { ValidateFormSchemaOptions, FormLifecycleOptions, FormStorageAdapter } from '@form-engine-ts/core';

interface SqliteExecutor {
    readonly transaction?: <T>(operation: (db: SqliteExecutor) => Promise<T>) => Promise<T>;
    run(sql: string, params?: readonly unknown[]): Promise<void> | void;
    get<T>(sql: string, params?: readonly unknown[]): Promise<T | undefined> | T | undefined;
    all<T>(sql: string, params?: readonly unknown[]): Promise<readonly T[]> | readonly T[];
}
interface SqliteStorageOptions {
    readonly schemaValidation?: ValidateFormSchemaOptions;
    readonly lifecycle?: FormLifecycleOptions;
    readonly db: SqliteExecutor;
    readonly schemasTable?: string;
    readonly responsesTable?: string;
    readonly autoMigrate?: boolean;
}
declare function createSqliteStorage(options: SqliteStorageOptions): FormStorageAdapter;

export { type SqliteExecutor, type SqliteStorageOptions, createSqliteStorage };
