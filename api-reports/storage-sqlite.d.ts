import { FormStorageAdapter } from '@form-engine-ts/core';

interface SqliteExecutor {
    run(sql: string, params?: readonly unknown[]): Promise<void> | void;
    get<T>(sql: string, params?: readonly unknown[]): Promise<T | undefined> | T | undefined;
    all<T>(sql: string, params?: readonly unknown[]): Promise<readonly T[]> | readonly T[];
}
interface SqliteStorageOptions {
    readonly db: SqliteExecutor;
    readonly schemasTable?: string;
    readonly responsesTable?: string;
    readonly autoMigrate?: boolean;
}
declare function createSqliteStorage(options: SqliteStorageOptions): FormStorageAdapter;

export { type SqliteExecutor, type SqliteStorageOptions, createSqliteStorage };
