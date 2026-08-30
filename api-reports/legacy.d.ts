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

export { type LegacyFormSubmission, fromLegacyFormSubmission };
