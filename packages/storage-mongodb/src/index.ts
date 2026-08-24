import type {
  FormSchema,
  FormSubmission,
  FormValue,
  FormVersionRecord,
  PagedSubmissionStorageAdapter,
  VersionedFormStorageAdapter,
  VersionTransitionPlan
} from "@form-engine-ts/core";
import {
  assertValidFormSchema,
  decodeSubmissionCursor,
  encodeSubmissionCursor,
  matchesSubmissionPageFilters,
  normalizeSubmissionPageSize
} from "@form-engine-ts/core";
import type { ClientSession, Db, Document, Filter } from "mongodb";

export interface MongoDbStorageOptions {
  readonly db: Db;
  readonly schemasCollectionName?: string;
  readonly responsesCollectionName?: string;
  readonly versionsCollectionName?: string;
  readonly versionStatesCollectionName?: string;
}

export interface MongoDbStorageAdapter extends PagedSubmissionStorageAdapter, VersionedFormStorageAdapter {
  createIndexes(): Promise<void>;
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

function isCasConflict(error: unknown): boolean {
  if (!isRecord(error)) return false;
  if (error.code === 11000 || error.code === 112 || error.code === 251) return true;
  return typeof error.hasErrorLabel === "function" && error.hasErrorLabel("TransientTransactionError") === true;
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

export function createMongoDbStorage(options: MongoDbStorageOptions): MongoDbStorageAdapter {
  if (options?.db === undefined) throw new TypeError("db is required.");
  const schemasCollectionName = collectionName(options.schemasCollectionName, "form_schemas", "schemasCollectionName");
  const responsesCollectionName = collectionName(
    options.responsesCollectionName,
    "form_responses",
    "responsesCollectionName"
  );
  const versionsCollectionName = collectionName(
    options.versionsCollectionName,
    "form_versions",
    "versionsCollectionName"
  );
  const versionStatesCollectionName = collectionName(
    options.versionStatesCollectionName,
    "form_version_states",
    "versionStatesCollectionName"
  );
  const schemas = options.db.collection<StoredSchemaDocument>(schemasCollectionName);
  const submissions = options.db.collection<StoredSubmissionDocument>(responsesCollectionName);
  const versions = options.db.collection<StoredVersionDocument>(versionsCollectionName);
  const versionStates = options.db.collection<StoredVersionStateDocument>(versionStatesCollectionName);

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
  ): Promise<{ readonly success: boolean; readonly error?: string }> => {
    const stateSet: Record<string, unknown> = { revision: plan.nextRevision, updatedAt: plan.timestamp };
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
      return { success: false, error: "revision_conflict" };
    }
    if (plan.draftToDeleteVersion !== undefined) {
      await versions.deleteOne(
        { _id: versionDocumentId(plan.formId, plan.draftToDeleteVersion) },
        session === undefined ? {} : { session }
      );
    }
    if (plan.draftToCreate !== undefined) await upsertVersionRecord(plan.draftToCreate, session);
    if (plan.publishedRecordToSave !== undefined) await upsertVersionRecord(plan.publishedRecordToSave, session);
    for (const record of plan.archivedRecordsToSave ?? []) await upsertVersionRecord(record, session);
    return { success: true };
  };

  return {
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
      const filter: Filter<StoredSubmissionDocument> = {
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
      const sorted = submissions.find(filter).sort({ submittedAt: 1, _id: 1 });
      const requiresClientFiltering = options.filter !== undefined || options.metadataFilters !== undefined;
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
        versionStates.deleteMany({})
      ]);
    },
    async commitVersionTransition(plan) {
      assertTransitionPlan(plan);
      const client = options.db.client;
      if (client === undefined || typeof client.startSession !== "function") {
        try {
          return await applyVersionTransition(plan);
        } catch (error) {
          if (isCasConflict(error)) return { success: false, error: "revision_conflict" };
          throw error;
        }
      }
      const session = client.startSession();
      try {
        let result: { readonly success: boolean; readonly error?: string } = {
          success: false,
          error: "revision_conflict"
        };
        await session.withTransaction(async () => {
          result = await applyVersionTransition(plan, session);
        });
        return result;
      } catch (error) {
        if (isCasConflict(error)) return { success: false, error: "revision_conflict" };
        throw error;
      } finally {
        await session.endSession();
      }
    },
    async createIndexes() {
      await Promise.all([
        submissions.createIndexes([
          { key: { formId: 1, submittedAt: 1, _id: 1 }, name: "form_responses_form_submitted_at_id" },
          { key: { "submission.locale": 1 }, name: "form_responses_locale" }
        ]),
        versions.createIndexes([
          { key: { formId: 1, version: 1 }, name: "form_versions_form_version", unique: true },
          { key: { formId: 1, status: 1 }, name: "form_versions_form_status" }
        ])
      ]);
    }
  };
}
