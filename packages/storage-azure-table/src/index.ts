import type {
  FormSchema,
  FormSubmission,
  FormValue,
  JsonValue,
  PagedSubmissionStorageAdapter,
  SubmissionFilter,
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

/** @deprecated Use AzureTableSubmissionCodec. */
export interface AzureTableEntityCodec<T> {
  readonly createPartitionKey: (submission: T) => string;
  readonly createPartitionKeyFromFormId?: (formId: string) => string;
  readonly createRowKey: (submission: T) => string;
  readonly serialize: (submission: T) => Record<string, unknown>;
  readonly deserialize: (entity: Record<string, unknown>) => T;
}

export interface AzureTableSubmissionCodec<T = FormSubmission> {
  readonly createEntity: (value: T) => Record<string, unknown>;
  readonly deserialize: (entity: Record<string, unknown>) => T;
  readonly matchesEntity: (entity: Record<string, unknown>) => boolean;
  readonly createPartitionKey: (value: T) => string;
  readonly createPartitionKeyFromQuery: (formId: string, query: SubmissionPageQueryOptions) => string | undefined;
  readonly createRowKey: (value: T) => string;
}

export interface AzureTableStorageOptions<T = FormSubmission> {
  /** @deprecated Use schemasTableClient, submissionsTableClient, or clientResolver. */
  readonly client?: AzureTableClientLike;
  readonly schemasTableClient?: AzureTableClientLike;
  readonly submissionsTableClient?: AzureTableClientLike;
  readonly clientResolver?: (context: {
    readonly formId: string;
    readonly query?: SubmissionPageQueryOptions;
  }) => AzureTableClientLike | Promise<AzureTableClientLike>;
  readonly codec?: AzureTableSubmissionCodec<T>;
  /** @deprecated Use codec. */
  readonly submissionCodec?: AzureTableEntityCodec<FormSubmission>;
  readonly buildSubmissionFilter?: (formId: string, query: SubmissionPageQueryOptions) => string;
  /** @deprecated Use buildSubmissionFilter. */
  readonly toODataFilter?: (options: SubmissionPageQueryOptions) => string;
  readonly maxScanPages?: number;
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

export const defaultAzureTableSubmissionCodec: AzureTableSubmissionCodec<FormSubmission> = {
  createEntity: (submission) => ({
    ...scalarMetadata(submission.metadata),
    kind: "submission",
    formVersion: submission.formVersion,
    locale: submission.locale,
    submittedAt: submission.submittedAt,
    responseId: submission.id,
    payload: JSON.stringify(submission)
  }),
  deserialize: (entity) => parseSubmission(entity.payload, "submission entity"),
  matchesEntity: (entity) => entity.kind === "submission",
  createPartitionKey: (submission) => submission.formId,
  createPartitionKeyFromQuery: (formId) => formId,
  createRowKey: defaultSubmissionRowKey
};

function legacyCodec(codec: AzureTableEntityCodec<FormSubmission>): AzureTableSubmissionCodec<FormSubmission> {
  return {
    createEntity: (value) => ({
      ...codec.serialize(value),
      kind: "submission",
      formVersion: value.formVersion,
      locale: value.locale,
      submittedAt: value.submittedAt,
      responseId: value.id
    }),
    deserialize: codec.deserialize,
    matchesEntity: (entity) => entity.kind === "submission",
    createPartitionKey: codec.createPartitionKey,
    createPartitionKeyFromQuery: (formId) => codec.createPartitionKeyFromFormId?.(formId) ?? formId,
    createRowKey: codec.createRowKey
  };
}

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
  codec: AzureTableSubmissionCodec<FormSubmission>
): FormSubmission {
  if (typeof value.partitionKey !== "string" || typeof value.rowKey !== "string" || !codec.matchesEntity(value)) {
    throw new Error("Azure Table submission entity is invalid.");
  }
  const submission = parseSubmission(codec.deserialize(value), `submission ${value.partitionKey}/${value.rowKey}`);
  if (codec.createPartitionKey(submission) !== value.partitionKey || codec.createRowKey(submission) !== value.rowKey) {
    throw new Error("Azure Table submission entity has inconsistent keys.");
  }
  return submission;
}

function escapeOData(value: string): string {
  return value.replaceAll("'", "''");
}

function valueToOData(value: JsonValue): string {
  if (value === null) return "null";
  if (typeof value === "string") return `'${escapeOData(value)}'`;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return String(value);
  throw new TypeError("Azure Table OData filters support only scalar JSON values.");
}

export function metadataFiltersToOData(options: SubmissionPageQueryOptions): string {
  return Object.entries(options.metadataFilters ?? {})
    .map(([key, value]) => {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) throw new TypeError(`Invalid Azure Table property name: ${key}`);
      return `${key} eq ${valueToOData(value)}`;
    })
    .join(" and ");
}

function odataProperty(path: string): string | undefined {
  if (path === "id" || path === "responseId") return "responseId";
  if (["formVersion", "locale", "submittedAt"].includes(path)) return path;
  if (path.startsWith("metadata.")) {
    const property = path.slice("metadata.".length);
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(property) ? property : undefined;
  }
  return undefined;
}

export function submissionFilterToOData(filter: SubmissionFilter): string | undefined {
  if (filter.op === "and" || filter.op === "or") {
    const converted = filter.filters.map(submissionFilterToOData);
    if (filter.op === "or" && converted.some((value) => value === undefined)) return undefined;
    const available = converted.filter((value): value is string => value !== undefined && value.length > 0);
    if (available.length === 0) return undefined;
    return available.map((value) => `(${value})`).join(filter.op === "and" ? " and " : " or ");
  }
  const property = odataProperty(filter.path);
  if (property === undefined) return undefined;
  if (filter.op === "eq") return `${property} eq ${valueToOData(filter.value)}`;
  if (filter.op === "in") {
    if (filter.values.length === 0) return "false";
    return filter.values.map((value) => `${property} eq ${valueToOData(value)}`).join(" or ");
  }
  if (filter.op === "exists") return `${property} ${filter.value ? "ne" : "eq"} null`;
  return [
    ...(filter.from === undefined ? [] : [`${property} ge ${valueToOData(filter.from)}`]),
    ...(filter.to === undefined ? [] : [`${property} le ${valueToOData(filter.to)}`])
  ].join(" and ");
}

function defaultSubmissionFilter(
  codec: AzureTableSubmissionCodec<FormSubmission>,
  formId: string,
  options: SubmissionPageQueryOptions,
  legacyExtension: string
): string {
  const partitionKey = codec.createPartitionKeyFromQuery(formId, options);
  const ast =
    options.filter === undefined || typeof options.filter === "function"
      ? undefined
      : submissionFilterToOData(options.filter);
  return [
    ...(partitionKey === undefined ? [] : [`PartitionKey eq '${escapeOData(partitionKey)}'`]),
    ...(codec === defaultAzureTableSubmissionCodec ? ["kind eq 'submission'"] : []),
    ...(options.version === undefined ? [] : [`formVersion eq ${options.version}`]),
    ...(options.since === undefined ? [] : [`submittedAt ge '${escapeOData(options.since)}'`]),
    ...(options.until === undefined ? [] : [`submittedAt le '${escapeOData(options.until)}'`]),
    ...(options.locale === undefined ? [] : [`locale eq '${escapeOData(options.locale)}'`]),
    ...(ast === undefined || ast.length === 0 ? [] : [`(${ast})`]),
    ...(legacyExtension.trim().length === 0 ? [] : [`(${legacyExtension})`])
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

function requireClient(client: AzureTableClientLike | undefined, name: string): AzureTableClientLike {
  if (client === undefined) throw new TypeError(`${name} is required.`);
  return client;
}

export function createAzureTableStorage(options: AzureTableStorageOptions = {}): PagedSubmissionStorageAdapter {
  const staticSchemas = options.schemasTableClient ?? options.client;
  const staticSubmissions = options.submissionsTableClient ?? options.client;
  const codec =
    options.codec ??
    (options.submissionCodec === undefined ? defaultAzureTableSubmissionCodec : legacyCodec(options.submissionCodec));
  const maxScanPages = options.maxScanPages ?? 5;
  if (!Number.isSafeInteger(maxScanPages) || maxScanPages < 1) {
    throw new TypeError("maxScanPages must be a positive safe integer.");
  }

  const resolveDynamicClient = async (
    formId: string,
    query?: SubmissionPageQueryOptions
  ): Promise<AzureTableClientLike | undefined> =>
    options.clientResolver?.({ formId, ...(query === undefined ? {} : { query }) });
  const schemaClient = async (formId: string): Promise<AzureTableClientLike> =>
    requireClient(staticSchemas ?? (await resolveDynamicClient(formId)), "schemasTableClient or clientResolver");
  const submissionClient = async (formId: string, query?: SubmissionPageQueryOptions): Promise<AzureTableClientLike> =>
    requireClient(
      (await resolveDynamicClient(formId, query)) ?? staticSubmissions,
      "submissionsTableClient or clientResolver"
    );
  const queryFilter = (formId: string, query: SubmissionPageQueryOptions): string => {
    if (options.buildSubmissionFilter !== undefined) return options.buildSubmissionFilter(formId, query);
    return defaultSubmissionFilter(
      codec,
      formId,
      query,
      options.toODataFilter?.(query) ?? metadataFiltersToOData(query)
    );
  };
  const deserializeIfMatching = (entity: Record<string, unknown>): FormSubmission | undefined =>
    codec.matchesEntity(entity) ? parseSubmissionEntity(entity, codec) : undefined;

  const listSubmissionCandidates = async (
    formId: string,
    query: SubmissionPageQueryOptions
  ): Promise<FormSubmission[]> => {
    const client = await submissionClient(formId, query);
    const found: FormSubmission[] = [];
    for await (const raw of client.listEntities({ queryOptions: { filter: queryFilter(formId, query) } })) {
      const submission = deserializeIfMatching(raw);
      if (submission === undefined || !matchesBuiltInFilters(submission, formId, query)) continue;
      if (matchesSubmissionPageFilters(submission, query)) found.push(submission);
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
      await (await schemaClient(schema.id)).upsertEntity(entity, "Replace");
    },
    async getSchema(formId, formVersion) {
      try {
        return parseSchemaEntity(await (await schemaClient(formId)).getEntity(formId, schemaRowKey(formVersion)));
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },
    async listSchemas() {
      const found: FormSchema[] = [];
      for await (const raw of (await schemaClient("")).listEntities({ queryOptions: { filter: "kind eq 'schema'" } })) {
        if (raw.kind === "schema") found.push(parseSchemaEntity(raw));
      }
      return found.sort((left, right) => left.id.localeCompare(right.id) || left.version - right.version);
    },
    async deleteSchema(formId, formVersion) {
      await (await schemaClient(formId)).deleteEntity(formId, schemaRowKey(formVersion));
    },
    async saveSubmission(submission) {
      const stored = parseSubmission(submission, `input ${String(submission?.id)}`);
      await (await submissionClient(stored.formId)).createEntity({
        ...codec.createEntity(stored),
        partitionKey: codec.createPartitionKey(stored),
        rowKey: codec.createRowKey(stored)
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
      const client = await submissionClient(formId, query);
      const items: FormSubmission[] = [];
      let continuationToken = query.cursor;
      let scannedPages = 0;
      do {
        const iterator = client.listEntities({ queryOptions: { filter: queryFilter(formId, query) } }).byPage({
          maxPageSize: Math.max(1, pageSize - items.length),
          ...(continuationToken === undefined ? {} : { continuationToken })
        });
        const result = await iterator.next();
        if (result.done === true) {
          continuationToken = undefined;
          break;
        }
        scannedPages += 1;
        for (const raw of result.value) {
          const submission = deserializeIfMatching(raw);
          if (submission === undefined || !matchesBuiltInFilters(submission, formId, query)) continue;
          if (matchesSubmissionPageFilters(submission, query)) items.push(submission);
        }
        continuationToken = result.value.continuationToken;
      } while (items.length < pageSize && continuationToken !== undefined && scannedPages < maxScanPages);
      return {
        items,
        hasMore: continuationToken !== undefined && continuationToken.length > 0,
        ...(continuationToken === undefined || continuationToken.length === 0 ? {} : { nextCursor: continuationToken })
      };
    },
    async deleteSubmission(submissionId) {
      const client = await submissionClient("");
      for await (const raw of client.listEntities()) {
        const submission = deserializeIfMatching(raw);
        if (submission?.id !== submissionId) continue;
        if (typeof raw.partitionKey !== "string" || typeof raw.rowKey !== "string") {
          throw new Error("Azure Table submission entity is invalid.");
        }
        await client.deleteEntity(raw.partitionKey, raw.rowKey);
        return;
      }
    },
    async clearResponses(formId) {
      const query: SubmissionPageQueryOptions = {};
      const client = await submissionClient(formId, query);
      for await (const raw of client.listEntities({ queryOptions: { filter: queryFilter(formId, query) } })) {
        const submission = deserializeIfMatching(raw);
        if (submission?.formId !== formId) continue;
        if (typeof raw.partitionKey === "string" && typeof raw.rowKey === "string") {
          await client.deleteEntity(raw.partitionKey, raw.rowKey);
        }
      }
    },
    async clear() {
      const schemas = await schemaClient("");
      for await (const raw of schemas.listEntities()) {
        if (typeof raw.partitionKey === "string" && typeof raw.rowKey === "string") {
          await schemas.deleteEntity(raw.partitionKey, raw.rowKey);
        }
      }
      const submissions = await submissionClient("");
      if (submissions === schemas) return;
      for await (const raw of submissions.listEntities()) {
        if (typeof raw.partitionKey === "string" && typeof raw.rowKey === "string") {
          await submissions.deleteEntity(raw.partitionKey, raw.rowKey);
        }
      }
    }
  };
}
