import { FormStorageAdapter } from '@form-engine-ts/core';

interface StorageLike {
    readonly length: number;
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
    key(index: number): string | null;
}
declare function createLocalStorageAdapter(storagePrefix?: string, injectedStorage?: StorageLike): FormStorageAdapter;

export { type StorageLike, createLocalStorageAdapter };
