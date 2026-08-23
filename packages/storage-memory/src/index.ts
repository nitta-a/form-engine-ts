import type { FormSchema, FormStorageAdapter, FormSubmission, FormValue, FormValues } from "@form-engine/core";
import { assertValidFormSchema } from "@form-engine/core";

function cloneValue(value: FormValue): FormValue {
  return Array.isArray(value) ? [...value] : value;
}

function cloneValues(values: FormValues): FormValues {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, cloneValue(value)]));
}

function cloneSubmission(submission: FormSubmission): FormSubmission {
  return { ...submission, values: cloneValues(submission.values) };
}

function cloneSchema(schema: FormSchema): FormSchema {
  return JSON.parse(JSON.stringify(schema)) as FormSchema;
}

function schemaKey(formId: string, formVersion: number): string {
  return `${formId}@${formVersion}`;
}

export function createMemoryStorageAdapter(): FormStorageAdapter {
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
    async listSubmissions(formId, formVersion) {
      return [...submissions.values()]
        .filter(
          (submission) =>
            submission.formId === formId && (formVersion === undefined || submission.formVersion === formVersion)
        )
        .sort((left, right) => left.submittedAt.localeCompare(right.submittedAt))
        .map(cloneSubmission);
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
