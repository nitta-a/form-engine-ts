import type { FormSchema, FormStorageAdapter, FormSubmission, FormValue } from "@form-engine-ts/core";
import { assertValidFormSchema } from "@form-engine-ts/core";

export interface SqliteExecutor {
  run(sql: string, params?: readonly unknown[]): Promise<void> | void;
  get<T>(sql: string, params?: readonly unknown[]): Promise<T | undefined> | T | undefined;
  all<T>(sql: string, params?: readonly unknown[]): Promise<readonly T[]> | readonly T[];
}

export interface SqliteStorageOptions {
  readonly db: SqliteExecutor;
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
    throw new Error(`SQLite JSON at ${location} is invalid.`, { cause });
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
    throw new Error(`SQLite submission at ${location} is invalid.`);
  }
  return cloneJson(parsed) as unknown as FormSubmission;
}

function parseSchemaRow(value: unknown, index: number): FormSchema {
  if (!isRecord(value)) throw new Error(`SQLite schema row ${index} is invalid.`);
  const row = value as unknown as SchemaRow;
  const schema = parseJson(row.schema_json, `schema row ${index}`);
  try {
    assertValidFormSchema(schema);
  } catch (cause) {
    throw new Error(`SQLite schema row ${index} is invalid.`, { cause });
  }
  if (row.form_id !== schema.id || row.form_version !== schema.version) {
    throw new Error(`SQLite schema row ${index} has inconsistent metadata.`);
  }
  return cloneJson(schema);
}

function parseSubmissionRow(value: unknown, index: number): FormSubmission {
  if (!isRecord(value)) throw new Error(`SQLite submission row ${index} is invalid.`);
  const row = value as unknown as SubmissionRow;
  const submission = parseSubmission(row.submission_json, `submission row ${index}`);
  if (
    row.response_id !== submission.id ||
    row.form_id !== submission.formId ||
    row.form_version !== submission.formVersion ||
    row.locale !== submission.locale ||
    row.submitted_at !== submission.submittedAt
  ) {
    throw new Error(`SQLite submission row ${index} has inconsistent metadata.`);
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

export function createSqliteStorage(options: SqliteStorageOptions): FormStorageAdapter {
  if (
    options?.db === undefined ||
    typeof options.db.run !== "function" ||
    typeof options.db.get !== "function" ||
    typeof options.db.all !== "function"
  ) {
    throw new TypeError("db with run, get, and all functions is required.");
  }
  const schemasTable = identifier(options.schemasTable, "form_schemas", "schemasTable");
  const responsesTableName = options.responsesTable ?? "form_responses";
  const responsesTable = identifier(responsesTableName, "form_responses", "responsesTable");
  const responsesIndex = identifier(`${responsesTableName}_lookup_idx`, "form_responses_lookup_idx", "responsesTable");
  let migration: Promise<void> | undefined;

  const ensureReady = async (): Promise<void> => {
    if (options.autoMigrate !== true) return;
    migration ??= (async () => {
      await options.db.run(`CREATE TABLE IF NOT EXISTS ${schemasTable} (
        form_id TEXT NOT NULL,
        form_version INTEGER NOT NULL,
        schema_json TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (form_id, form_version)
      )`);
      await options.db.run(`CREATE TABLE IF NOT EXISTS ${responsesTable} (
        response_id TEXT PRIMARY KEY,
        form_id TEXT NOT NULL,
        form_version INTEGER NOT NULL,
        locale TEXT NOT NULL,
        submitted_at TEXT NOT NULL,
        submission_json TEXT NOT NULL
      )`);
      await options.db.run(
        `CREATE INDEX IF NOT EXISTS ${responsesIndex} ON ${responsesTable} (form_id, submitted_at, response_id)`
      );
    })();
    await migration;
  };

  return {
    async saveSchema(schema) {
      await ensureReady();
      assertValidFormSchema(schema);
      await options.db.run(
        `INSERT INTO ${schemasTable} (form_id, form_version, schema_json, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT (form_id, form_version) DO UPDATE
         SET schema_json = excluded.schema_json, updated_at = CURRENT_TIMESTAMP`,
        [schema.id, schema.version, JSON.stringify(schema)]
      );
    },
    async getSchema(formId, formVersion) {
      await ensureReady();
      const row = await options.db.get<SchemaRow>(
        `SELECT form_id, form_version, schema_json FROM ${schemasTable} WHERE form_id = ? AND form_version = ?`,
        [formId, formVersion]
      );
      return row === undefined ? null : parseSchemaRow(row, 0);
    },
    async listSchemas() {
      await ensureReady();
      const rows = await options.db.all<SchemaRow>(
        `SELECT form_id, form_version, schema_json FROM ${schemasTable} ORDER BY form_id, form_version`
      );
      return rows.map(parseSchemaRow);
    },
    async deleteSchema(formId, formVersion) {
      await ensureReady();
      await options.db.run(`DELETE FROM ${schemasTable} WHERE form_id = ? AND form_version = ?`, [formId, formVersion]);
    },
    async saveSubmission(submission) {
      await ensureReady();
      const stored = parseSubmission(submission, `input "${String(submission?.id)}"`);
      await options.db.run(
        `INSERT INTO ${responsesTable}
          (response_id, form_id, form_version, locale, submitted_at, submission_json)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [stored.id, stored.formId, stored.formVersion, stored.locale, stored.submittedAt, JSON.stringify(stored)]
      );
    },
    async listSubmissions(formId, formVersion, queryOptions) {
      await ensureReady();
      const conditions = ["form_id = ?"];
      const params: unknown[] = [formId];
      if (formVersion !== undefined) {
        conditions.push("form_version = ?");
        params.push(formVersion);
      }
      if (queryOptions?.since !== undefined) {
        conditions.push("submitted_at >= ?");
        params.push(queryOptions.since);
      }
      if (queryOptions?.until !== undefined) {
        conditions.push("submitted_at <= ?");
        params.push(queryOptions.until);
      }
      const rows = await options.db.all<SubmissionRow>(
        `SELECT response_id, form_id, form_version, locale, submitted_at, submission_json
         FROM ${responsesTable} WHERE ${conditions.join(" AND ")} ORDER BY submitted_at, response_id`,
        params
      );
      return rows.map(parseSubmissionRow);
    },
    async deleteSubmission(submissionId) {
      await ensureReady();
      await options.db.run(`DELETE FROM ${responsesTable} WHERE response_id = ?`, [submissionId]);
    },
    async clearResponses(formId) {
      await ensureReady();
      await options.db.run(`DELETE FROM ${responsesTable} WHERE form_id = ?`, [formId]);
    },
    async clear() {
      await ensureReady();
      await options.db.run(`DELETE FROM ${responsesTable}`);
      await options.db.run(`DELETE FROM ${schemasTable}`);
    }
  };
}
