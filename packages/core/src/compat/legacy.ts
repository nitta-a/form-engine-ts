import type { BaseSubmissionMetadata, FormSubmission, FormValues } from "../types";

/** Submission shape used by pre-v4 clients and migration-only code. */
export interface LegacyFormSubmission<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata> {
  readonly id: string;
  readonly formId: string;
  readonly formVersion: number;
  readonly answers: Readonly<Record<string, unknown>>;
  readonly locale?: string;
  readonly metadata: TMeta;
  readonly submittedAt: string;
  readonly schemaRevision?: number;
}

export const fromLegacyFormSubmission = <TMeta extends BaseSubmissionMetadata>(
  legacy: LegacyFormSubmission<TMeta>
): FormSubmission<TMeta> => {
  const { id, formId, formVersion, answers, locale, metadata, submittedAt, schemaRevision } = legacy;
  return {
    id,
    formId,
    formVersion,
    values: { ...answers } as FormValues,
    ...(locale === undefined ? {} : { locale }),
    metadata,
    submittedAt,
    ...(schemaRevision === undefined ? {} : { schemaRevision })
  };
};
