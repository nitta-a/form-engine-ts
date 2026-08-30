import type {
  BaseSubmissionMetadata,
  FormSchema,
  FormSubmission,
  FormValue,
  FormVersionRecord,
  FormVersionState,
  JsonValue,
  PagedSubmissionStorageAdapter,
  StorageCommitError,
  SubmissionFilter,
  TextAnswerPage,
  TextAnswerPageQueryOptions,
  VersionedFormStorageAdapter,
  VersionTransitionPlan
} from "@form-engine-ts/core";
import {
  assertValidFormSchema,
  decodeSubmissionCursor,
  decodeTextAnswerCursor,
  encodeSubmissionCursor,
  encodeTextAnswerCursor,
  matchesSubmissionPageFilters,
  normalizeSubmissionPageSize
} from "@form-engine-ts/core";
import type {
  ClientSession,
  CreateIndexesOptions,
  Db,
  Document,
  Filter,
  IndexDescription,
  IndexSpecification
} from "mongodb";

export interface MongoCustomIndexDefinition {
  readonly spec: IndexSpecification;
  readonly options?: CreateIndexesOptions;
}

export interface MongoDbStorageOptions {
  readonly db: Db;
  readonly schemasCollectionName?: string;
  readonly responsesCollectionName?: string;
  readonly versionsCollectionName?: string;
  readonly versionStatesCollectionName?: string;
  readonly collectionNames?: {
    readonly forms?: string;
    readonly formVersions?: string;
    readonly formVersionStates?: string;
    readonly formResponses?: string;
  };
  readonly customIndexes?: {
    readonly forms?: readonly MongoCustomIndexDefinition[];
    readonly formVersions?: readonly MongoCustomIndexDefinition[];
    readonly formResponses?: readonly MongoCustomIndexDefinition[];
  };
}

export interface MongoDbStorageAdapter extends PagedSubmissionStorageAdapter, VersionedFormStorageAdapter {
  createIndexes(): Promise<void>;
}

export interface TypedMongoDbStorageAdapter<TMeta extends BaseSubmissionMetadata> extends MongoDbStorageAdapter {
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
}

interface StoredSchemaDocument extends Document {
  readonly _id: string;
  readonly formId: string;
  readonly formVersion: number;
  readonly schema: FormSchema;
}

interface StoredSubmissionDocument extends Document {
  readonly _id: string;
  readonly formId: string;
  readonly formVersion: number;
  readonly submittedAt: string;
  readonly submission: FormSubmission;
}

interface StoredVersionDocument extends Document {
  readonly _id: string;
  readonly formId: string;
  readonly version: number;
  readonly status: FormVersionRecord["status"];
  readonly record: FormVersionRecord;
}

interface StoredVersionStateDocument extends Document {
  readonly _id: string;
  readonly revision: number;
  readonly updatedAt: string;
  readonly draftVersion?: number;
  readonly publishedVersion?: number;
  readonly nextVersion?: number;
}

interface StoredVersionEventDocument extends Document {
  readonly _id: string;
  readonly formId: string;
  readonly fromRevision: number;
  readonly eventIndex: number;
  readonly event: VersionTransitionPlan["events"][number];
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

function parseSubmission(value: unknown, location: string): FormSubmission {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.formId !== "string" ||
    !Number.isInteger(value.formVersion) ||
    typeof value.locale !== "string" ||
    typeof value.submittedAt !== "string" ||
    !isRecord(value.values) ||
    !Object.values(value.values).every(isFormValue)
  ) {
    throw new Error(`MongoDB submission at ${location} is invalid.`);
  }
  return value as unknown as FormSubmission;
}

function schemaDocumentId(formId: string, formVersion: number): string {
  return `schema:${encodeURIComponent(formId)}:${formVersion}`;
}

function versionDocumentId(formId: string, formVersion: number): string {
  return `version:${encodeURIComponent(formId)}:${formVersion}`;
}

function versionEventDocumentId(formId: string, fromRevision: number, eventIndex: number): string {
  return `event:${encodeURIComponent(formId)}:${fromRevision}:${eventIndex}`;
}

function mongoSubmissionPath(path: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(path) || path.split(".").some((part) => part.startsWith("$"))) {
    throw new TypeError(`Invalid submission filter path: ${path}`);
  }
  const [root, ...rest] = path.split(".");
  const suffix = rest.length === 0 ? "" : `.${rest.join(".")}`;
  if (root === "id" || root === "responseId") return `_id${suffix}`;
  if (root === "formId" || root === "formVersion" || root === "submittedAt") return `${root}${suffix}`;
  if (root === "locale") return `submission.locale${suffix}`;
  return `submission.${path}`;
}

export function submissionFilterToMongo(filter: SubmissionFilter): Document {
  if (filter.op === "and" || filter.op === "or") {
    return { [filter.op === "and" ? "$and" : "$or"]: filter.filters.map(submissionFilterToMongo) };
  }
  const path = mongoSubmissionPath(filter.path);
  if (filter.op === "eq") return { [path]: filter.value };
  if (filter.op === "in") return { [path]: { $in: [...filter.values] } };
  if (filter.op === "exists") return { [path]: { $exists: filter.value } };
  return {
    [path]: {
      ...(filter.from === undefined ? {} : { $gte: filter.from }),
      ...(filter.to === undefined ? {} : { $lte: filter.to })
    }
  };
}

function assertVersionRecord(
  record: FormVersionRecord,
  formId: string,
  expectedStatus?: FormVersionRecord["status"]
): void {
  if (
    record.formId !== formId ||
    record.schema.id !== formId ||
    record.schema.version !== record.version ||
    !Number.isSafeInteger(record.version) ||
    record.version < 1 ||
    !Number.isSafeInteger(record.revision) ||
    record.revision < 0 ||
    (expectedStatus !== undefined && record.status !== expectedStatus)
  ) {
    throw new TypeError("Version transition record is inconsistent.");
  }
  assertValidFormSchema(record.schema);
}

function assertTransitionPlan(plan: VersionTransitionPlan): void {
  if (
    plan.formId.trim().length === 0 ||
    !Number.isSafeInteger(plan.expectedRevision) ||
    plan.expectedRevision < 0 ||
    plan.nextRevision !== plan.expectedRevision + 1 ||
    !Number.isFinite(Date.parse(plan.timestamp))
  ) {
    throw new TypeError("Version transition plan is invalid.");
  }
  if (!Array.isArray(plan.events)) throw new TypeError("Version transition plan events are required.");
  if (plan.draftToCreate !== undefined) assertVersionRecord(plan.draftToCreate, plan.formId, "draft");
  if (plan.publishedRecordToSave !== undefined) {
    assertVersionRecord(plan.publishedRecordToSave, plan.formId, "published");
  }
  for (const record of plan.archivedRecordsToSave ?? []) assertVersionRecord(record, plan.formId, "archived");
  if (
    plan.draftToDeleteVersion !== undefined &&
    (!Number.isSafeInteger(plan.draftToDeleteVersion) || plan.draftToDeleteVersion < 1)
  ) {
    throw new TypeError("draftToDeleteVersion must be a positive safe integer.");
  }
}

function parseVersionRecordDocument(document: StoredVersionDocument): FormVersionRecord {
  assertVersionRecord(document.record, document.formId);
  if (
    document._id !== versionDocumentId(document.formId, document.version) ||
    document.record.version !== document.version ||
    document.record.status !== document.status
  ) {
    throw new Error(`MongoDB version document "${String(document._id)}" has inconsistent metadata.`);
  }
  return cloneJson(document.record);
}

function mongoErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : isRecord(error) ? String(error.message ?? "") : "";
}

function isDuplicateKeyError(error: unknown): boolean {
  return isRecord(error) && error.code === 11000;
}

function duplicateIndexName(error: unknown): string | undefined {
  if (!isDuplicateKeyError(error)) return undefined;
  return /unique_(?:draft|published|version)_per_form/u.exec(mongoErrorMessage(error))?.[0];
}

function isRevisionConflict(error: unknown): boolean {
  if (!isRecord(error)) return false;
  if (error.code === 11000) return duplicateIndexName(error) !== "unique_draft_per_form";
  if (error.code === 112 || error.code === 251) return true;
  return typeof error.hasErrorLabel === "function" && error.hasErrorLabel("TransientTransactionError") === true;
}

function isTransactionUnsupported(error: unknown): boolean {
  if (!isRecord(error)) return false;
  if (error.code === 20 || error.code === 263 || error.code === 303) return true;
  return /transaction numbers are only allowed|transactions? (?:are|is) not supported|replica set member|mongos/iu.test(
    mongoErrorMessage(error)
  );
}

function parseSchemaDocument(document: StoredSchemaDocument): FormSchema {
  try {
    assertValidFormSchema(document.schema);
  } catch (cause) {
    throw new Error(`MongoDB schema document "${String(document._id)}" is invalid.`, { cause });
  }
  if (
    document._id !== schemaDocumentId(document.schema.id, document.schema.version) ||
    document.formId !== document.schema.id ||
    document.formVersion !== document.schema.version
  ) {
    throw new Error(`MongoDB schema document "${String(document._id)}" has inconsistent metadata.`);
  }
  return cloneJson(document.schema);
}

function parseSubmissionDocument(document: StoredSubmissionDocument): FormSubmission {
  const submission = parseSubmission(document.submission, `document "${String(document._id)}"`);
  if (
    document._id !== submission.id ||
    document.formId !== submission.formId ||
    document.formVersion !== submission.formVersion ||
    document.submittedAt !== submission.submittedAt
  ) {
    throw new Error(`MongoDB submission document "${String(document._id)}" has inconsistent metadata.`);
  }
  return cloneJson(submission);
}

function collectionName(value: string | undefined, fallback: string, optionName: string): string {
  if (value === undefined) return fallback;
  if (value.trim().length === 0) throw new TypeError(`${optionName} must be a non-empty string.`);
  return value;
}

function normalizeIndexSpecification(spec: IndexSpecification): IndexDescription["key"] {
  if (typeof spec === "string") return { [spec]: 1 };
  if (Array.isArray(spec)) return Object.fromEntries(spec.map((field) => [field, 1]));
  if (spec instanceof Map) return spec as IndexDescription["key"];
  if (!isRecord(spec) || Object.keys(spec).length === 0) throw new TypeError("Index specification must not be empty.");
  return spec as IndexDescription["key"];
}

function customIndexDescriptions(definitions: readonly MongoCustomIndexDefinition[] | undefined): IndexDescription[] {
  return (definitions ?? []).map(({ spec, options: indexOptions }) => ({
    ...(indexOptions ?? {}),
    key: normalizeIndexSpecification(spec)
  }));
}

interface IndexableCollection {
  createIndexes(specifications: IndexDescription[]): Promise<unknown>;
  createIndex?(specification: IndexDescription["key"], options?: CreateIndexesOptions): Promise<unknown>;
}

async function createConfiguredIndexes(
  collection: IndexableCollection,
  defaults: IndexDescription[],
  custom: readonly MongoCustomIndexDefinition[] | undefined
): Promise<void> {
  const definitions = custom ?? [];
  if (definitions.length === 0) {
    await collection.createIndexes(defaults);
    return;
  }
  if (collection.createIndex === undefined) {
    await collection.createIndexes([...defaults, ...customIndexDescriptions(definitions)]);
    return;
  }
  await collection.createIndexes(defaults);
  for (const { spec, options: indexOptions } of definitions) {
    await collection.createIndex(normalizeIndexSpecification(spec), indexOptions);
  }
}

export function createMongoDbStorage(options: MongoDbStorageOptions): MongoDbStorageAdapter;
export function createMongoDbStorage<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata>(
  options: MongoDbStorageOptions
): TypedMongoDbStorageAdapter<TMeta> {
  if (options?.db === undefined) throw new TypeError("db is required.");
  const collectionNames = options.collectionNames;
  const schemasCollectionName = collectionName(
    collectionNames?.forms ?? options.schemasCollectionName,
    collectionNames === undefined ? "form_schemas" : "forms",
    collectionNames?.forms === undefined ? "schemasCollectionName" : "collectionNames.forms"
  );
  const responsesCollectionName = collectionName(
    collectionNames?.formResponses ?? options.responsesCollectionName,
    "form_responses",
    collectionNames?.formResponses === undefined ? "responsesCollectionName" : "collectionNames.formResponses"
  );
  const versionsCollectionName = collectionName(
    collectionNames?.formVersions ?? options.versionsCollectionName,
    "form_versions",
    collectionNames?.formVersions === undefined ? "versionsCollectionName" : "collectionNames.formVersions"
  );
  const versionStatesCollectionName = collectionName(
    collectionNames?.formVersionStates ?? options.versionStatesCollectionName,
    "form_version_states",
    collectionNames?.formVersionStates === undefined
      ? "versionStatesCollectionName"
      : "collectionNames.formVersionStates"
  );
  const versionEventsCollectionName = "form_version_events";
  const schemas = options.db.collection<StoredSchemaDocument>(schemasCollectionName);
  const submissions = options.db.collection<StoredSubmissionDocument>(responsesCollectionName);
  const versions = options.db.collection<StoredVersionDocument>(versionsCollectionName);
  const versionStates = options.db.collection<StoredVersionStateDocument>(versionStatesCollectionName);
  const versionEvents = options.db.collection<StoredVersionEventDocument>(versionEventsCollectionName);

  const storageRevisionConflict = async (
    plan: VersionTransitionPlan
  ): Promise<{ readonly success: false; readonly error: StorageCommitError }> => {
    const actual = await versionStates.findOne({ _id: plan.formId });
    return {
      success: false,
      error: {
        type: "revision_conflict",
        expectedRevision: plan.expectedRevision,
        ...(actual === null ? {} : { actualRevision: actual.revision })
      }
    };
  };

  const storageDraftAlreadyExists = async (
    plan: VersionTransitionPlan
  ): Promise<{ readonly success: false; readonly error: StorageCommitError }> => {
    const state = await versionStates.findOne({ _id: plan.formId });
    const record = await versions.findOne({ formId: plan.formId, status: "draft" });
    const currentDraftVersion = record?.version ?? state?.draftVersion ?? plan.draftToCreate?.version;
    return currentDraftVersion === undefined
      ? storageRevisionConflict(plan)
      : { success: false, error: { type: "draft_already_exists", currentDraftVersion } };
  };

  const mapCommitError = async (
    error: unknown,
    plan: VersionTransitionPlan
  ): Promise<{ readonly success: false; readonly error: StorageCommitError }> => {
    if (isTransactionUnsupported(error)) return { success: false, error: { type: "transaction_unsupported" } };
    if (duplicateIndexName(error) === "unique_draft_per_form") return storageDraftAlreadyExists(plan);
    if (isRevisionConflict(error)) return storageRevisionConflict(plan);
    return { success: false, error: { type: "storage_error", cause: error } };
  };

  const upsertVersionRecord = async (record: FormVersionRecord, session?: ClientSession): Promise<void> => {
    const stored = cloneJson(record);
    await versions.updateOne(
      { _id: versionDocumentId(record.formId, record.version) },
      { $set: { formId: record.formId, version: record.version, status: record.status, record: stored } },
      { upsert: true, ...(session === undefined ? {} : { session }) }
    );
  };

  const applyVersionTransition = async (
    plan: VersionTransitionPlan,
    session?: ClientSession
  ): Promise<
    | { readonly success: true; readonly value: { readonly success: true } }
    | { readonly success: false; readonly error: StorageCommitError }
  > => {
    const inferredNextVersion = Math.max(
      1,
      (plan.draftToCreate?.version ?? 0) + 1,
      (plan.draftToDeleteVersion ?? 0) + 1,
      (plan.publishedRecordToSave?.version ?? 0) + 1
    );
    const stateSet: Record<string, unknown> = {
      revision: plan.nextRevision,
      nextVersion: plan.nextVersion ?? inferredNextVersion,
      updatedAt: plan.timestamp
    };
    if (plan.draftToCreate !== undefined) stateSet.draftVersion = plan.draftToCreate.version;
    if (plan.publishedRecordToSave !== undefined) stateSet.publishedVersion = plan.publishedRecordToSave.version;
    const stateUpdate = {
      $set: stateSet,
      ...(plan.draftToDeleteVersion === undefined ? {} : { $unset: { draftVersion: "" } })
    };
    const stateResult = await versionStates.updateOne(
      { _id: plan.formId, revision: plan.expectedRevision },
      stateUpdate,
      {
        upsert: plan.expectedRevision === 0,
        ...(session === undefined ? {} : { session })
      }
    );
    if (stateResult.matchedCount === 0 && stateResult.upsertedCount === 0) {
      const actual = await versionStates.findOne({ _id: plan.formId }, session === undefined ? {} : { session });
      return {
        success: false,
        error: {
          type: "revision_conflict",
          expectedRevision: plan.expectedRevision,
          ...(actual === null ? {} : { actualRevision: actual.revision })
        }
      };
    }
    if (plan.draftToDeleteVersion !== undefined) {
      await versions.deleteOne(
        { _id: versionDocumentId(plan.formId, plan.draftToDeleteVersion) },
        session === undefined ? {} : { session }
      );
    }
    if (plan.draftToCreate !== undefined) await upsertVersionRecord(plan.draftToCreate, session);
    for (const record of plan.archivedRecordsToSave ?? []) await upsertVersionRecord(record, session);
    if (plan.publishedRecordToSave !== undefined) await upsertVersionRecord(plan.publishedRecordToSave, session);
    for (const [eventIndex, event] of plan.events.entries()) {
      await versionEvents.updateOne(
        { _id: versionEventDocumentId(plan.formId, plan.expectedRevision, eventIndex) },
        { $set: { formId: plan.formId, fromRevision: plan.expectedRevision, eventIndex, event: cloneJson(event) } },
        { upsert: true, ...(session === undefined ? {} : { session }) }
      );
    }
    return { success: true, value: { success: true } };
  };

  const adapter: PagedSubmissionStorageAdapter & VersionedFormStorageAdapter & { createIndexes(): Promise<void> } = {
    async saveSchema(schema) {
      assertValidFormSchema(schema);
      const stored = cloneJson(schema);
      await schemas.updateOne(
        { _id: schemaDocumentId(schema.id, schema.version) },
        { $set: { formId: schema.id, formVersion: schema.version, schema: stored } },
        { upsert: true }
      );
    },
    async getSchema(formId, formVersion) {
      const document = await schemas.findOne({ _id: schemaDocumentId(formId, formVersion) });
      return document === null ? null : parseSchemaDocument(document);
    },
    async listSchemas() {
      const documents = await schemas.find({}).toArray();
      return documents
        .map(parseSchemaDocument)
        .sort((left, right) => left.id.localeCompare(right.id) || left.version - right.version);
    },
    async deleteSchema(formId, formVersion) {
      await schemas.deleteOne({ _id: schemaDocumentId(formId, formVersion) });
    },
    async saveSubmission(submission) {
      const stored = cloneJson(parseSubmission(submission, `input "${String(submission?.id)}"`));
      await submissions.insertOne({
        _id: stored.id,
        formId: stored.formId,
        formVersion: stored.formVersion,
        submittedAt: stored.submittedAt,
        submission: stored
      });
    },
    async listSubmissions(formId, formVersion, options) {
      const submittedAt =
        options?.since === undefined && options?.until === undefined
          ? undefined
          : {
              ...(options.since === undefined ? {} : { $gte: options.since }),
              ...(options.until === undefined ? {} : { $lte: options.until })
            };
      const documents = await submissions
        .find({
          formId,
          ...(formVersion === undefined ? {} : { formVersion }),
          ...(submittedAt === undefined ? {} : { submittedAt })
        })
        .sort({ submittedAt: 1, _id: 1 })
        .toArray();
      return documents.map(parseSubmissionDocument);
    },
    async listSubmissionPage(formId, options = {}) {
      const pageSize = normalizeSubmissionPageSize(options.pageSize);
      const cursor = options.cursor === undefined ? undefined : decodeSubmissionCursor(options.cursor);
      const submittedAt =
        options.since === undefined && options.until === undefined
          ? undefined
          : {
              ...(options.since === undefined ? {} : { $gte: options.since }),
              ...(options.until === undefined ? {} : { $lte: options.until })
            };
      const baseFilter: Filter<StoredSubmissionDocument> = {
        formId,
        ...(options.version === undefined ? {} : { formVersion: options.version }),
        ...(options.locale === undefined ? {} : { "submission.locale": options.locale }),
        ...(submittedAt === undefined ? {} : { submittedAt }),
        ...(cursor === undefined
          ? {}
          : {
              $or: [
                { submittedAt: { $gt: cursor.submittedAt } },
                { submittedAt: cursor.submittedAt, _id: { $gt: cursor.responseId } }
              ]
            })
      };
      const serverFilters: Document[] = [baseFilter];
      if (options.filter !== undefined && typeof options.filter !== "function") {
        serverFilters.push(submissionFilterToMongo(options.filter));
      }
      for (const [key, value] of Object.entries(options.metadataFilters ?? {})) {
        serverFilters.push({ [`submission.metadata.${key}`]: value });
      }
      const filter: Filter<StoredSubmissionDocument> =
        serverFilters.length === 1 ? baseFilter : { $and: serverFilters };
      const sorted = submissions.find(filter).sort({ submittedAt: 1, _id: 1 });
      const requiresClientFiltering = typeof options.filter === "function";
      const documents = requiresClientFiltering ? await sorted.toArray() : await sorted.limit(pageSize + 1).toArray();
      const candidates = documents
        .map(parseSubmissionDocument)
        .filter((item) => matchesSubmissionPageFilters(item, options));
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
    async listTextAnswerPage(formId, fieldIdOrOptions, providedOptions): Promise<TextAnswerPage> {
      const options: TextAnswerPageQueryOptions =
        typeof fieldIdOrOptions === "string" ? (providedOptions ?? {}) : (fieldIdOrOptions ?? {});
      const requestedFieldIds =
        typeof fieldIdOrOptions === "string"
          ? [fieldIdOrOptions]
          : options.fieldIds === undefined
            ? undefined
            : [...new Set(options.fieldIds)];
      if (requestedFieldIds?.some((fieldId) => fieldId.trim().length === 0)) {
        throw new TypeError("fieldIds must not contain empty values.");
      }
      const pageSize = normalizeSubmissionPageSize(options.pageSize);
      const cursor = options.cursor === undefined ? undefined : decodeTextAnswerCursor(options.cursor);
      if (cursor !== undefined && requestedFieldIds !== undefined && !requestedFieldIds.includes(cursor.fieldId)) {
        throw new TypeError("Text answer cursor fieldId does not match the query fields.");
      }
      const submittedAt =
        options.since === undefined && options.until === undefined
          ? undefined
          : {
              ...(options.since === undefined ? {} : { $gte: options.since }),
              ...(options.until === undefined ? {} : { $lte: options.until })
            };
      const baseFilter: Filter<StoredSubmissionDocument> = {
        formId,
        ...(options.version === undefined ? {} : { formVersion: options.version }),
        ...(options.locale === undefined ? {} : { "submission.locale": options.locale }),
        ...(submittedAt === undefined ? {} : { submittedAt }),
        ...(cursor === undefined ? {} : { _id: { $gte: cursor.responseId } }),
        ...(requestedFieldIds?.length === 1
          ? { [`submission.values.${requestedFieldIds[0]}`]: { $type: "string" } }
          : {})
      };
      const serverFilters: Document[] = [baseFilter];
      if (options.filter !== undefined && typeof options.filter !== "function") {
        serverFilters.push(submissionFilterToMongo(options.filter));
      }
      for (const [key, value] of Object.entries(options.metadataFilters ?? {})) {
        serverFilters.push({ [`submission.metadata.${key}`]: value });
      }
      const filter: Filter<StoredSubmissionDocument> =
        serverFilters.length === 1 ? baseFilter : { $and: serverFilters };
      const sorted = submissions.find(filter).sort({ _id: 1 });
      const documents = await sorted.toArray();
      const candidates = documents
        .map(parseSubmissionDocument)
        .filter((submission) => matchesSubmissionPageFilters(submission, options))
        .flatMap((submission) => {
          const entries =
            requestedFieldIds === undefined
              ? Object.entries(submission.values)
              : requestedFieldIds.map((fieldId) => [fieldId, submission.values[fieldId]] as const);
          return entries.flatMap(([fieldId, text]) => {
            if (typeof text !== "string" || text.length === 0) return [];
            if (
              cursor !== undefined &&
              (submission.id < cursor.responseId || (submission.id === cursor.responseId && fieldId <= cursor.fieldId))
            ) {
              return [];
            }
            return [
              {
                responseId: submission.id,
                formId: submission.formId,
                formVersion: submission.formVersion,
                fieldId,
                text,
                ...(submission.locale === undefined ? {} : { locale: submission.locale }),
                submittedAt: submission.submittedAt,
                ...(submission.metadata === undefined
                  ? {}
                  : {
                      metadata: Object.fromEntries(
                        Object.entries(submission.metadata).filter(
                          (entry): entry is [string, JsonValue] => entry[1] !== undefined
                        )
                      )
                    })
              }
            ];
          });
        });
      const hasMore = candidates.length > pageSize;
      const items = candidates.slice(0, pageSize);
      const last = items.at(-1);
      return {
        items,
        hasMore,
        ...(hasMore && last !== undefined
          ? { nextCursor: encodeTextAnswerCursor({ responseId: last.responseId, fieldId: last.fieldId }) }
          : {})
      };
    },
    async deleteSubmission(submissionId) {
      await submissions.deleteOne({ _id: submissionId });
    },
    async clearResponses(formId) {
      await submissions.deleteMany({ formId });
    },
    async clear() {
      await Promise.all([
        schemas.deleteMany({}),
        submissions.deleteMany({}),
        versions.deleteMany({}),
        versionStates.deleteMany({}),
        versionEvents.deleteMany({})
      ]);
    },
    async getVersionState(formId): Promise<FormVersionState | null> {
      const document = await versionStates.findOne({ _id: formId });
      if (document === null) return null;
      if (!Number.isSafeInteger(document.revision) || document.revision < 0) {
        throw new Error(`MongoDB version state "${formId}" is invalid.`);
      }
      const nextVersion =
        document.nextVersion ?? Math.max(1, (document.draftVersion ?? 0) + 1, (document.publishedVersion ?? 0) + 1);
      return {
        formId,
        revision: document.revision,
        nextVersion,
        ...(document.draftVersion === undefined ? {} : { draftVersion: document.draftVersion }),
        ...(document.publishedVersion === undefined ? {} : { publishedVersion: document.publishedVersion })
      };
    },
    async getVersionRecord(formId, version) {
      const document = await versions.findOne({ _id: versionDocumentId(formId, version) });
      return document === null ? null : parseVersionRecordDocument(document);
    },
    async listVersionRecords(formId) {
      return (await versions.find({ formId }).sort({ version: 1 }).toArray()).map(parseVersionRecordDocument);
    },
    async commitVersionTransition(plan) {
      try {
        assertTransitionPlan(plan);
      } catch (cause) {
        return {
          success: false,
          error: { type: "invalid_transition", message: cause instanceof Error ? cause.message : String(cause) }
        };
      }
      const client = options.db.client;
      if (client === undefined || typeof client.startSession !== "function") {
        return { success: false, error: { type: "transaction_unsupported" } };
      }
      let session: ClientSession;
      try {
        session = client.startSession();
      } catch (error) {
        return isTransactionUnsupported(error)
          ? { success: false, error: { type: "transaction_unsupported" } }
          : { success: false, error: { type: "storage_error", cause: error } };
      }
      if (typeof session.withTransaction !== "function") {
        await session.endSession();
        return { success: false, error: { type: "transaction_unsupported" } };
      }
      try {
        let result:
          | { readonly success: true; readonly value: { readonly success: true } }
          | { readonly success: false; readonly error: StorageCommitError } = {
          success: false,
          error: { type: "revision_conflict", expectedRevision: plan.expectedRevision }
        };
        await session.withTransaction(async () => {
          result = await applyVersionTransition(plan, session);
        });
        return result;
      } catch (error) {
        return mapCommitError(error, plan);
      } finally {
        await session.endSession();
      }
    },
    async createIndexes() {
      await Promise.all([
        createConfiguredIndexes(
          submissions,
          [
            { key: { formId: 1, submittedAt: 1, _id: 1 }, name: "form_responses_form_submitted_at_id" },
            { key: { "submission.locale": 1 }, name: "form_responses_locale" }
          ],
          options.customIndexes?.formResponses
        ),
        createConfiguredIndexes(
          versions,
          [
            { key: { formId: 1, version: 1 }, name: "unique_version_per_form", unique: true },
            {
              key: { formId: 1 },
              name: "unique_draft_per_form",
              unique: true,
              partialFilterExpression: { status: "draft" }
            },
            {
              key: { formId: 1 },
              name: "unique_published_per_form",
              unique: true,
              partialFilterExpression: { status: "published" }
            }
          ],
          options.customIndexes?.formVersions
        ),
        versionEvents.createIndexes([
          { key: { formId: 1, fromRevision: 1, eventIndex: 1 }, name: "form_version_events_revision" }
        ]),
        createConfiguredIndexes(schemas, [], options.customIndexes?.forms)
      ]);
    }
  };
  return {
    ...adapter,
    async fetchPage(formId, options) {
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
  };
}
