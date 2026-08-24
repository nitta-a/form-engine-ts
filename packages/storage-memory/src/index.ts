import type {
  FormSchema,
  FormSubmission,
  FormValue,
  FormValues,
  PagedSubmissionStorageAdapter
} from "@form-engine-ts/core";
import {
  assertValidFormSchema,
  decodeSubmissionCursor,
  encodeSubmissionCursor,
  normalizeSubmissionPageSize
} from "@form-engine-ts/core";

function cloneValue(value: FormValue): FormValue {
  return Array.isArray(value) ? [...value] : value;
}

function cloneValues(values: FormValues): FormValues {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, cloneValue(value)]));
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneSubmission(submission: FormSubmission): FormSubmission {
  return {
    ...submission,
    values: cloneValues(submission.values),
    ...(submission.metadata === undefined ? {} : { metadata: cloneJson(submission.metadata) }),
    ...(submission.translationMetadata === undefined
      ? {}
      : { translationMetadata: cloneJson(submission.translationMetadata) })
  };
}

function cloneSchema(schema: FormSchema): FormSchema {
  return cloneJson(schema);
}

function schemaKey(formId: string, formVersion: number): string {
  return `${formId}@${formVersion}`;
}

export function createMemoryStorageAdapter(): PagedSubmissionStorageAdapter {
  const submissions = new Map<string, FormSubmission>();
  const schemas = new Map<string, FormSchema>();

  return {
    async saveSchema(schema) {
      assertValidFormSchema(schema);
      schemas.set(schemaKey(schema.id, schema.version), cloneSchema(schema));
    },
    async getSchema(formId, formVersion) {
      const schema = schemas.get(schemaKey(formId, formVersion));
      return schema === undefined ? null : cloneSchema(schema);
    },
    async listSchemas() {
      return [...schemas.values()]
        .sort((left, right) => left.id.localeCompare(right.id) || left.version - right.version)
        .map(cloneSchema);
    },
    async deleteSchema(formId, formVersion) {
      schemas.delete(schemaKey(formId, formVersion));
    },
    async saveSubmission(submission) {
      if (submissions.has(submission.id)) throw new Error(`A submission with ID "${submission.id}" already exists.`);
      submissions.set(submission.id, cloneSubmission(submission));
    },
    async listSubmissions(formId, formVersion, options) {
      return [...submissions.values()]
        .filter(
          (submission) =>
            submission.formId === formId &&
            (formVersion === undefined || submission.formVersion === formVersion) &&
            (options?.since === undefined || submission.submittedAt >= options.since) &&
            (options?.until === undefined || submission.submittedAt <= options.until)
        )
        .sort((left, right) => left.submittedAt.localeCompare(right.submittedAt) || left.id.localeCompare(right.id))
        .map(cloneSubmission);
    },
    async listSubmissionPage(formId, options = {}) {
      const pageSize = normalizeSubmissionPageSize(options.pageSize);
      const cursor = options.cursor === undefined ? undefined : decodeSubmissionCursor(options.cursor);
      const candidates = [...submissions.values()]
        .filter(
          (submission) =>
            submission.formId === formId &&
            (options.version === undefined || submission.formVersion === options.version) &&
            (options.since === undefined || submission.submittedAt >= options.since) &&
            (options.until === undefined || submission.submittedAt <= options.until) &&
            (options.locale === undefined || submission.locale === options.locale) &&
            (cursor === undefined ||
              submission.submittedAt > cursor.submittedAt ||
              (submission.submittedAt === cursor.submittedAt && submission.id > cursor.responseId))
        )
        .sort((left, right) => left.submittedAt.localeCompare(right.submittedAt) || left.id.localeCompare(right.id));
      const hasMore = candidates.length > pageSize;
      const items = candidates.slice(0, pageSize).map(cloneSubmission);
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
      submissions.delete(submissionId);
    },
    async clearResponses(formId) {
      for (const [submissionId, submission] of submissions) {
        if (submission.formId === formId) submissions.delete(submissionId);
      }
    },
    async clear() {
      schemas.clear();
      submissions.clear();
    }
  };
}
