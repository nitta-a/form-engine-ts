import type { FormSchema, FormSubmission } from "@form-engine-ts/core";
import { createSqliteStorage, type SqliteExecutor } from "../src";

const schema: FormSchema = {
  id: "form",
  version: 2,
  title: "title",
  fields: [{ id: "answer", type: "text", title: "answer", required: false }]
};

const submission: FormSubmission = {
  id: "response",
  formId: "form",
  formVersion: 2,
  locale: "en",
  submittedAt: "2025-01-02T00:00:00.000Z",
  values: { answer: "yes" }
};

function scripted(
  options: { gets?: readonly unknown[]; alls?: readonly (readonly unknown[])[]; asynchronous?: boolean } = {}
) {
  const gets = [...(options.gets ?? [])];
  const alls = [...(options.alls ?? [])];
  const calls: Array<{ kind: string; sql: string; params: readonly unknown[] }> = [];
  const result = <T>(value: T): T | Promise<T> => (options.asynchronous === true ? Promise.resolve(value) : value);
  const db = {
    run(sql: string, params: readonly unknown[] = []) {
      calls.push({ kind: "run", sql, params });
      return result(undefined);
    },
    get<T>(sql: string, params: readonly unknown[] = []) {
      calls.push({ kind: "get", sql, params });
      return result(gets.shift() as T | undefined);
    },
    all<T>(sql: string, params: readonly unknown[] = []) {
      calls.push({ kind: "all", sql, params });
      return result((alls.shift() ?? []) as readonly T[]);
    }
  } satisfies SqliteExecutor;
  return { db, calls };
}

describe("createSqliteStorage", () => {
  it.each([false, true])("supports %s executor results and versioned schema CRUD", async (asynchronous) => {
    const row = { form_id: "form", form_version: 2, schema_json: JSON.stringify(schema) };
    const { db, calls } = scripted({ gets: [row], alls: [[row]], asynchronous });
    const storage = createSqliteStorage({ db });
    await storage.saveSchema(schema);
    expect(await storage.getSchema("form", 2)).toEqual(schema);
    expect(await storage.listSchemas()).toEqual([schema]);
    await storage.deleteSchema("form", 2);
    expect(calls[0]?.sql).toMatch(/ON CONFLICT \(form_id, form_version\) DO UPDATE/);
    expect(calls[0]?.params).toEqual(["form", 2, JSON.stringify(schema)]);
  });

  it("stores complete submissions and composes inclusive range parameters", async () => {
    const row = {
      response_id: "response",
      form_id: "form",
      form_version: 2,
      locale: "en",
      submitted_at: submission.submittedAt,
      submission_json: JSON.stringify(submission)
    };
    const { db, calls } = scripted({ alls: [[row]] });
    const storage = createSqliteStorage({ db });
    await storage.saveSubmission(submission);
    await expect(
      storage.listSubmissions("form", 2, {
        since: "2025-01-01T00:00:00.000Z",
        until: "2025-01-03T00:00:00.000Z"
      })
    ).resolves.toEqual([submission]);
    const list = calls[1];
    expect(list?.sql).toMatch(/form_version = \?.*submitted_at >= \?.*submitted_at <= \?/s);
    expect(list?.params).toEqual(["form", 2, "2025-01-01T00:00:00.000Z", "2025-01-03T00:00:00.000Z"]);
  });

  it("runs lazy migrations once before the first operation", async () => {
    const { db, calls } = scripted({ gets: [undefined, undefined] });
    const storage = createSqliteStorage({ db, autoMigrate: true });
    await storage.getSchema("form", 1);
    await storage.getSchema("form", 2);
    expect(calls.filter(({ sql }) => sql.includes("CREATE TABLE IF NOT EXISTS"))).toHaveLength(2);
    expect(calls.filter(({ sql }) => sql.includes("CREATE INDEX IF NOT EXISTS"))).toHaveLength(1);
  });

  it("clears only rows and propagates executor errors", async () => {
    const calls: string[] = [];
    const db = {
      run(sql: string) {
        calls.push(sql);
        if (sql.includes("INSERT INTO")) throw new Error("constraint failed");
      },
      get: () => undefined,
      all: () => []
    } as SqliteExecutor;
    const storage = createSqliteStorage({ db });
    await expect(storage.saveSubmission(submission)).rejects.toThrow(/constraint failed/);
    await storage.clearResponses?.("form");
    await storage.clear();
    expect(calls.filter((sql) => sql.startsWith("DELETE FROM"))).toHaveLength(3);
    expect(calls.some((sql) => sql.includes("WHERE form_id = ?"))).toBe(true);
  });

  it("rejects unsafe identifiers and corrupt metadata", async () => {
    const { db } = scripted();
    expect(() => createSqliteStorage({ db, responsesTable: "responses; DROP TABLE forms" })).toThrow(TypeError);
    const corrupt = scripted({
      alls: [[{ ...submission, response_id: "response", submission_json: JSON.stringify(submission) }]]
    });
    await expect(createSqliteStorage({ db: corrupt.db }).listSubmissions("form")).rejects.toThrow(/inconsistent/);
  });
});
