import type {
  FormSchema,
  FormSubmission,
  FormValue,
  JsonValue,
  PagedSubmissionStorageAdapter,
  SubmissionPageQueryOptions,
  SubmissionQueryOptions
} from "@form-engine-ts/core";
import { assertValidFormSchema, matchesSubmissionPageFilters, normalizeSubmissionPageSize } from "@form-engine-ts/core";

export interface AzureTableListOptions {
  readonly queryOptions?: { readonly filter?: string };
}

export interface AzureTablePageSettings {
  readonly maxPageSize?: number;
  readonly continuationToken?: string;
}

export interface AzureTableEntityPage extends ReadonlyArray<Record<string, unknown>> {
  readonly continuationToken?: string;
}

export interface AzureTableEntityIterator extends AsyncIterable<Record<string, unknown>> {
  byPage(settings?: AzureTablePageSettings): AsyncIterableIterator<AzureTableEntityPage>;
}

export interface AzureTableClientLike {
  createEntity(entity: Record<string, unknown>): Promise<unknown>;
  upsertEntity(entity: Record<string, unknown>, mode?: "Merge" | "Replace"): Promise<unknown>;
  getEntity(partitionKey: string, rowKey: string): Promise<Record<string, unknown>>;
  listEntities(options?: AzureTableListOptions): AzureTableEntityIterator;
  deleteEntity(partitionKey: string, rowKey: string): Promise<unknown>;
}

export interface AzureTableEntityCodec<T> {
  readonly createPartitionKey: (submission: T) => string;
  readonly createPartitionKeyFromFormId?: (formId: string) => string;
  readonly createRowKey: (submission: T) => string;
  readonly serialize: (submission: T) => Record<string, unknown>;
  readonly deserialize: (entity: Record<string, unknown>) => T;
}

export interface AzureTableStorageOptions {
  /** @deprecated Use schemasTableClient and submissionsTableClient. */
  readonly client?: AzureTableClientLike;
  readonly schemasTableClient?: AzureTableClientLike;
  readonly submissionsTableClient?: AzureTableClientLike;
  readonly submissionCodec?: AzureTableEntityCodec<FormSubmission>;
  readonly toODataFilter?: (options: SubmissionPageQueryOptions) => string;
}

interface StoredSchemaEntity extends Record<string, unknown> {
  readonly partitionKey: string;
  readonly rowKey: string;
  readonly kind: "schema";
  readonly formVersion: number;
  readonly payload: string;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFormValue(value: unknown): value is FormValue {
  return (
    value === undefined ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value)) ||
    (Array.isArray(value) && value.every((item) => typeof item === "string"))
  );
}

function parseJson(value: unknown, location: string): unknown {
  if (typeof value !== "string") throw new Error(`Azure Table ${location} payload is invalid.`);
  try {
    return JSON.parse(value) as unknown;
  } catch (cause) {
    throw new Error(`Azure Table ${location} payload is invalid.`, { cause });
  }
}

function parseSubmission(value: unknown, location: string): FormSubmission {
  const parsed = typeof value === "string" ? parseJson(value, location) : value;
  if (
    !isRecord(parsed) ||
    typeof parsed.id !== "string" ||
    typeof parsed.formId !== "string" ||
    !Number.isInteger(parsed.formVersion) ||
    typeof parsed.locale !== "string" ||
    typeof parsed.submittedAt !== "string" ||
    !isRecord(parsed.values) ||
    !Object.values(parsed.values).every(isFormValue)
  ) {
    throw new Error(`Azure Table ${location} submission is invalid.`);
  }
  return cloneJson(parsed) as unknown as FormSubmission;
}

function schemaRowKey(version: number): string {
  return `schema_${version}`;
}

function defaultSubmissionRowKey(submission: Pick<FormSubmission, "submittedAt" | "id">): string {
  return `${submission.submittedAt}_${submission.id}`;
}

function scalarMetadata(metadata: FormSubmission["metadata"]): Record<string, unknown> {
  if (metadata === undefined) return {};
  return Object.fromEntries(
    Object.entries(metadata).filter((entry): entry is [string, string | number | boolean | null] => {
      const value = entry[1];
      return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
    })
  );
}

export const defaultAzureTableSubmissionCodec: AzureTableEntityCodec<FormSubmission> = {
  createPartitionKey: (submission) => submission.formId,
  createPartitionKeyFromFormId: (formId) => formId,
  createRowKey: defaultSubmissionRowKey,
  serialize: (submission) => ({ ...scalarMetadata(submission.metadata), payload: JSON.stringify(submission) }),
  deserialize: (entity) => parseSubmission(entity.payload, "submission entity")
};

function parseSchemaEntity(value: Record<string, unknown>): FormSchema {
  if (
    typeof value.partitionKey !== "string" ||
    typeof value.rowKey !== "string" ||
    value.kind !== "schema" ||
    !Number.isInteger(value.formVersion) ||
    typeof value.payload !== "string"
  ) {
    throw new Error("Azure Table schema entity is invalid.");
  }
  const schema = parseJson(value.payload, `schema ${value.partitionKey}/${value.rowKey}`);
  assertValidFormSchema(schema);
  if (schema.id !== value.partitionKey || schema.version !== value.formVersion) {
    throw new Error("Azure Table schema entity has inconsistent metadata.");
  }
  return cloneJson(schema);
}

function parseSubmissionEntity(
  value: Record<string, unknown>,
  codec: AzureTableEntityCodec<FormSubmission>
): FormSubmission {
  if (typeof value.partitionKey !== "string" || typeof value.rowKey !== "string" || value.kind !== "submission") {
    throw new Error("Azure Table submission entity is invalid.");
  }
  const submission = parseSubmission(codec.deserialize(value), `submission ${value.partitionKey}/${value.rowKey}`);
  if (
    codec.createPartitionKey(submission) !== value.partitionKey ||
    codec.createRowKey(submission) !== value.rowKey ||
    value.formVersion !== submission.formVersion ||
    value.locale !== submission.locale ||
    value.submittedAt !== submission.submittedAt ||
    value.responseId !== submission.id
  ) {
    throw new Error("Azure Table submission entity has inconsistent metadata.");
  }
  return submission;
}

function escapeOData(value: string): string {
  return value.replaceAll("'", "''");
}

function metadataValueToOData(value: JsonValue): string {
  if (value === null) return "null";
  if (typeof value === "string") return `'${escapeOData(value)}'`;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return String(value);
  throw new TypeError("Azure Table metadata OData filters support only scalar JSON values.");
}

export function metadataFiltersToOData(options: SubmissionPageQueryOptions): string {
  return Object.entries(options.metadataFilters ?? {})
    .map(([key, value]) => {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) throw new TypeError(`Invalid Azure Table property name: ${key}`);
      return `${key} eq ${metadataValueToOData(value)}`;
    })
    .join(" and ");
}

function odataFilter(formId: string | undefined, options: SubmissionPageQueryOptions, extension: string): string {
  return [
    ...(formId === undefined ? [] : [`PartitionKey eq '${escapeOData(formId)}'`]),
    "kind eq 'submission'",
    ...(options.version === undefined ? [] : [`formVersion eq ${options.version}`]),
    ...(options.since === undefined ? [] : [`submittedAt ge '${escapeOData(options.since)}'`]),
    ...(options.until === undefined ? [] : [`submittedAt le '${escapeOData(options.until)}'`]),
    ...(options.locale === undefined ? [] : [`locale eq '${escapeOData(options.locale)}'`]),
    ...(extension.trim().length === 0 ? [] : [`(${extension})`])
  ].join(" and ");
}

function isNotFound(error: unknown): boolean {
  return (
    isRecord(error) &&
    (error.statusCode === 404 || error.code === "ResourceNotFound" || error.code === "EntityNotFound")
  );
}

function matchesBuiltInFilters(
  submission: FormSubmission,
  formId: string,
  options: SubmissionPageQueryOptions
): boolean {
  return (
    submission.formId === formId &&
    (options.version === undefined || submission.formVersion === options.version) &&
    (options.since === undefined || submission.submittedAt >= options.since) &&
    (options.until === undefined || submission.submittedAt <= options.until) &&
    (options.locale === undefined || submission.locale === options.locale)
  );
}

function resolveClient(
  preferred: AzureTableClientLike | undefined,
  fallback: AzureTableClientLike | undefined,
  name: string
): AzureTableClientLike {
  const client = preferred ?? fallback;
  if (client === undefined) throw new TypeError(`${name} is required.`);
  return client;
}

export function createAzureTableStorage(options: AzureTableStorageOptions): PagedSubmissionStorageAdapter {
  const schemas = resolveClient(options?.schemasTableClient, options?.client, "schemasTableClient");
  const submissions = resolveClient(options?.submissionsTableClient, options?.client, "submissionsTableClient");
  const codec = options.submissionCodec ?? defaultAzureTableSubmissionCodec;
  const toODataFilter = options.toODataFilter ?? metadataFiltersToOData;
  const partitionKeyFromFormId = codec.createPartitionKeyFromFormId ?? ((formId: string) => formId);

  const queryFilter = (formId: string | undefined, query: SubmissionPageQueryOptions): string =>
    odataFilter(formId === undefined ? undefined : partitionKeyFromFormId(formId), query, toODataFilter(query));

  const listSubmissionCandidates = async (
    formId: string,
    query: SubmissionPageQueryOptions
  ): Promise<FormSubmission[]> => {
    const found: FormSubmission[] = [];
    for await (const raw of submissions.listEntities({ queryOptions: { filter: queryFilter(formId, query) } })) {
      if (raw.kind !== "submission") continue;
      const submission = parseSubmissionEntity(raw, codec);
      if (!matchesBuiltInFilters(submission, formId, query)) continue;
      if (!matchesSubmissionPageFilters(submission, query)) continue;
      found.push(submission);
    }
    return found.sort(
      (left, right) => left.submittedAt.localeCompare(right.submittedAt) || left.id.localeCompare(right.id)
    );
  };

  return {
    async saveSchema(schema) {
      assertValidFormSchema(schema);
      const entity: StoredSchemaEntity = {
        partitionKey: schema.id,
        rowKey: schemaRowKey(schema.version),
        kind: "schema",
        formVersion: schema.version,
        payload: JSON.stringify(schema)
      };
      await schemas.upsertEntity(entity, "Replace");
    },
    async getSchema(formId, formVersion) {
      try {
        return parseSchemaEntity(await schemas.getEntity(formId, schemaRowKey(formVersion)));
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },
    async listSchemas() {
      const found: FormSchema[] = [];
      for await (const raw of schemas.listEntities({ queryOptions: { filter: "kind eq 'schema'" } })) {
        if (raw.kind === "schema") found.push(parseSchemaEntity(raw));
      }
      return found.sort((left, right) => left.id.localeCompare(right.id) || left.version - right.version);
    },
    async deleteSchema(formId, formVersion) {
      await schemas.deleteEntity(formId, schemaRowKey(formVersion));
    },
    async saveSubmission(submission) {
      const stored = parseSubmission(submission, `input ${String(submission?.id)}`);
      await submissions.createEntity({
        ...codec.serialize(stored),
        partitionKey: codec.createPartitionKey(stored),
        rowKey: codec.createRowKey(stored),
        kind: "submission",
        formVersion: stored.formVersion,
        locale: stored.locale,
        submittedAt: stored.submittedAt,
        responseId: stored.id
      });
    },
    async listSubmissions(formId, formVersion, queryOptions: SubmissionQueryOptions = {}) {
      return listSubmissionCandidates(formId, {
        ...queryOptions,
        ...(formVersion === undefined ? {} : { version: formVersion })
      });
    },
    async listSubmissionPage(formId, query = {}) {
      const pageSize = normalizeSubmissionPageSize(query.pageSize);
      const iterator = submissions
        .listEntities({ queryOptions: { filter: queryFilter(formId, query) } })
        .byPage({ maxPageSize: pageSize, ...(query.cursor === undefined ? {} : { continuationToken: query.cursor }) });
      const result = await iterator.next();
      if (result.done === true) return { items: [], hasMore: false };
      const items = result.value
        .filter((raw) => raw.kind === "submission")
        .map((raw) => parseSubmissionEntity(raw, codec))
        .filter(
          (submission) =>
            matchesBuiltInFilters(submission, formId, query) && matchesSubmissionPageFilters(submission, query)
        );
      const nextCursor = result.value.continuationToken;
      return {
        items,
        hasMore: nextCursor !== undefined && nextCursor.length > 0,
        ...(nextCursor === undefined || nextCursor.length === 0 ? {} : { nextCursor })
      };
    },
    async deleteSubmission(submissionId) {
      for await (const raw of submissions.listEntities({ queryOptions: { filter: "kind eq 'submission'" } })) {
        if (raw.kind === "submission" && raw.responseId === submissionId) {
          if (typeof raw.partitionKey !== "string" || typeof raw.rowKey !== "string") {
            throw new Error("Azure Table submission entity is invalid.");
          }
          await submissions.deleteEntity(raw.partitionKey, raw.rowKey);
          return;
        }
      }
    },
    async clearResponses(formId) {
      const partitionKey = partitionKeyFromFormId(formId);
      for await (const raw of submissions.listEntities({
        queryOptions: { filter: `PartitionKey eq '${escapeOData(partitionKey)}' and kind eq 'submission'` }
      })) {
        if (raw.partitionKey === partitionKey && raw.kind === "submission" && typeof raw.rowKey === "string") {
          await submissions.deleteEntity(partitionKey, raw.rowKey);
        }
      }
    },
    async clear() {
      for await (const raw of schemas.listEntities()) {
        if (typeof raw.partitionKey === "string" && typeof raw.rowKey === "string") {
          await schemas.deleteEntity(raw.partitionKey, raw.rowKey);
        }
      }
      if (submissions === schemas) return;
      for await (const raw of submissions.listEntities()) {
        if (typeof raw.partitionKey === "string" && typeof raw.rowKey === "string") {
          await submissions.deleteEntity(raw.partitionKey, raw.rowKey);
        }
      }
    }
  };
}
