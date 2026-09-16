import { ValidateFormSchemaOptions, FormLifecycleOptions, PagedSubmissionStorageAdapter } from '@form-engine-ts/core';

declare function createMemoryStorageAdapter(options?: {
    /** @deprecated Use schemaValidation. */
    readonly validation?: ValidateFormSchemaOptions;
    readonly schemaValidation?: ValidateFormSchemaOptions;
    readonly lifecycle?: FormLifecycleOptions;
}): PagedSubmissionStorageAdapter;

export { createMemoryStorageAdapter };
