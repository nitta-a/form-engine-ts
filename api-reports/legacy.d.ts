import * as _form_engine_ts_core from '@form-engine-ts/core';

/** Migration-only contracts provided separately from the Core API. */
interface LegacyFormSubmission<TMeta extends _form_engine_ts_core.BaseSubmissionMetadata = _form_engine_ts_core.BaseSubmissionMetadata> {
    readonly id: string;
    readonly formId: string;
    readonly formVersion: number;
    readonly answers: Readonly<Record<string, unknown>>;
    readonly locale?: string;
    readonly metadata: TMeta;
    readonly submittedAt: string;
    readonly schemaRevision?: number;
}
declare function fromLegacyFormSubmission<TMeta extends _form_engine_ts_core.BaseSubmissionMetadata>(legacy: LegacyFormSubmission<TMeta>): _form_engine_ts_core.FormSubmission<TMeta>;
interface AzureTableEntityCodec<T> {
    readonly createPartitionKey: (submission: T) => string;
    readonly createPartitionKeyFromFormId?: (formId: string) => string;
    readonly createRowKey: (submission: T) => string;
    readonly serialize: (submission: T) => Record<string, unknown>;
    readonly deserialize: (entity: Record<string, unknown>) => T;
}
interface AzureTableLegacyEntity {
    readonly PartitionKey: string;
    readonly RowKey: string;
    readonly answers?: string;
    readonly answeredAt?: string;
    readonly surveyVersion?: number;
    readonly Timestamp?: string;
    readonly [key: string]: unknown;
}
interface AzureTableLegacyCodec {
    readonly decode: (entity: AzureTableLegacyEntity) => _form_engine_ts_core.FormSubmission;
    readonly createPartitionKey: (formId: string, submissionId: string) => string;
    readonly createRowKey: (submittedAt: string, submissionId: string) => string;
}
interface LegacyAnswerArrayEntity extends Record<string, unknown> {
    readonly PartitionKey: string;
    readonly RowKey: string;
    readonly answers: string;
    readonly answeredAt: string;
    readonly surveyVersion: number;
    readonly locale?: string;
}
interface LegacyArrayAzureTableCodec<TMeta extends _form_engine_ts_core.BaseSubmissionMetadata = _form_engine_ts_core.BaseSubmissionMetadata> {
    readonly encode: (submission: _form_engine_ts_core.StrictFormSubmission<TMeta>) => Record<string, unknown>;
    readonly decode: (entity: Record<string, unknown>) => _form_engine_ts_core.StrictFormSubmission<TMeta>;
}
declare function createLegacyArrayAzureTableCodec<TMeta extends _form_engine_ts_core.BaseSubmissionMetadata = _form_engine_ts_core.BaseSubmissionMetadata>(options?: {
    readonly defaultLocale?: string;
    readonly metadataExtractor?: (entity: Record<string, unknown>) => TMeta;
}): LegacyArrayAzureTableCodec<TMeta>;
declare const createLegacyAzureTableCodec: (options?: {
    readonly partitionKeyGenerator?: (formId: string, submissionId: string) => string;
    readonly rowKeyGenerator?: (submittedAt: string, submissionId: string) => string;
}) => AzureTableLegacyCodec;

export { type AzureTableEntityCodec, type AzureTableLegacyCodec, type AzureTableLegacyEntity, type LegacyAnswerArrayEntity, type LegacyArrayAzureTableCodec, type LegacyFormSubmission, createLegacyArrayAzureTableCodec, createLegacyAzureTableCodec, fromLegacyFormSubmission };
