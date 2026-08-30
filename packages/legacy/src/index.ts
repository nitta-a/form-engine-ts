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

export interface AzureTableEntityCodec<T> {
  readonly createPartitionKey: (submission: T) => string;
  readonly createPartitionKeyFromFormId?: (formId: string) => string;
  readonly createRowKey: (submission: T) => string;
  readonly serialize: (submission: T) => Record<string, unknown>;
  readonly deserialize: (entity: Record<string, unknown>) => T;
}

export interface AzureTableLegacyEntity {
  readonly PartitionKey: string;
  readonly RowKey: string;
  readonly answers?: string;
  readonly answeredAt?: string;
  readonly surveyVersion?: number;
  readonly Timestamp?: string;
  readonly [key: string]: unknown;
}

export interface AzureTableLegacyCodec {
  readonly decode: (entity: AzureTableLegacyEntity) => import("@form-engine-ts/core").FormSubmission;
  readonly createPartitionKey: (formId: string, submissionId: string) => string;
  readonly createRowKey: (submittedAt: string, submissionId: string) => string;
}

export interface LegacyAnswerArrayEntity extends Record<string, unknown> {
  readonly PartitionKey: string;
  readonly RowKey: string;
  readonly answers: string;
  readonly answeredAt: string;
  readonly surveyVersion: number;
  readonly locale?: string;
}

export interface LegacyArrayAzureTableCodec<
  TMeta extends
    import("@form-engine-ts/core").BaseSubmissionMetadata = import("@form-engine-ts/core").BaseSubmissionMetadata
> {
  readonly encode: (submission: import("@form-engine-ts/core").StrictFormSubmission<TMeta>) => Record<string, unknown>;
  readonly decode: (entity: Record<string, unknown>) => import("@form-engine-ts/core").StrictFormSubmission<TMeta>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJson(value: unknown, location: string): unknown {
  if (typeof value !== "string") throw new Error(`Azure Table ${location} payload is invalid.`);
  try {
    return JSON.parse(value) as unknown;
  } catch (cause) {
    throw new Error(`Azure Table ${location} payload is invalid.`, { cause });
  }
}

function parseLegacyJsonObject(value: string, property: string): Record<string, unknown> {
  const parsed = parseJson(value, `legacy ${property}`);
  if (!isRecord(parsed)) throw new Error(`Azure Table legacy ${property} payload must be an object.`);
  return parsed;
}

export function createLegacyArrayAzureTableCodec<
  TMeta extends
    import("@form-engine-ts/core").BaseSubmissionMetadata = import("@form-engine-ts/core").BaseSubmissionMetadata
>(
  options: {
    readonly defaultLocale?: string;
    readonly metadataExtractor?: (entity: Record<string, unknown>) => TMeta;
  } = {}
): LegacyArrayAzureTableCodec<TMeta> {
  const defaultLocale = options.defaultLocale ?? "ja";
  if (defaultLocale.trim().length === 0) throw new TypeError("defaultLocale must not be empty.");
  return {
    encode: (submission) => ({
      PartitionKey: submission.formId,
      RowKey: submission.id,
      answers: JSON.stringify(Object.entries(submission.values).map(([questionId, value]) => ({ questionId, value }))),
      answeredAt: submission.submittedAt,
      surveyVersion: submission.formVersion,
      locale: submission.locale,
      ...submission.metadata
    }),
    decode: (entity) => {
      const raw = entity as Partial<LegacyAnswerArrayEntity>;
      if (typeof raw.PartitionKey !== "string" || typeof raw.RowKey !== "string") {
        throw new Error("Azure Table legacy array submission is missing PartitionKey or RowKey.");
      }
      const submittedAt = typeof raw.answeredAt === "string" ? raw.answeredAt : entity.Timestamp;
      if (typeof submittedAt !== "string" || submittedAt.trim().length === 0) {
        throw new Error("Azure Table legacy array submission is missing answeredAt or Timestamp.");
      }
      let values: Record<string, unknown> = {};
      if (typeof raw.answers === "string") {
        const parsed = parseJson(raw.answers, "legacy array answers");
        if (Array.isArray(parsed)) {
          values = Object.fromEntries(
            parsed.flatMap((item): [string, unknown][] => {
              if (!isRecord(item) || typeof item.questionId !== "string") return [];
              return [[item.questionId, item.value]];
            })
          );
        } else if (isRecord(parsed)) {
          values = parsed;
        } else {
          throw new Error("Azure Table legacy array answers payload must be an array or object.");
        }
      }
      const formVersion = Number(raw.surveyVersion);
      return {
        id: raw.RowKey,
        formId: raw.PartitionKey,
        formVersion: Number.isSafeInteger(formVersion) && formVersion > 0 ? formVersion : 1,
        values,
        locale: typeof raw.locale === "string" && raw.locale.trim().length > 0 ? raw.locale : defaultLocale,
        metadata: options.metadataExtractor?.(entity) ?? ({} as TMeta),
        submittedAt
      } as import("@form-engine-ts/core").StrictFormSubmission<TMeta>;
    }
  };
}

export const createLegacyAzureTableCodec = (
  options: {
    readonly partitionKeyGenerator?: (formId: string, submissionId: string) => string;
    readonly rowKeyGenerator?: (submittedAt: string, submissionId: string) => string;
  } = {}
): AzureTableLegacyCodec => {
  const createPartitionKey = options.partitionKeyGenerator ?? ((formId: string) => formId);
  const createRowKey =
    options.rowKeyGenerator ?? ((submittedAt: string, submissionId: string) => `${submittedAt}_${submissionId}`);

  return {
    decode: (entity) => {
      const values = entity.answers === undefined ? {} : parseLegacyJsonObject(entity.answers, "answers");
      const submittedAt = entity.answeredAt ?? entity.Timestamp;
      if (submittedAt === undefined || submittedAt.trim().length === 0) {
        throw new Error("Azure Table legacy submission is missing answeredAt or Timestamp.");
      }
      return {
        id: entity.RowKey,
        formId: entity.PartitionKey,
        formVersion: entity.surveyVersion ?? 1,
        values,
        metadata: {},
        submittedAt
      } as unknown as import("@form-engine-ts/core").FormSubmission;
    },
    createPartitionKey: (formId, submissionId) => createPartitionKey(formId, submissionId),
    createRowKey: (submittedAt, submissionId) => createRowKey(submittedAt, submissionId)
  };
};
