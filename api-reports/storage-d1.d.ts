import { FormStorageAdapter } from '@form-engine-ts/core';

interface D1ResultLike<T = Record<string, unknown>> {
    readonly success: boolean;
    readonly results?: readonly T[];
}
interface D1PreparedStatementLike {
    bind(...values: unknown[]): D1PreparedStatementLike;
    first<T>(): Promise<T | null>;
    all<T>(): Promise<D1ResultLike<T>>;
    run<T = Record<string, unknown>>(): Promise<D1ResultLike<T>>;
}
interface D1DatabaseLike {
    prepare(query: string): D1PreparedStatementLike;
    batch(statements: readonly D1PreparedStatementLike[]): Promise<readonly D1ResultLike[]>;
}
interface D1StorageOptions {
    readonly db: D1DatabaseLike;
    readonly schemasTable?: string;
    readonly responsesTable?: string;
    readonly autoMigrate?: boolean;
}
declare function createD1Storage(options: D1StorageOptions): FormStorageAdapter;

export { type D1DatabaseLike, type D1PreparedStatementLike, type D1ResultLike, type D1StorageOptions, createD1Storage };
