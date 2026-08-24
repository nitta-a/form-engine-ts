import type {
  FormSchema,
  FormSubmission,
  FormValue,
  PagedSubmissionStorageAdapter,
  SubmissionPageQueryOptions,
  SubmissionQueryOptions
} from "@form-engine-ts/core";
import {
  assertValidFormSchema,
  decodeSubmissionCursor,
  encodeSubmissionCursor,
  matchesSubmissionPageFilters,
  normalizeSubmissionPageSize
} from "@form-engine-ts/core";

export interface AzureTableListOptions {
  readonly queryOptions?: { readonly filter?: string };
}

export interface AzureTableClientLike {
  createEntity(entity: Record<string, unknown>): Promise<unknown>;
  upsertEntity(entity: Record<string, unknown>, mode?: "Merge" | "Replace"): Promise<unknown>;
  getEntity(partitionKey: string, rowKey: string): Promise<Record<string, unknown>>;
  listEntities(options?: AzureTableListOptions): AsyncIterable<Record<string, unknown>>;
  deleteEntity(partitionKey: string, rowKey: string): Promise<unknown>;
}

export interface AzureTableStorageOptions {
  readonly client: AzureTableClientLike;
}

interface StoredEntity extends Record<string, unknown> {
  readonly partitionKey: string;
  readonly rowKey: string;
  readonly kind: "schema" | "submission";
  readonly formVersion: number;
  readonly locale?: string;
  readonly submittedAt?: string;
  readonly responseId?: string;
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
  const parsed = parseJson(value, location);
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

function parseEntity(value: Record<string, unknown>): StoredEntity {
  if (
    typeof value.partitionKey !== "string" ||
    typeof value.rowKey !== "string" ||
    (value.kind !== "schema" && value.kind !== "submission") ||
    !Number.isInteger(value.formVersion) ||
    typeof value.payload !== "string"
  ) {
    throw new Error("Azure Table entity is invalid.");
  }
  return value as StoredEntity;
}

function parseSchemaEntity(value: Record<string, unknown>): FormSchema {
  const entity = parseEntity(value);
  const schema = parseJson(entity.payload, `schema ${entity.partitionKey}/${entity.rowKey}`);
  assertValidFormSchema(schema);
  if (entity.kind !== "schema" || schema.id !== entity.partitionKey || schema.version !== entity.formVersion) {
    throw new Error("Azure Table schema entity has inconsistent metadata.");
  }
  return cloneJson(schema);
}

function parseSubmissionEntity(value: Record<string, unknown>): FormSubmission {
  const entity = parseEntity(value);
  const submission = parseSubmission(entity.payload, `submission ${entity.partitionKey}/${entity.rowKey}`);
  if (
    entity.kind !== "submission" ||
    entity.partitionKey !== submission.formId ||
    entity.rowKey !== submissionRowKey(submission) ||
    entity.formVersion !== submission.formVersion ||
    entity.locale !== submission.locale ||
    entity.submittedAt !== submission.submittedAt ||
    entity.responseId !== submission.id
  ) {
    throw new Error("Azure Table submission entity has inconsistent metadata.");
  }
  return submission;
}

function schemaRowKey(version: number): string {
  return `schema_${version}`;
}

function submissionRowKey(submission: Pick<FormSubmission, "submittedAt" | "id">): string {
  return `${submission.submittedAt}_${submission.id}`;
}

function escapeOData(value: string): string {
  return value.replaceAll("'", "''");
}

function odataFilter(formId: string | undefined, options: SubmissionPageQueryOptions = {}): string {
  const filters = [
    ...(formId === undefined ? [] : [`PartitionKey eq '${escapeOData(formId)}'`]),
    "kind eq 'submission'",
    ...(options.version === undefined ? [] : [`formVersion eq ${options.version}`]),
    ...(options.since === undefined ? [] : [`submittedAt ge '${escapeOData(options.since)}'`]),
    ...(options.until === undefined ? [] : [`submittedAt le '${escapeOData(options.until)}'`]),
    ...(options.locale === undefined ? [] : [`locale eq '${escapeOData(options.locale)}'`])
  ];
  if (options.cursor !== undefined) {
    const cursor = decodeSubmissionCursor(options.cursor);
    filters.push(`RowKey gt '${escapeOData(`${cursor.submittedAt}_${cursor.responseId}`)}'`);
  }
  return filters.join(" and ");
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
  const cursor = options.cursor === undefined ? undefined : decodeSubmissionCursor(options.cursor);
  return (
    submission.formId === formId &&
    (options.version === undefined || submission.formVersion === options.version) &&
    (options.since === undefined || submission.submittedAt >= options.since) &&
    (options.until === undefined || submission.submittedAt <= options.until) &&
    (options.locale === undefined || submission.locale === options.locale) &&
    (cursor === undefined ||
      submission.submittedAt > cursor.submittedAt ||
      (submission.submittedAt === cursor.submittedAt && submission.id > cursor.responseId))
  );
}

export function createAzureTableStorage(options: AzureTableStorageOptions): PagedSubmissionStorageAdapter {
  if (options?.client === undefined) throw new TypeError("client is required.");
  const { client } = options;

  const listSubmissionCandidates = async (
    formId: string,
    query: SubmissionPageQueryOptions
  ): Promise<FormSubmission[]> => {
    const submissions: FormSubmission[] = [];
    for await (const raw of client.listEntities({ queryOptions: { filter: odataFilter(formId, query) } })) {
      const entity = parseEntity(raw);
      if (entity.kind !== "submission") continue;
      const submission = parseSubmissionEntity(entity);
      if (!matchesBuiltInFilters(submission, formId, query)) continue;
      if (!matchesSubmissionPageFilters(submission, query)) continue;
      submissions.push(submission);
    }
    return submissions.sort(
      (left, right) => left.submittedAt.localeCompare(right.submittedAt) || left.id.localeCompare(right.id)
    );
  };

  return {
    async saveSchema(schema) {
      assertValidFormSchema(schema);
      await client.upsertEntity(
        {
          partitionKey: schema.id,
          rowKey: schemaRowKey(schema.version),
          kind: "schema",
          formVersion: schema.version,
          payload: JSON.stringify(schema)
        },
        "Replace"
      );
    },
    async getSchema(formId, formVersion) {
      try {
        return parseSchemaEntity(await client.getEntity(formId, schemaRowKey(formVersion)));
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },
    async listSchemas() {
      const schemas: FormSchema[] = [];
      for await (const raw of client.listEntities({ queryOptions: { filter: "kind eq 'schema'" } })) {
        const entity = parseEntity(raw);
        if (entity.kind === "schema") schemas.push(parseSchemaEntity(entity));
      }
      return schemas.sort((left, right) => left.id.localeCompare(right.id) || left.version - right.version);
    },
    async deleteSchema(formId, formVersion) {
      await client.deleteEntity(formId, schemaRowKey(formVersion));
    },
    async saveSubmission(submission) {
      const stored = parseSubmission(JSON.stringify(submission), `input ${String(submission?.id)}`);
      await client.createEntity({
        partitionKey: stored.formId,
        rowKey: submissionRowKey(stored),
        kind: "submission",
        formVersion: stored.formVersion,
        locale: stored.locale,
        submittedAt: stored.submittedAt,
        responseId: stored.id,
        payload: JSON.stringify(stored)
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
      const candidates = await listSubmissionCandidates(formId, query);
      const hasMore = candidates.length > pageSize;
      const items = candidates.slice(0, pageSize);
      const last = items.at(-1);
      return {
        items,
        hasMore,
        ...(hasMore && last !== undefined
          ? { nextCursor: encodeSubmissionCursor({ submittedAt: last.submittedAt, responseId: last.id }) }
          : {})
      };
    },
    async deleteSubmission(submissionId) {
      for await (const raw of client.listEntities({ queryOptions: { filter: "kind eq 'submission'" } })) {
        const entity = parseEntity(raw);
        if (entity.kind === "submission" && entity.responseId === submissionId) {
          await client.deleteEntity(entity.partitionKey, entity.rowKey);
          return;
        }
      }
    },
    async clearResponses(formId) {
      for await (const raw of client.listEntities({
        queryOptions: { filter: `PartitionKey eq '${escapeOData(formId)}' and kind eq 'submission'` }
      })) {
        const entity = parseEntity(raw);
        if (entity.partitionKey === formId && entity.kind === "submission") {
          await client.deleteEntity(entity.partitionKey, entity.rowKey);
        }
      }
    },
    async clear() {
      for await (const raw of client.listEntities()) {
        const entity = parseEntity(raw);
        await client.deleteEntity(entity.partitionKey, entity.rowKey);
      }
    }
  };
}
