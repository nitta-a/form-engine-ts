import type { FormSchema, FormSubmission, FormValue, PagedSubmissionStorageAdapter } from "@form-engine-ts/core";
import {
  assertValidFormSchema,
  decodeSubmissionCursor,
  encodeSubmissionCursor,
  normalizeSubmissionPageSize
} from "@form-engine-ts/core";

export interface PostgresClientLike {
  query(text: string, params?: unknown[]): Promise<{ readonly rows: readonly unknown[] }>;
}

export interface PostgresStorageOptions {
  readonly client: PostgresClientLike;
  readonly schemasTable?: string;
  readonly responsesTable?: string;
  readonly autoMigrate?: boolean;
}

interface SchemaRow {
  readonly form_id: unknown;
  readonly form_version: unknown;
  readonly schema_json: unknown;
}

interface SubmissionRow {
  readonly response_id: unknown;
  readonly form_id: unknown;
  readonly form_version: unknown;
  readonly locale: unknown;
  readonly submitted_at: unknown;
  readonly submission_json: unknown;
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

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function parseJson(value: unknown, location: string): unknown {
  if (typeof value !== "string") return cloneJson(value);
  try {
    return JSON.parse(value) as unknown;
  } catch (cause) {
    throw new Error(`Postgres JSON at ${location} is invalid.`, { cause });
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
    throw new Error(`Postgres submission at ${location} is invalid.`);
  }
  return cloneJson(parsed) as unknown as FormSubmission;
}

function parseSchemaRow(value: unknown, index: number): FormSchema {
  if (!isRecord(value)) throw new Error(`Postgres schema row ${index} is invalid.`);
  const row = value as unknown as SchemaRow;
  const schema = parseJson(row.schema_json, `schema row ${index}`);
  try {
    assertValidFormSchema(schema);
  } catch (cause) {
    throw new Error(`Postgres schema row ${index} is invalid.`, { cause });
  }
  if (row.form_id !== schema.id || row.form_version !== schema.version) {
    throw new Error(`Postgres schema row ${index} has inconsistent metadata.`);
  }
  return cloneJson(schema);
}

function parseSubmissionRow(value: unknown, index: number): FormSubmission {
  if (!isRecord(value)) throw new Error(`Postgres submission row ${index} is invalid.`);
  const row = value as unknown as SubmissionRow;
  const submission = parseSubmission(row.submission_json, `submission row ${index}`);
  const timestamp = row.submitted_at instanceof Date ? row.submitted_at.toISOString() : row.submitted_at;
  if (
    row.response_id !== submission.id ||
    row.form_id !== submission.formId ||
    row.form_version !== submission.formVersion ||
    row.locale !== submission.locale ||
    typeof timestamp !== "string" ||
    Date.parse(timestamp) !== Date.parse(submission.submittedAt)
  ) {
    throw new Error(`Postgres submission row ${index} has inconsistent metadata.`);
  }
  return submission;
}

function identifier(value: string | undefined, fallback: string, optionName: string): string {
  const name = value ?? fallback;
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new TypeError(`${optionName} must be a safe SQL identifier.`);
  }
  return `"${name}"`;
}

export function createPostgresStorage(options: PostgresStorageOptions): PagedSubmissionStorageAdapter {
  if (options?.client === undefined || typeof options.client.query !== "function") {
    throw new TypeError("client with a query function is required.");
  }
  const schemasTable = identifier(options.schemasTable, "form_schemas", "schemasTable");
  const responsesTable = identifier(options.responsesTable, "form_responses", "responsesTable");
  const responsesIndex = identifier(
    `${options.responsesTable ?? "form_responses"}_lookup_idx`,
    "form_responses_lookup_idx",
    "responsesTable"
  );
  let migration: Promise<void> | undefined;

  const ensureReady = async (): Promise<void> => {
    if (options.autoMigrate !== true) return;
    migration ??= options.client
      .query(`
        CREATE TABLE IF NOT EXISTS ${schemasTable} (
          form_id TEXT NOT NULL,
          form_version INTEGER NOT NULL,
          schema_json JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (form_id, form_version)
        );
        CREATE TABLE IF NOT EXISTS ${responsesTable} (
          response_id TEXT PRIMARY KEY,
          form_id TEXT NOT NULL,
          form_version INTEGER NOT NULL,
          locale TEXT NOT NULL,
          submitted_at TIMESTAMPTZ NOT NULL,
          submission_json JSONB NOT NULL
        );
        CREATE INDEX IF NOT EXISTS ${responsesIndex}
          ON ${responsesTable} (form_id, submitted_at, response_id);
      `)
      .then(() => undefined);
    await migration;
  };

  return {
    async saveSchema(schema) {
      await ensureReady();
      assertValidFormSchema(schema);
      await options.client.query(
        `INSERT INTO ${schemasTable} (form_id, form_version, schema_json, updated_at)
         VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (form_id, form_version) DO UPDATE
         SET schema_json = EXCLUDED.schema_json, updated_at = CURRENT_TIMESTAMP`,
        [schema.id, schema.version, JSON.stringify(schema)]
      );
    },
    async getSchema(formId, formVersion) {
      await ensureReady();
      const result = await options.client.query(
        `SELECT form_id, form_version, schema_json FROM ${schemasTable} WHERE form_id = $1 AND form_version = $2`,
        [formId, formVersion]
      );
      const row = result.rows[0];
      return row === undefined ? null : parseSchemaRow(row, 0);
    },
    async listSchemas() {
      await ensureReady();
      const result = await options.client.query(
        `SELECT form_id, form_version, schema_json FROM ${schemasTable} ORDER BY form_id, form_version`
      );
      return result.rows.map(parseSchemaRow);
    },
    async deleteSchema(formId, formVersion) {
      await ensureReady();
      await options.client.query(`DELETE FROM ${schemasTable} WHERE form_id = $1 AND form_version = $2`, [
        formId,
        formVersion
      ]);
    },
    async saveSubmission(submission) {
      await ensureReady();
      const stored = parseSubmission(submission, `input "${String(submission?.id)}"`);
      await options.client.query(
        `INSERT INTO ${responsesTable}
          (response_id, form_id, form_version, locale, submitted_at, submission_json)
         VALUES ($1, $2, $3, $4, $5::timestamptz, $6::jsonb)`,
        [stored.id, stored.formId, stored.formVersion, stored.locale, stored.submittedAt, JSON.stringify(stored)]
      );
    },
    async listSubmissions(formId, formVersion, queryOptions) {
      await ensureReady();
      const conditions = ["form_id = $1"];
      const params: unknown[] = [formId];
      if (formVersion !== undefined) {
        params.push(formVersion);
        conditions.push(`form_version = $${params.length}`);
      }
      if (queryOptions?.since !== undefined) {
        params.push(queryOptions.since);
        conditions.push(`submitted_at >= $${params.length}::timestamptz`);
      }
      if (queryOptions?.until !== undefined) {
        params.push(queryOptions.until);
        conditions.push(`submitted_at <= $${params.length}::timestamptz`);
      }
      const result = await options.client.query(
        `SELECT response_id, form_id, form_version, locale, submitted_at, submission_json
         FROM ${responsesTable} WHERE ${conditions.join(" AND ")} ORDER BY submitted_at, response_id`,
        params
      );
      return result.rows.map(parseSubmissionRow);
    },
    async listSubmissionPage(formId, queryOptions = {}) {
      await ensureReady();
      const pageSize = normalizeSubmissionPageSize(queryOptions.pageSize);
      const cursor = queryOptions.cursor === undefined ? undefined : decodeSubmissionCursor(queryOptions.cursor);
      const conditions = ["form_id = $1"];
      const params: unknown[] = [formId];
      if (queryOptions.version !== undefined) {
        params.push(queryOptions.version);
        conditions.push(`form_version = $${params.length}`);
      }
      if (queryOptions.since !== undefined) {
        params.push(queryOptions.since);
        conditions.push(`submitted_at >= $${params.length}::timestamptz`);
      }
      if (queryOptions.until !== undefined) {
        params.push(queryOptions.until);
        conditions.push(`submitted_at <= $${params.length}::timestamptz`);
      }
      if (queryOptions.locale !== undefined) {
        params.push(queryOptions.locale);
        conditions.push(`locale = $${params.length}`);
      }
      if (cursor !== undefined) {
        params.push(cursor.submittedAt);
        const timestampParameter = params.length;
        params.push(cursor.responseId);
        conditions.push(
          `(submitted_at > $${timestampParameter}::timestamptz OR ` +
            `(submitted_at = $${timestampParameter}::timestamptz AND response_id > $${params.length}))`
        );
      }
      params.push(pageSize + 1);
      const result = await options.client.query(
        `SELECT response_id, form_id, form_version, locale, submitted_at, submission_json
         FROM ${responsesTable} WHERE ${conditions.join(" AND ")}
         ORDER BY submitted_at, response_id LIMIT $${params.length}`,
        params
      );
      const hasMore = result.rows.length > pageSize;
      const items = result.rows.slice(0, pageSize).map(parseSubmissionRow);
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
      await ensureReady();
      await options.client.query(`DELETE FROM ${responsesTable} WHERE response_id = $1`, [submissionId]);
    },
    async clearResponses(formId) {
      await ensureReady();
      await options.client.query(`DELETE FROM ${responsesTable} WHERE form_id = $1`, [formId]);
    },
    async clear() {
      await ensureReady();
      await options.client.query(`DELETE FROM ${responsesTable}`);
      await options.client.query(`DELETE FROM ${schemasTable}`);
    }
  };
}
