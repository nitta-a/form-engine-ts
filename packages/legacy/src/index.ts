/** Migration-only contracts provided separately from the Core API. */
export interface LegacyFormSubmission<
  TMeta extends
    import("@form-engine-ts/core").BaseSubmissionMetadata = import("@form-engine-ts/core").BaseSubmissionMetadata
> {
  readonly id: string;
  readonly formId: string;
  readonly formVersion: number;
  readonly answers: Readonly<Record<string, unknown>>;
  readonly locale?: string;
  readonly metadata: TMeta;
  readonly submittedAt: string;
  readonly schemaRevision?: number;
}

export function fromLegacyFormSubmission<TMeta extends import("@form-engine-ts/core").BaseSubmissionMetadata>(
  legacy: LegacyFormSubmission<TMeta>
): import("@form-engine-ts/core").FormSubmission<TMeta> {
  const { id, formId, formVersion, answers, locale, metadata, submittedAt, schemaRevision } = legacy;
  return {
    id,
    formId,
    formVersion,
    values: { ...answers } as import("@form-engine-ts/core").FormValues,
    ...(locale === undefined ? {} : { locale }),
    metadata,
    submittedAt,
    ...(schemaRevision === undefined ? {} : { schemaRevision })
  };
}
