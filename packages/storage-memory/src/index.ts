import type {
  FormSchema,
  FormSubmission,
  FormValue,
  FormValues,
  PagedSubmissionStorageAdapter
} from "@form-engine-ts/core";
import {
  assertValidFormSchema,
  createFormLifecycleAdapter,
  decodeSubmissionCursor,
  encodeSubmissionCursor,
  type FormLifecycleBackend,
  type FormLifecycleOptions,
  type FormResource,
  hashFormSubmissionPayload,
  isRadioTextAnswer,
  matchesSubmissionPageFilters,
  normalizeSubmissionPageSize,
  type ValidateFormSchemaOptions
} from "@form-engine-ts/core";

function cloneValue(value: FormValue): FormValue {
  return Array.isArray(value) ? [...value] : isRadioTextAnswer(value) ? { ...value } : value;
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

export function createMemoryStorageAdapter(
  options: {
    /** @deprecated Use schemaValidation. */
    readonly validation?: ValidateFormSchemaOptions;
    readonly schemaValidation?: ValidateFormSchemaOptions;
    readonly lifecycle?: FormLifecycleOptions;
  } = {}
): PagedSubmissionStorageAdapter {
  const submissions = new Map<string, FormSubmission>();
  const schemas = new Map<string, FormSchema>();
  const schemaValidation = options.schemaValidation ?? options.validation;

  const backend: FormLifecycleBackend = {
    resources: ["schema", "submission"],
    async list(formId) {
      return [
        ...[...schemas]
          .filter(([, value]) => value.id === formId)
          .map(([id, value]): FormResource => ({ kind: "schema", id, value: cloneJson(value) })),
        ...[...submissions]
          .filter(([, value]) => value.formId === formId)
          .map(([id, value]): FormResource => ({ kind: "submission", id, value: cloneJson(value) }))
      ];
    },
    async remove(resource) {
      const map = resource.kind === "schema" ? schemas : submissions;
      if (JSON.stringify(map.get(resource.id)) !== JSON.stringify(resource.value))
        throw new Error("Deletion revision conflict.");
      return map.delete(resource.id) ? 1 : 0;
    },
    async transaction(operation) {
      const originalSchemas = new Map(schemas);
      const originalSubmissions = new Map(submissions);
      const pending: FormResource[] = [];
      const result = await operation({
        ...backend,
        remove: async (resource) => {
          pending.push(resource);
          return 1;
        }
      });
      // ponytail: any concurrent write conflicts; per-form revisions if contention matters.
      if (
        schemas.size !== originalSchemas.size ||
        submissions.size !== originalSubmissions.size ||
        [...originalSchemas].some(([key, value]) => schemas.get(key) !== value) ||
        [...originalSubmissions].some(([key, value]) => submissions.get(key) !== value)
      )
        throw new Error("Deletion revision conflict.");
      // Validate and commit without yielding, so ordinary writes cannot interleave.
      for (const resource of pending) {
        const map = resource.kind === "schema" ? schemas : submissions;
        if (JSON.stringify(map.get(resource.id)) !== JSON.stringify(resource.value))
          throw new Error("Deletion revision conflict.");
      }
      for (const resource of pending) (resource.kind === "schema" ? schemas : submissions).delete(resource.id);
      return result;
    }
  };
  return {
    ...createFormLifecycleAdapter(backend, options.lifecycle),
    async saveSchema(schema) {
      assertValidFormSchema(schema, schemaValidation);
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
    async saveSubmission(submission: FormSubmission) {
      if (submissions.has(submission.id)) throw new Error(`A submission with ID "${submission.id}" already exists.`);
      submissions.set(submission.id, cloneSubmission(submission));
    },
    async saveSubmissionWithinLimit(submission, maxResponses, saveOptions = {}) {
      if (!Number.isInteger(maxResponses) || maxResponses < 1)
        throw new RangeError("maxResponses must be a positive integer.");
      const stored = cloneSubmission(submission);
      const payloadHash = await hashFormSubmissionPayload(stored);
      const existing = submissions.get(submission.id);
      if (existing !== undefined) {
        if (saveOptions.idempotent !== true) throw new Error(`A submission with ID "${submission.id}" already exists.`);
        const existingPayloadHash = await hashFormSubmissionPayload(existing);
        if (existingPayloadHash === payloadHash)
          return { status: "duplicate", submission: cloneSubmission(existing), payloadHash };
        return { status: "conflict", submissionId: stored.id, payloadHash, existingPayloadHash };
      }
      const count = [...submissions.values()].filter(
        (candidate) => candidate.formId === submission.formId && candidate.formVersion === submission.formVersion
      ).length;
      if (count >= maxResponses) return { status: "limit_reached" };
      submissions.set(stored.id, stored);
      if (saveOptions.idempotent === true)
        return { status: "created", submission: cloneSubmission(stored), payloadHash };
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
    async countSubmissions(formId, formVersion, options) {
      return [...submissions.values()].filter(
        (submission) =>
          submission.formId === formId &&
          (formVersion === undefined || submission.formVersion === formVersion) &&
          (options?.since === undefined || submission.submittedAt >= options.since) &&
          (options?.until === undefined || submission.submittedAt <= options.until)
      ).length;
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
              (submission.submittedAt === cursor.submittedAt && submission.id > cursor.responseId)) &&
            matchesSubmissionPageFilters(submission, options)
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
