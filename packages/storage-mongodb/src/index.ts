import type { FormSchema, FormStorageAdapter, FormSubmission, FormValue } from "@form-engine/core";
import { assertValidFormSchema } from "@form-engine/core";
import type { Db, Document } from "mongodb";

export interface MongoDbStorageOptions {
  readonly db: Db;
  readonly schemasCollectionName?: string;
  readonly responsesCollectionName?: string;
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

export function createMongoDbStorage(options: MongoDbStorageOptions): FormStorageAdapter {
  if (options?.db === undefined) throw new TypeError("db is required.");
  const schemasCollectionName = collectionName(options.schemasCollectionName, "form_schemas", "schemasCollectionName");
  const responsesCollectionName = collectionName(
    options.responsesCollectionName,
    "form_responses",
    "responsesCollectionName"
  );
  const schemas = options.db.collection<StoredSchemaDocument>(schemasCollectionName);
  const submissions = options.db.collection<StoredSubmissionDocument>(responsesCollectionName);

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
    async listSubmissions(formId, formVersion) {
      const documents = await submissions
        .find({ formId, ...(formVersion === undefined ? {} : { formVersion }) })
        .toArray();
      return documents
        .map(parseSubmissionDocument)
        .sort((left, right) => left.submittedAt.localeCompare(right.submittedAt) || left.id.localeCompare(right.id));
    },
    async deleteSubmission(submissionId) {
      await submissions.deleteOne({ _id: submissionId });
    },
    async clearResponses(formId) {
      await submissions.deleteMany({ formId });
    },
    async clear() {
      await Promise.all([schemas.deleteMany({}), submissions.deleteMany({})]);
    }
  };
}
