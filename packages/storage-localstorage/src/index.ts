import type { FormSchema, FormStorageAdapter, FormSubmission } from "@form-engine/core";
import { assertValidFormSchema } from "@form-engine/core";

export interface StorageLike {
  readonly length: number;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function parseJson(value: string, key: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch (cause) {
    throw new Error(`Stored JSON at "${key}" is invalid.`, { cause });
  }
}

function parseSchema(value: string, key: string): FormSchema {
  const parsed = parseJson(value, key);
  try {
    assertValidFormSchema(parsed);
  } catch (cause) {
    throw new Error(`Stored schema at "${key}" is invalid.`, { cause });
  }
  return parsed;
}

function parseSubmission(value: string, key: string): FormSubmission {
  const parsed = parseJson(value, key);
  if (
    !isRecord(parsed) ||
    typeof parsed.id !== "string" ||
    typeof parsed.formId !== "string" ||
    !Number.isInteger(parsed.formVersion) ||
    typeof parsed.locale !== "string" ||
    typeof parsed.submittedAt !== "string" ||
    !isRecord(parsed.values)
  ) {
    throw new Error(`Stored submission at "${key}" is invalid.`);
  }
  return parsed as unknown as FormSubmission;
}

function encoded(value: string): string {
  return encodeURIComponent(value);
}

export function createLocalStorageAdapter(storagePrefix = "pf_", injectedStorage?: StorageLike): FormStorageAdapter {
  const storage =
    injectedStorage ??
    (typeof globalThis.localStorage === "undefined" ? undefined : (globalThis.localStorage as StorageLike));
  if (storage === undefined) {
    throw new Error("LocalStorage is unavailable. Pass a StorageLike implementation when running outside a browser.");
  }
  const schemaPrefix = `${storagePrefix}schema:`;
  const submissionPrefix = `${storagePrefix}submission:`;
  const schemaKey = (formId: string, formVersion: number) => `${schemaPrefix}${encoded(formId)}:${formVersion}`;
  const submissionKey = (id: string) => `${submissionPrefix}${encoded(id)}`;

  const prefixedKeys = (prefix: string): string[] => {
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    return keys;
  };

  return {
    async saveSchema(schema) {
      assertValidFormSchema(schema);
      storage.setItem(schemaKey(schema.id, schema.version), JSON.stringify(schema));
    },
    async getSchema(formId, formVersion) {
      const key = schemaKey(formId, formVersion);
      const value = storage.getItem(key);
      return value === null ? null : cloneJson(parseSchema(value, key));
    },
    async listSchemas() {
      return prefixedKeys(schemaPrefix)
        .map((key) => {
          const value = storage.getItem(key);
          if (value === null) throw new Error(`Stored schema at "${key}" disappeared during reading.`);
          return parseSchema(value, key);
        })
        .sort((left, right) => left.id.localeCompare(right.id) || left.version - right.version)
        .map(cloneJson);
    },
    async deleteSchema(formId, formVersion) {
      storage.removeItem(schemaKey(formId, formVersion));
    },
    async saveSubmission(submission) {
      const key = submissionKey(submission.id);
      if (storage.getItem(key) !== null) throw new Error(`A submission with ID "${submission.id}" already exists.`);
      storage.setItem(key, JSON.stringify(submission));
    },
    async listSubmissions(formId, formVersion) {
      return prefixedKeys(submissionPrefix)
        .map((key) => {
          const value = storage.getItem(key);
          if (value === null) throw new Error(`Stored submission at "${key}" disappeared during reading.`);
          return parseSubmission(value, key);
        })
        .filter(
          (submission) =>
            submission.formId === formId && (formVersion === undefined || submission.formVersion === formVersion)
        )
        .sort((left, right) => left.submittedAt.localeCompare(right.submittedAt))
        .map(cloneJson);
    },
    async deleteSubmission(submissionId) {
      storage.removeItem(submissionKey(submissionId));
    },
    async clearResponses(formId) {
      const matchingKeys = prefixedKeys(submissionPrefix).filter((key) => {
        const value = storage.getItem(key);
        if (value === null) throw new Error(`Stored submission at "${key}" disappeared during reading.`);
        return parseSubmission(value, key).formId === formId;
      });
      for (const key of matchingKeys) storage.removeItem(key);
    },
    async clear() {
      for (const key of prefixedKeys(storagePrefix)) storage.removeItem(key);
    }
  };
}
