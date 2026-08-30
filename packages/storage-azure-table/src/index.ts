import type {
  BaseSubmissionMetadata,
  FormAnalytics,
  FormSchema,
  FormSubmission,
  FormSubmissionValidationSource,
  FormSubmissionValidator,
  FormValue,
  JsonValue,
  PagedSubmissionStorageAdapter,
  SaveSubmissionOptions,
  StorageSubmissionExportOptions,
  SubmissionFilter,
  SubmissionPageQueryOptions,
  SubmissionQueryOptions,
  SubmissionSaveResult,
  TextAnswerItem,
  TextAnswerPage,
  TextAnswerPageQueryOptions,
  TypedSubmissionPage,
  TypedSubmissionPageQueryOptions,
  TypedTextAnswerPage
} from "@form-engine-ts/core";
import {
  aggregateResponses,
  assertValidFormSchema,
  assertValidFormSubmission,
  assertValidFormSubmissionWith,
  exportResponsesToCsv,
  hashFormSubmissionPayload,
  matchesSubmissionPageFilters,
  normalizeSubmissionPageSize
} from "@form-engine-ts/core";

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

export type AzureTableSubmissionEntity = Record<string, unknown> & { readonly answers?: never };

export interface AzureTableSubmissionCodec<T = FormSubmission> {
  readonly createEntity: (value: T) => AzureTableSubmissionEntity;
  readonly deserialize: (entity: AzureTableSubmissionEntity) => T;
  readonly matchesEntity: (entity: AzureTableSubmissionEntity) => boolean;
  readonly createPartitionKey: (value: T) => string;
  readonly createPartitionKeyFromQuery: (formId: string, query: SubmissionPageQueryOptions) => string | undefined;
  readonly createRowKey: (value: T) => string;
}

export interface AzureTableFieldMapping {
  readonly partitionKeyProperty?: string;
  readonly rowKeyProperty?: string;
  readonly formId?: string;
  readonly formVersion?: string;
  readonly submittedAt?: string;
  readonly values?: string;
  readonly metadata?: string;
  readonly customPropertyMappings?: Readonly<Record<string, string>>;
}

export interface AzureTableValueCodec {
  readonly encodeValues?: (values: Record<string, unknown>) => string;
  readonly decodeValues?: (raw: string) => Record<string, unknown>;
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
  readonly codec?: AzureTableSubmissionCodec<T> | AzureTableValueCodec;
  readonly buildSubmissionFilter?: (formId: string, query: SubmissionPageQueryOptions) => string;
  readonly maxScanPages?: number;
  readonly fieldMapping?: AzureTableFieldMapping;
  readonly readOnly?: boolean;
  /** Enable typed duplicate/conflict results for submission IDs. */
  readonly idempotentSubmissions?: boolean;
  /** Alias for idempotentSubmissions. */
  readonly idempotency?: boolean;
  /** Re-validate a submission against the stored FormSchema before saving. */
  readonly validateSubmissions?: boolean;
  /** Validate every saved submission with an application-owned schema or callback. */
  readonly submissionSchema?: FormSubmissionValidationSource;
  readonly submissionValidator?: FormSubmissionValidator;
  /** Alias for `submissionValidator`/`submissionSchema`. */
  readonly validation?: FormSubmissionValidationSource;
  readonly validator?: FormSubmissionValidationSource;
  readonly schema?: FormSubmissionValidationSource;
}

export interface AzureTableStorageAdapter<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata>
  extends PagedSubmissionStorageAdapter {
  readonly listTextAnswerPage: (
    formId: string,
    fieldIdOrOptions?: string | TextAnswerPageQueryOptions,
    options?: TextAnswerPageQueryOptions
  ) => Promise<TextAnswerPage>;
  readonly fetchSubmissionPage?: (
    formId: string,
    options?: TypedSubmissionPageQueryOptions<TMeta>
  ) => Promise<TypedSubmissionPage<TMeta>>;
  readonly fetchPage: (
    formId: string,
    options?: {
      readonly pageSize?: number;
      readonly fromSubmittedAt?: string;
      readonly toSubmittedAt?: string;
      readonly locale?: string;
      readonly metadataFilters?: Partial<TMeta>;
      readonly cursor?: string;
    }
  ) => Promise<{ readonly items: readonly FormSubmission<TMeta>[]; readonly nextCursor?: string }>;
  readonly aggregateResponses: (schema: FormSchema, options?: SubmissionPageQueryOptions) => Promise<FormAnalytics>;
  readonly exportResponsesToCsv: (schema: FormSchema, options?: StorageSubmissionExportOptions) => Promise<string>;
  readonly validateSubmission: (submission: FormSubmission, source?: FormSubmissionValidationSource) => Promise<void>;
}

export type TypedAzureTableStorageAdapter<TMeta extends BaseSubmissionMetadata | undefined = undefined> = Omit<
  PagedSubmissionStorageAdapter,
  "saveSubmission" | "listSubmissionPage" | "listTextAnswerPage"
> & {
  readonly saveSubmission: (
    submission: FormSubmission<TMeta>,
    options?: SaveSubmissionOptions
  ) => Promise<undefined | SubmissionSaveResult<TMeta>>;
  readonly listSubmissionPage: (
    formId: string,
    options?: SubmissionPageQueryOptions & {
      readonly filter?: SubmissionFilter | ((submission: FormSubmission<TMeta>) => boolean);
      readonly metadataFilters?: TMeta extends BaseSubmissionMetadata
        ? Partial<TMeta>
        : Readonly<Record<string, JsonValue>>;
    }
  ) => Promise<{
    readonly items: readonly FormSubmission<TMeta>[];
    readonly nextCursor?: string;
    readonly hasMore: boolean;
  }>;
  readonly fetchPage: (
    formId: string,
    options?: {
      readonly pageSize?: number;
      readonly fromSubmittedAt?: string;
      readonly toSubmittedAt?: string;
      readonly locale?: string;
      readonly metadataFilters?: TMeta extends BaseSubmissionMetadata
        ? Partial<TMeta>
        : Readonly<Record<string, JsonValue>>;
      readonly cursor?: string;
    }
  ) => Promise<{ readonly items: readonly FormSubmission<TMeta>[]; readonly nextCursor?: string }>;
  readonly fetchSubmissionPage?: (
    formId: string,
    options?: TypedSubmissionPageQueryOptions<TMeta>
  ) => Promise<TypedSubmissionPage<TMeta>>;
  readonly listTextAnswerPage: (
    formId: string,
    fieldIdOrOptions?: string | TextAnswerPageQueryOptions,
    options?: TextAnswerPageQueryOptions
  ) => Promise<TypedTextAnswerPage<TMeta>>;
  readonly aggregateResponses: (
    schema: FormSchema,
    options?: TypedSubmissionPageQueryOptions<TMeta>
  ) => Promise<FormAnalytics>;
  readonly exportResponsesToCsv: (
    schema: FormSchema,
    options?: StorageSubmissionExportOptions<TMeta>
  ) => Promise<string>;
  readonly validateSubmission: (
    submission: FormSubmission<TMeta>,
    source?: FormSubmissionValidationSource<TMeta>
  ) => Promise<void>;
};

interface StoredSchemaEntity extends Record<string, unknown> {
  readonly partitionKey: string;
  readonly rowKey: string;
  readonly kind: "schema";
  readonly formVersion: number;
  readonly payload: string;
}

export interface AzureTextAnswerCursorPayload {
  readonly formatVersion: 1;
  readonly formId: string;
  readonly formVersion?: number;
  readonly fieldIdsSorted: readonly string[];
  readonly filterFingerprint: string;
  readonly tableContinuationToken?: string;
  readonly entityIndex: number;
  readonly fieldIndex: number;
}

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function encodeBase64(bytes: Uint8Array): string {
  let result = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const combined = (first << 16) | (second << 8) | third;
    result += BASE64_ALPHABET[(combined >> 18) & 63] ?? "";
    result += BASE64_ALPHABET[(combined >> 12) & 63] ?? "";
    result += index + 1 < bytes.length ? (BASE64_ALPHABET[(combined >> 6) & 63] ?? "") : "=";
    result += index + 2 < bytes.length ? (BASE64_ALPHABET[combined & 63] ?? "") : "=";
  }
  return result;
}

function decodeBase64(value: string): Uint8Array {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new TypeError("cursor must be a valid Base64 token.");
  }
  const bytes: number[] = [];
  for (let index = 0; index < value.length; index += 4) {
    const characters = value.slice(index, index + 4);
    const sextets = [...characters].map((character) => (character === "=" ? 0 : BASE64_ALPHABET.indexOf(character)));
    const combined =
      ((sextets[0] ?? 0) << 18) | ((sextets[1] ?? 0) << 12) | ((sextets[2] ?? 0) << 6) | (sextets[3] ?? 0);
    bytes.push((combined >> 16) & 255);
    if (characters[2] !== "=") bytes.push((combined >> 8) & 255);
    if (characters[3] !== "=") bytes.push(combined & 255);
  }
  return new Uint8Array(bytes);
}

function encodeAzureTextAnswerCursor(value: AzureTextAnswerCursorPayload): string {
  return encodeBase64(new TextEncoder().encode(JSON.stringify(value)));
}

function decodeAzureTextAnswerCursor(cursor: string): AzureTextAnswerCursorPayload {
  try {
    const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(decodeBase64(cursor))) as unknown;
    if (
      !isRecord(value) ||
      value.formatVersion !== 1 ||
      typeof value.formId !== "string" ||
      value.formId.length === 0 ||
      (value.formVersion !== undefined &&
        (!Number.isSafeInteger(value.formVersion) || (value.formVersion as number) < 1)) ||
      !Array.isArray(value.fieldIdsSorted) ||
      value.fieldIdsSorted.some((fieldId) => typeof fieldId !== "string") ||
      typeof value.filterFingerprint !== "string" ||
      value.filterFingerprint.length === 0 ||
      (value.tableContinuationToken !== undefined &&
        (typeof value.tableContinuationToken !== "string" || value.tableContinuationToken.length === 0)) ||
      !Number.isSafeInteger(value.entityIndex) ||
      (value.entityIndex as number) < 0 ||
      !Number.isSafeInteger(value.fieldIndex) ||
      (value.fieldIndex as number) < 0
    ) {
      throw new TypeError("Azure text answer cursor payload is invalid.");
    }
    return {
      formatVersion: 1,
      formId: value.formId,
      ...(value.formVersion === undefined ? {} : { formVersion: value.formVersion as number }),
      fieldIdsSorted: value.fieldIdsSorted as string[],
      filterFingerprint: value.filterFingerprint,
      ...(value.tableContinuationToken === undefined
        ? {}
        : { tableContinuationToken: value.tableContinuationToken as string }),
      entityIndex: value.entityIndex as number,
      fieldIndex: value.fieldIndex as number
    };
  } catch (cause) {
    if (cause instanceof TypeError && cause.message === "Azure text answer cursor payload is invalid.") throw cause;
    throw new TypeError("cursor must be a valid Azure text answer cursor.", { cause });
  }
}

function canonicalValue(value: unknown): string {
  if (typeof value === "function") return JSON.stringify(`function:${String(value)}`);
  if (value === undefined) return "undefined";
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") return Number.isFinite(value) ? JSON.stringify(value) : JSON.stringify(String(value));
  if (Array.isArray(value)) return `[${value.map(canonicalValue).join(",")}]`;
  if (!isRecord(value)) return JSON.stringify(String(value));
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalValue(value[key])}`)
    .join(",")}}`;
}

async function textAnswerFilterFingerprint(
  odataFilter: string,
  query: TextAnswerPageQueryOptions,
  allFields: boolean
): Promise<string> {
  const canonical = canonicalValue({
    odataFilter,
    filter: query.filter,
    metadataFilters: query.metadataFilters,
    allFields
  });
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function cursorContextMatches(
  cursor: AzureTextAnswerCursorPayload,
  formId: string,
  formVersion: number | undefined,
  fieldIdsSorted: readonly string[],
  filterFingerprint: string
): boolean {
  return (
    cursor.formId === formId &&
    cursor.formVersion === formVersion &&
    cursor.filterFingerprint === filterFingerprint &&
    cursor.fieldIdsSorted.length === fieldIdsSorted.length &&
    cursor.fieldIdsSorted.every((fieldId, index) => fieldId === fieldIdsSorted[index])
  );
}

function textAnswerQuery(
  fieldIdOrOptions: string | TextAnswerPageQueryOptions | undefined,
  options: TextAnswerPageQueryOptions | undefined
): { readonly query: TextAnswerPageQueryOptions; readonly fieldIds?: readonly string[] } {
  const query = typeof fieldIdOrOptions === "string" ? (options ?? {}) : (fieldIdOrOptions ?? {});
  const requested = typeof fieldIdOrOptions === "string" ? [fieldIdOrOptions] : query.fieldIds;
  if (requested?.some((fieldId) => fieldId.trim().length === 0)) {
    throw new TypeError("fieldIds must not contain empty values.");
  }
  const fieldIds = requested === undefined ? undefined : [...new Set(requested)];
  return { query, ...(fieldIds === undefined ? {} : { fieldIds }) };
}

function submissionTextAnswers(
  submission: FormSubmission,
  fieldIds: readonly string[] | undefined
): Array<{ readonly fieldId: string; readonly text: string }> {
  const entries =
    fieldIds === undefined
      ? Object.entries(submission.values)
      : fieldIds.map((id): [string, FormValue] => [id, submission.values[id]]);
  return entries.flatMap(([fieldId, value]) =>
    typeof value === "string" && value.length > 0 ? [{ fieldId, text: value }] : []
  );
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

function propertyName(mapping: AzureTableFieldMapping | undefined, logicalName: string, fallback: string): string {
  return (
    mapping?.customPropertyMappings?.[logicalName] ??
    (logicalName === "formId" ? mapping?.formId : undefined) ??
    (logicalName === "formVersion" ? mapping?.formVersion : undefined) ??
    (logicalName === "submittedAt" ? mapping?.submittedAt : undefined) ??
    (logicalName === "values" ? mapping?.values : undefined) ??
    (logicalName === "metadata" ? mapping?.metadata : undefined) ??
    fallback
  );
}

function physicalKeyNames(mapping: AzureTableFieldMapping | undefined): {
  readonly partitionKey: string;
  readonly rowKey: string;
} {
  return {
    partitionKey: mapping?.partitionKeyProperty ?? "PartitionKey",
    rowKey: mapping?.rowKeyProperty ?? "RowKey"
  };
}

function entityKey(entity: Record<string, unknown>, property: string, compatibilityProperty: string): unknown {
  return entity[property] ?? entity[compatibilityProperty];
}

function mappedSubmissionEntity(
  entity: Record<string, unknown>,
  submission: FormSubmission,
  mapping: AzureTableFieldMapping | undefined,
  valueCodec: AzureTableValueCodec | undefined
): Record<string, unknown> {
  if (mapping === undefined && valueCodec === undefined) return entity;
  const keys = physicalKeyNames(mapping);
  const values = valueCodec?.encodeValues?.({ ...submission.values }) ?? JSON.stringify(submission.values);
  const metadata = submission.metadata === undefined ? undefined : JSON.stringify(submission.metadata);
  return {
    ...entity,
    [keys.partitionKey]: submission.formId,
    [keys.rowKey]: entity.rowKey ?? defaultSubmissionRowKey(submission),
    [propertyName(mapping, "formId", "formId")]: submission.formId,
    [propertyName(mapping, "formVersion", "formVersion")]: submission.formVersion,
    [propertyName(mapping, "submittedAt", "submittedAt")]: submission.submittedAt,
    [propertyName(mapping, "values", "values")]: values,
    ...(metadata === undefined ? {} : { [propertyName(mapping, "metadata", "metadata")]: metadata })
  };
}

function mappedSubmissionFromEntity(
  entity: Record<string, unknown>,
  mapping: AzureTableFieldMapping | undefined,
  valueCodec: AzureTableValueCodec | undefined
): FormSubmission | undefined {
  const id = typeof entity.responseId === "string" ? entity.responseId : entity.id;
  const formId = entity[propertyName(mapping, "formId", "formId")];
  const formVersion = entity[propertyName(mapping, "formVersion", "formVersion")];
  const submittedAt = entity[propertyName(mapping, "submittedAt", "submittedAt")];
  const rawValues = entity[propertyName(mapping, "values", "values")];
  if (
    typeof id !== "string" ||
    typeof formId !== "string" ||
    typeof formVersion !== "number" ||
    typeof submittedAt !== "string" ||
    typeof rawValues !== "string"
  )
    return undefined;
  const values = valueCodec?.decodeValues?.(rawValues) ?? parseJson(rawValues, "submission values");
  if (!isRecord(values) || !Object.values(values).every(isFormValue))
    throw new Error("Azure Table values are invalid.");
  const rawMetadata = entity[propertyName(mapping, "metadata", "metadata")];
  const metadata = rawMetadata === undefined ? undefined : parseJson(rawMetadata, "submission metadata");
  return parseSubmission(
    {
      id,
      formId,
      formVersion,
      locale: typeof entity.locale === "string" ? entity.locale : "",
      values,
      ...(metadata === undefined || !isRecord(metadata) ? {} : { metadata }),
      submittedAt
    },
    "mapped submission entity"
  );
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

export function createAzureTableSubmissionCodec<
  TMeta extends BaseSubmissionMetadata | undefined = undefined
>(): AzureTableSubmissionCodec<FormSubmission<TMeta>> {
  return {
    createEntity: (submission) => ({
      ...scalarMetadata(submission.metadata),
      kind: "submission",
      formVersion: submission.formVersion,
      locale: submission.locale,
      submittedAt: submission.submittedAt,
      responseId: submission.id,
      payload: JSON.stringify(submission)
    }),
    deserialize: (entity) => parseSubmission(entity.payload, "submission entity") as FormSubmission<TMeta>,
    matchesEntity: (entity) => entity.kind === "submission",
    createPartitionKey: (submission) => submission.formId,
    createPartitionKeyFromQuery: (formId) => formId,
    createRowKey: defaultSubmissionRowKey
  };
}

export const defaultAzureTableSubmissionCodec: AzureTableSubmissionCodec<FormSubmission> =
  createAzureTableSubmissionCodec();

async function collectSubmissionPages(
  fetchPage: (
    formId: string,
    options: SubmissionPageQueryOptions
  ) => Promise<{ readonly items: readonly FormSubmission[]; readonly nextCursor?: string; readonly hasMore: boolean }>,
  formId: string,
  options: SubmissionPageQueryOptions
): Promise<readonly FormSubmission[]> {
  const submissions: FormSubmission[] = [];
  const seen = new Set<string>();
  let cursor = options.cursor;
  do {
    if (cursor !== undefined) {
      if (seen.has(cursor)) throw new TypeError("Submission pagination cursor cycle detected.");
      seen.add(cursor);
    }
    const page = await fetchPage(formId, { ...options, ...(cursor === undefined ? {} : { cursor }) });
    submissions.push(...page.items);
    if (!page.hasMore || page.nextCursor === undefined || page.nextCursor.length === 0) break;
    cursor = page.nextCursor;
  } while (cursor !== undefined);
  return submissions;
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
  value: AzureTableSubmissionEntity,
  codec: AzureTableSubmissionCodec<FormSubmission>,
  mapping?: AzureTableFieldMapping,
  valueCodec?: AzureTableValueCodec
): FormSubmission {
  const keys = physicalKeyNames(mapping);
  const partitionKey = entityKey(value, keys.partitionKey, "partitionKey");
  const rowKey = entityKey(value, keys.rowKey, "rowKey");
  if (typeof partitionKey !== "string" || typeof rowKey !== "string" || !codec.matchesEntity(value)) {
    throw new Error("Azure Table submission entity is invalid.");
  }
  const submissionValue = mappedSubmissionFromEntity(value, mapping, valueCodec) ?? codec.deserialize(value);
  const submission = parseSubmission(submissionValue, `submission ${partitionKey}/${rowKey}`);
  if (codec.createPartitionKey(submission) !== partitionKey || codec.createRowKey(submission) !== rowKey) {
    throw new Error("Azure Table submission entity has inconsistent keys.");
  }
  return submission;
}

function assertCanonicalSubmissionEntity(value: Record<string, unknown>): asserts value is AzureTableSubmissionEntity {
  if (Object.hasOwn(value, "answers")) {
    throw new Error("Azure Table legacy answers column is not supported by the standard submission storage.");
  }
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

export function metadataFiltersToOData(options: SubmissionPageQueryOptions, mapping?: AzureTableFieldMapping): string {
  return Object.entries(options.metadataFilters ?? {})
    .map(([key, value]) => {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) throw new TypeError(`Invalid Azure Table property name: ${key}`);
      const property =
        mapping?.customPropertyMappings?.[`metadata.${key}`] ?? mapping?.customPropertyMappings?.[key] ?? key;
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(property))
        throw new TypeError(`Invalid Azure Table property name: ${property}`);
      return `${property} eq ${valueToOData(value)}`;
    })
    .join(" and ");
}

function odataProperty(path: string, mapping?: AzureTableFieldMapping): string | undefined {
  if (path === "id" || path === "responseId") return "responseId";
  if (["formVersion", "locale", "submittedAt"].includes(path)) {
    return propertyName(mapping, path, path);
  }
  if (path.startsWith("metadata.")) {
    const property = path.slice("metadata.".length);
    const mapped = mapping?.customPropertyMappings?.[path] ?? mapping?.customPropertyMappings?.[property] ?? property;
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(mapped) ? mapped : undefined;
  }
  return undefined;
}

export function submissionFilterToOData(
  filter: SubmissionFilter,
  mapping?: AzureTableFieldMapping
): string | undefined {
  if (filter.op === "and" || filter.op === "or") {
    const converted = filter.filters.map((child) => submissionFilterToOData(child, mapping));
    if (filter.op === "or" && converted.some((value) => value === undefined)) return undefined;
    const available = converted.filter((value): value is string => value !== undefined && value.length > 0);
    if (available.length === 0) return undefined;
    return available.map((value) => `(${value})`).join(filter.op === "and" ? " and " : " or ");
  }
  const property = odataProperty(filter.path, mapping);
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
  customExtension: string,
  mapping?: AzureTableFieldMapping
): string {
  const partitionKey = codec.createPartitionKeyFromQuery(formId, options);
  const ast =
    options.filter === undefined || typeof options.filter === "function"
      ? undefined
      : submissionFilterToOData(options.filter, mapping);
  const keys = physicalKeyNames(mapping);
  return [
    ...(partitionKey === undefined ? [] : [`${keys.partitionKey} eq '${escapeOData(partitionKey)}'`]),
    ...(codec === defaultAzureTableSubmissionCodec ? ["kind eq 'submission'"] : []),
    ...(options.version === undefined
      ? []
      : [`${propertyName(mapping, "formVersion", "formVersion")} eq ${options.version}`]),
    ...(options.since === undefined
      ? []
      : [`${propertyName(mapping, "submittedAt", "submittedAt")} ge '${escapeOData(options.since)}'`]),
    ...(options.until === undefined
      ? []
      : [`${propertyName(mapping, "submittedAt", "submittedAt")} le '${escapeOData(options.until)}'`]),
    ...(options.locale === undefined ? [] : [`locale eq '${escapeOData(options.locale)}'`]),
    ...(ast === undefined || ast.length === 0 ? [] : [`(${ast})`]),
    ...(customExtension.trim().length === 0 ? [] : [`(${customExtension})`])
  ].join(" and ");
}

function isNotFound(error: unknown): boolean {
  return (
    isRecord(error) &&
    (error.statusCode === 404 || error.code === "ResourceNotFound" || error.code === "EntityNotFound")
  );
}

function isDuplicateEntityError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : isRecord(error) ? String(error.message ?? "") : "";
  return (
    (isRecord(error) && (error.statusCode === 409 || error.code === "EntityAlreadyExists")) ||
    /alreadyexists|duplicate/iu.test(message)
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

export function createAzureTableStorage(options?: AzureTableStorageOptions): AzureTableStorageAdapter;
export function createAzureTableStorage<TMeta extends BaseSubmissionMetadata | undefined = undefined>(
  options?: AzureTableStorageOptions
): TypedAzureTableStorageAdapter<TMeta>;
export function createAzureTableStorage<TMeta extends BaseSubmissionMetadata | undefined = undefined>(
  options: AzureTableStorageOptions = {}
): unknown {
  const staticSchemas = options.schemasTableClient ?? options.client;
  const staticSubmissions = options.submissionsTableClient ?? options.client;
  const configuredCodec = options.codec;
  const valueCodec = configuredCodec !== undefined && "encodeValues" in configuredCodec ? configuredCodec : undefined;
  const codec =
    (configuredCodec !== undefined && "createEntity" in configuredCodec ? configuredCodec : undefined) ??
    defaultAzureTableSubmissionCodec;
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
      metadataFiltersToOData(query, options.fieldMapping),
      options.fieldMapping
    );
  };
  const ensureWritable = (): void => {
    if (options.readOnly === true) throw new Error("Azure Table storage is read-only.");
  };

  const deserializeIfMatching = (entity: Record<string, unknown>): FormSubmission | undefined => {
    assertCanonicalSubmissionEntity(entity);
    return codec.matchesEntity(entity)
      ? parseSubmissionEntity(entity, codec, options.fieldMapping, valueCodec)
      : undefined;
  };

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

  const adapter: Omit<PagedSubmissionStorageAdapter, "saveSubmission"> & {
    saveSubmission(
      submission: FormSubmission,
      saveOptions?: SaveSubmissionOptions
    ): Promise<undefined | SubmissionSaveResult>;
    aggregateResponses(schema: FormSchema, options?: SubmissionPageQueryOptions): Promise<FormAnalytics>;
    exportResponsesToCsv(schema: FormSchema, options?: StorageSubmissionExportOptions): Promise<string>;
    validateSubmission(submission: FormSubmission, source?: FormSubmissionValidationSource): Promise<void>;
  } = {
    async saveSchema(schema) {
      ensureWritable();
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
      ensureWritable();
      await (await schemaClient(formId)).deleteEntity(formId, schemaRowKey(formVersion));
    },
    async saveSubmission(
      submission: FormSubmission,
      saveOptions: SaveSubmissionOptions = {}
    ): Promise<undefined | SubmissionSaveResult> {
      ensureWritable();
      const stored = parseSubmission(submission, `input ${String(submission?.id)}`);
      const explicitValidation = saveOptions.validator ?? saveOptions.validation;
      const configuredValidation =
        options.submissionValidator ??
        options.submissionSchema ??
        options.validator ??
        options.schema ??
        options.validation;
      if (explicitValidation !== undefined) await assertValidFormSubmissionWith(explicitValidation, stored);
      if (explicitValidation === undefined && configuredValidation !== undefined) {
        await assertValidFormSubmissionWith(configuredValidation, stored);
      }
      if (options.validateSubmissions === true || saveOptions.validateAgainstSchema === true) {
        const schema = parseSchemaEntity(
          await (await schemaClient(stored.formId)).getEntity(stored.formId, schemaRowKey(stored.formVersion))
        );
        assertValidFormSubmission(schema, stored);
      }
      const payloadHash = await hashFormSubmissionPayload(stored);
      const createdEntity = codec.createEntity(stored);
      assertCanonicalSubmissionEntity(createdEntity);
      const mappedEntity = mappedSubmissionEntity(createdEntity, stored, options.fieldMapping, valueCodec);
      const keys = physicalKeyNames(options.fieldMapping);
      const partitionKey = codec.createPartitionKey(stored);
      const rowKey = codec.createRowKey(stored);
      const entity = {
        ...mappedEntity,
        payloadHash,
        partitionKey,
        rowKey,
        [keys.partitionKey]: partitionKey,
        [keys.rowKey]: rowKey
      };
      try {
        await (await submissionClient(stored.formId)).createEntity(entity);
      } catch (error) {
        const idempotent = saveOptions.idempotent ?? options.idempotentSubmissions ?? options.idempotency ?? false;
        if (!idempotent || !isDuplicateEntityError(error)) throw error;
        const existingEntity = await (await submissionClient(stored.formId)).getEntity(partitionKey, rowKey);
        const existing = parseSubmissionEntity(existingEntity, codec, options.fieldMapping, valueCodec);
        const existingPayloadHash =
          typeof existingEntity.payloadHash === "string"
            ? existingEntity.payloadHash
            : await hashFormSubmissionPayload(existing);
        if (existingPayloadHash === payloadHash) {
          return { status: "duplicate", submission: existing, payloadHash };
        }
        return { status: "conflict", submissionId: stored.id, payloadHash, existingPayloadHash };
      }
      if (saveOptions.idempotent ?? options.idempotentSubmissions ?? options.idempotency ?? false) {
        return { status: "created", submission: stored, payloadHash };
      }
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
    async listTextAnswerPage(formId, fieldIdOrOptions, providedOptions): Promise<TextAnswerPage> {
      const { query, fieldIds } = textAnswerQuery(fieldIdOrOptions, providedOptions);
      const pageSize = normalizeSubmissionPageSize(query.pageSize);
      const fieldIdsSorted = [...(fieldIds ?? [])].sort();
      const odataFilter = queryFilter(formId, query);
      const filterFingerprint = await textAnswerFilterFingerprint(odataFilter, query, fieldIds === undefined);
      const cursor = query.cursor === undefined ? undefined : decodeAzureTextAnswerCursor(query.cursor);
      if (
        cursor !== undefined &&
        !cursorContextMatches(cursor, formId, query.version, fieldIdsSorted, filterFingerprint)
      ) {
        throw new TypeError("invalid_cursor_context");
      }
      const cursorContext = {
        formatVersion: 1 as const,
        formId,
        ...(query.version === undefined ? {} : { formVersion: query.version }),
        fieldIdsSorted,
        filterFingerprint
      };
      const client = await submissionClient(formId, query);
      const items: TextAnswerItem[] = [];
      let tableContinuationToken = cursor?.tableContinuationToken;
      let entityStartIndex = cursor?.entityIndex ?? 0;
      let fieldStartIndex = cursor?.fieldIndex ?? 0;
      let scannedPages = 0;

      while (scannedPages < maxScanPages) {
        const requestToken = tableContinuationToken;
        const iterator = client.listEntities({ queryOptions: { filter: odataFilter } }).byPage({
          maxPageSize: pageSize,
          ...(requestToken === undefined ? {} : { continuationToken: requestToken })
        });
        const result = await iterator.next();
        if (result.done === true) break;
        scannedPages += 1;
        const page = result.value;
        for (let entityIndex = entityStartIndex; entityIndex < page.length; entityIndex += 1) {
          const raw = page[entityIndex];
          if (raw === undefined) continue;
          const submission = deserializeIfMatching(raw);
          if (
            submission === undefined ||
            !matchesBuiltInFilters(submission, formId, query) ||
            !matchesSubmissionPageFilters(submission, query)
          ) {
            fieldStartIndex = 0;
            continue;
          }
          const answers = submissionTextAnswers(submission, fieldIds);
          const metadata =
            submission.metadata === undefined
              ? undefined
              : Object.fromEntries(
                  Object.entries(submission.metadata).filter(
                    (entry): entry is [string, JsonValue] => entry[1] !== undefined
                  )
                );
          for (
            let fieldIndex = entityIndex === entityStartIndex ? fieldStartIndex : 0;
            fieldIndex < answers.length;
            fieldIndex += 1
          ) {
            const answer = answers[fieldIndex];
            if (answer === undefined) continue;
            items.push({
              responseId: submission.id,
              formId: submission.formId,
              formVersion: submission.formVersion,
              fieldId: answer.fieldId,
              text: answer.text,
              ...(submission.locale === undefined ? {} : { locale: submission.locale }),
              submittedAt: submission.submittedAt,
              ...(metadata === undefined ? {} : { metadata })
            });
            if (items.length < pageSize) continue;

            const nextFieldIndex = fieldIndex + 1;
            const hasFieldsInEntity = nextFieldIndex < answers.length;
            const hasEntitiesInPage = entityIndex + 1 < page.length;
            const nextPageToken = page.continuationToken;
            const hasMore = hasFieldsInEntity || hasEntitiesInPage || nextPageToken !== undefined;
            if (!hasMore) return { items, hasMore: false };
            const nextCursor: AzureTextAnswerCursorPayload = hasFieldsInEntity
              ? {
                  ...cursorContext,
                  ...(requestToken === undefined ? {} : { tableContinuationToken: requestToken }),
                  entityIndex,
                  fieldIndex: nextFieldIndex
                }
              : hasEntitiesInPage
                ? {
                    ...cursorContext,
                    ...(requestToken === undefined ? {} : { tableContinuationToken: requestToken }),
                    entityIndex: entityIndex + 1,
                    fieldIndex: 0
                  }
                : {
                    ...cursorContext,
                    ...(nextPageToken === undefined ? {} : { tableContinuationToken: nextPageToken }),
                    entityIndex: 0,
                    fieldIndex: 0
                  };
            return { items, hasMore: true, nextCursor: encodeAzureTextAnswerCursor(nextCursor) };
          }
          fieldStartIndex = 0;
        }
        tableContinuationToken = page.continuationToken;
        entityStartIndex = 0;
        fieldStartIndex = 0;
        if (tableContinuationToken === undefined) break;
      }

      if (tableContinuationToken === undefined) return { items, hasMore: false };
      return {
        items,
        hasMore: true,
        nextCursor: encodeAzureTextAnswerCursor({
          ...cursorContext,
          tableContinuationToken,
          entityIndex: 0,
          fieldIndex: 0
        })
      };
    },
    async aggregateResponses(schema: FormSchema, options: SubmissionPageQueryOptions = {}): Promise<FormAnalytics> {
      const query = { ...options, version: options.version ?? schema.version };
      const items = await collectSubmissionPages(
        (formId, pageOptions) => adapter.listSubmissionPage(formId, pageOptions),
        schema.id,
        query
      );
      return aggregateResponses(schema, items);
    },
    async exportResponsesToCsv(schema: FormSchema, options: StorageSubmissionExportOptions = {}): Promise<string> {
      const { query, ...csvOptions } = options;
      const items = await collectSubmissionPages(
        (formId, pageOptions) => adapter.listSubmissionPage(formId, pageOptions),
        schema.id,
        { ...(query ?? {}), version: query?.version ?? schema.version }
      );
      const exportOptions = {
        ...(csvOptions.withBom === undefined ? {} : { withBom: csvOptions.withBom }),
        ...(csvOptions.useBom === undefined ? {} : { useBom: csvOptions.useBom }),
        ...(csvOptions.neutralizeFormulas === undefined ? {} : { neutralizeFormulas: csvOptions.neutralizeFormulas }),
        ...(csvOptions.preventFormulaInjection === undefined
          ? {}
          : { preventFormulaInjection: csvOptions.preventFormulaInjection }),
        ...(csvOptions.includeLocale === undefined ? {} : { includeLocale: csvOptions.includeLocale }),
        ...(csvOptions.includePiiStatus === undefined ? {} : { includePiiStatus: csvOptions.includePiiStatus }),
        ...(csvOptions.customColumns === undefined ? {} : { customColumns: csvOptions.customColumns }),
        ...(csvOptions.includeMetadataFields === undefined
          ? {}
          : { includeMetadataFields: csvOptions.includeMetadataFields })
      };
      const exportItems = items.map((item) => ({ ...item, metadata: item.metadata ?? {} }));
      return exportResponsesToCsv(schema, exportItems, exportOptions);
    },
    async validateSubmission(submission: FormSubmission, source?: FormSubmissionValidationSource): Promise<void> {
      if (source !== undefined) {
        await assertValidFormSubmissionWith(source, submission);
        return;
      }
      const schema = await adapter.getSchema(submission.formId, submission.formVersion);
      if (schema === null) throw new Error("Azure Table submission schema was not found.");
      assertValidFormSubmission(schema, submission);
    },
    async deleteSubmission(submissionId) {
      ensureWritable();
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
      ensureWritable();
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
      ensureWritable();
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
  return {
    ...adapter,
    async fetchSubmissionPage(formId: string, options?: TypedSubmissionPageQueryOptions<TMeta>) {
      return (await adapter.listSubmissionPage(
        formId,
        options as SubmissionPageQueryOptions
      )) as TypedSubmissionPage<TMeta>;
    },
    async fetchPage(
      formId: string,
      options?: {
        readonly pageSize?: number;
        readonly fromSubmittedAt?: string;
        readonly toSubmittedAt?: string;
        readonly locale?: string;
        readonly metadataFilters?: TMeta extends BaseSubmissionMetadata
          ? Partial<TMeta>
          : Readonly<Record<string, JsonValue>>;
        readonly cursor?: string;
      }
    ) {
      const page = await adapter.listSubmissionPage(formId, {
        ...(options?.pageSize === undefined ? {} : { pageSize: options.pageSize }),
        ...(options?.fromSubmittedAt === undefined ? {} : { since: options.fromSubmittedAt }),
        ...(options?.toSubmittedAt === undefined ? {} : { until: options.toSubmittedAt }),
        ...(options?.locale === undefined ? {} : { locale: options.locale }),
        ...(options?.cursor === undefined ? {} : { cursor: options.cursor }),
        ...(options?.metadataFilters === undefined
          ? {}
          : { metadataFilters: options.metadataFilters as Readonly<Record<string, JsonValue>> })
      });
      return {
        items: page.items as unknown as readonly FormSubmission<TMeta>[],
        ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor })
      };
    }
  } as unknown as TypedAzureTableStorageAdapter<TMeta>;
}
