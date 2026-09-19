import type {
  FormSchema,
  FormSubmission,
  PagedSubmissionStorageAdapter,
  SaveSubmissionOptions,
  SubmissionSaveResult
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
  isFormValue,
  matchesSubmissionPageFilters,
  normalizeSubmissionPageSize,
  type ValidateFormSchemaOptions
} from "@form-engine-ts/core";

export interface PostgresClientLike {
  readonly transaction?: <T>(operation: (client: PostgresClientLike) => Promise<T>) => Promise<T>;
  query(text: string, params?: unknown[]): Promise<{ readonly rows: readonly unknown[] }>;
}

export interface PostgresStorageOptions {
  readonly schemaValidation?: ValidateFormSchemaOptions;
  readonly lifecycle?: FormLifecycleOptions;
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

function parseSchemaRow(value: unknown, index: number, validation: ValidateFormSchemaOptions = {}): FormSchema {
  if (!isRecord(value)) throw new Error(`Postgres schema row ${index} is invalid.`);
  const row = value as unknown as SchemaRow;
  const schema = parseJson(row.schema_json, `schema row ${index}`);
  try {
    assertValidFormSchema(schema, validation);
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

  function lifecycleBackend(client: PostgresClientLike): FormLifecycleBackend {
    const query = async (sql: string, params: unknown[]): Promise<readonly unknown[]> => {
      return (await client.query(sql, params)).rows;
    };
    const marker = (index: number) => `$${index}`;
    return {
      resources: ["schema", "submission"],
      async list(formId) {
        await ensureReady();
        const records: FormResource[] = [];
        for (const kind of ["schema", "submission"] as const) {
          const table = kind === "schema" ? schemasTable : responsesTable;
          const rows = await query(`SELECT * FROM ${table} WHERE form_id = ${marker(1)}`, [formId]);
          for (const row of rows) {
            if (!isRecord(row)) throw new TypeError("Invalid lifecycle row.");
            const payload = row[kind === "schema" ? "schema_json" : "submission_json"];
            const value = parseJson(payload, "lifecycle");
            const id = kind === "schema" ? JSON.stringify([row.form_id, row.form_version]) : String(row.response_id);
            records.push({ kind, id, value: { row, value } });
          }
        }
        return records;
      },
      async remove(resource) {
        if (!isRecord(resource.value) || !isRecord(resource.value.row))
          throw new TypeError("Invalid lifecycle resource.");
        const row = resource.value.row;
        const schema = resource.kind === "schema";
        const table = schema ? schemasTable : responsesTable;
        const payloadColumn = schema ? "schema_json" : "submission_json";
        const payload = row[payloadColumn];
        const params: unknown[] = schema ? [row.form_id, row.form_version] : [row.response_id, row.form_id];
        const identity = schema
          ? `form_id = ${marker(1)} AND form_version = ${marker(2)}`
          : `response_id = ${marker(1)} AND form_id = ${marker(2)}`;
        params.push(typeof payload === "string" ? payload : JSON.stringify(payload));
        const deleted = await query(
          `DELETE FROM ${table} WHERE ${identity} AND ${payloadColumn} = ${marker(3)}::jsonb RETURNING ${schema ? "form_id" : "response_id"}`,
          params
        );
        if (deleted.length === 0) throw new Error("Deletion revision conflict or record disappeared.");
        return deleted.length;
      },
      ...(client.transaction === undefined
        ? {}
        : {
            transaction: <T>(operation: (backend: FormLifecycleBackend) => Promise<T>) => {
              if (client.transaction === undefined) throw new Error("Transaction unavailable.");
              return client.transaction((operationClient) => operation(lifecycleBackend(operationClient)));
            }
          })
    };
  }
  const lifecycle = createFormLifecycleAdapter(
    lifecycleBackend(options.client),
    options.lifecycle === undefined
      ? {}
      : {
          ...options.lifecycle,
          ...(options.lifecycle.scope === undefined
            ? {}
            : {
                scope: (resource: FormResource) => {
                  if (!isRecord(resource.value)) throw new TypeError("Invalid lifecycle resource.");
                  return options.lifecycle?.scope?.({ ...resource, value: resource.value.value }) ?? {};
                }
              })
        }
  );
  return {
    ...lifecycle,
    async saveSchema(schema) {
      await ensureReady();
      assertValidFormSchema(schema, options.schemaValidation);
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
      return row === undefined ? null : parseSchemaRow(row, 0, options.schemaValidation);
    },
    async listSchemas() {
      await ensureReady();
      const result = await options.client.query(
        `SELECT form_id, form_version, schema_json FROM ${schemasTable} ORDER BY form_id, form_version`
      );
      return result.rows.map((row, index) => parseSchemaRow(row, index, options.schemaValidation));
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
    async saveSubmissionWithinLimit(
      submission: FormSubmission,
      maxResponses: number,
      saveOptions: SaveSubmissionOptions = {}
    ): Promise<undefined | SubmissionSaveResult | { readonly status: "limit_reached" }> {
      if (!Number.isInteger(maxResponses) || maxResponses < 1)
        throw new RangeError("maxResponses must be a positive integer.");
      await ensureReady();
      if (options.client.transaction === undefined)
        throw Object.assign(new Error("PostgreSQL transactions are required for atomic response limits."), {
          code: "transaction_unsupported"
        });
      const stored = parseSubmission(submission, `input "${String(submission?.id)}"`);
      const payloadHash = await hashFormSubmissionPayload(stored);
      return options.client.transaction(async (client) => {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${stored.formId}@${stored.formVersion}`]);
        const existingResult = await client.query(
          `SELECT response_id, form_id, form_version, locale, submitted_at, submission_json
           FROM ${responsesTable} WHERE response_id = $1`,
          [stored.id]
        );
        const existingRow = existingResult.rows[0];
        if (existingRow !== undefined) {
          if (saveOptions.idempotent !== true) throw new Error(`A submission with ID "${stored.id}" already exists.`);
          const existing = parseSubmissionRow(existingRow, 0);
          const existingPayloadHash = await hashFormSubmissionPayload(existing);
          if (existingPayloadHash === payloadHash) return { status: "duplicate", submission: existing, payloadHash };
          return { status: "conflict", submissionId: stored.id, payloadHash, existingPayloadHash };
        }
        const countResult = await client.query(
          `SELECT COUNT(*) AS count FROM ${responsesTable} WHERE form_id = $1 AND form_version = $2`,
          [stored.formId, stored.formVersion]
        );
        const countRow = countResult.rows[0];
        const count = isRecord(countRow) ? Number(countRow.count ?? 0) : 0;
        if (count >= maxResponses) return { status: "limit_reached" };
        await client.query(
          `INSERT INTO ${responsesTable}
            (response_id, form_id, form_version, locale, submitted_at, submission_json)
           VALUES ($1, $2, $3, $4, $5::timestamptz, $6::jsonb)`,
          [stored.id, stored.formId, stored.formVersion, stored.locale, stored.submittedAt, JSON.stringify(stored)]
        );
        if (saveOptions.idempotent === true) return { status: "created", submission: stored, payloadHash };
      });
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
    async countSubmissions(formId, formVersion, queryOptions) {
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
        `SELECT COUNT(*) AS count FROM ${responsesTable} WHERE ${conditions.join(" AND ")}`,
        params
      );
      const row = result.rows[0];
      return typeof row === "object" && row !== null && "count" in row ? Number(row.count) : 0;
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
      const requiresClientFiltering = queryOptions.filter !== undefined || queryOptions.metadataFilters !== undefined;
      if (!requiresClientFiltering) params.push(pageSize + 1);
      const result = await options.client.query(
        `SELECT response_id, form_id, form_version, locale, submitted_at, submission_json
         FROM ${responsesTable} WHERE ${conditions.join(" AND ")}
         ORDER BY submitted_at, response_id${requiresClientFiltering ? "" : ` LIMIT $${params.length}`}`,
        params
      );
      const candidates = result.rows
        .map(parseSubmissionRow)
        .filter((item) => matchesSubmissionPageFilters(item, queryOptions));
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
