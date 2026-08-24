import type { FormSchema, FormSubmission } from "@form-engine-ts/core";
import { createD1Storage, type D1DatabaseLike, type D1PreparedStatementLike, type D1ResultLike } from "../src";

const schema: FormSchema = {
  id: "form",
  version: 2,
  title: "title",
  metadata: { owner: "ARGS" },
  translationMetadata: { ja: { title: { provider: "machine" } } },
  fields: [{ id: "answer", type: "text", title: "answer", required: false, metadata: { source: "api" } }]
};

const submission: FormSubmission = {
  id: "response",
  formId: "form",
  formVersion: 2,
  locale: "en",
  submittedAt: "2025-01-02T00:00:00.000Z",
  values: { answer: "yes" },
  metadata: { channel: "ARGS" },
  translationMetadata: { ja: { title: { provider: "human" } } }
};

interface RecordedStatement extends D1PreparedStatementLike {
  readonly sql: string;
  readonly params: readonly unknown[];
}

function createD1Mock(
  options: {
    first?: readonly unknown[];
    all?: readonly D1ResultLike[];
    run?: readonly D1ResultLike[];
    batch?: readonly (readonly D1ResultLike[])[];
  } = {}
) {
  const first = [...(options.first ?? [])];
  const all = [...(options.all ?? [])];
  const run = [...(options.run ?? [])];
  const batch = [...(options.batch ?? [])];
  const calls: Array<{ kind: string; sql?: string; params?: readonly unknown[]; size?: number }> = [];

  const statement = (sql: string, params: readonly unknown[] = []): RecordedStatement => ({
    sql,
    params,
    bind: (...values) => statement(sql, values),
    async first<T>() {
      calls.push({ kind: "first", sql, params });
      return (first.shift() ?? null) as T | null;
    },
    async all<T>() {
      calls.push({ kind: "all", sql, params });
      return (all.shift() ?? { success: true, results: [] }) as D1ResultLike<T>;
    },
    async run<T>() {
      calls.push({ kind: "run", sql, params });
      return (run.shift() ?? { success: true, results: [] }) as D1ResultLike<T>;
    }
  });

  const db = {
    prepare: (sql: string) => statement(sql),
    async batch(statements: readonly D1PreparedStatementLike[]) {
      calls.push({ kind: "batch", size: statements.length });
      return batch.shift() ?? statements.map(() => ({ success: true, results: [] }));
    }
  } satisfies D1DatabaseLike;
  return { db, calls };
}

describe("createD1Storage", () => {
  it("uses prepared statements and bound values for schema CRUD", async () => {
    const row = { form_id: "form", form_version: 2, schema_json: JSON.stringify(schema) };
    const { db, calls } = createD1Mock({ first: [row], all: [{ success: true, results: [row] }] });
    const storage = createD1Storage({ db });
    await storage.saveSchema(schema);
    expect(await storage.getSchema("form", 2)).toEqual(schema);
    expect(await storage.listSchemas()).toEqual([schema]);
    await storage.deleteSchema("form", 2);
    const save = calls.find(({ kind, sql }) => kind === "run" && sql?.includes("INSERT INTO"));
    expect(save?.params).toEqual(["form", 2, JSON.stringify(schema)]);
  });

  it("stores complete submissions and binds inclusive range filters", async () => {
    const row = {
      response_id: "response",
      form_id: "form",
      form_version: 2,
      locale: "en",
      submitted_at: submission.submittedAt,
      submission_json: JSON.stringify(submission)
    };
    const { db, calls } = createD1Mock({ all: [{ success: true, results: [row] }] });
    const storage = createD1Storage({ db });
    await storage.saveSubmission(submission);
    await expect(
      storage.listSubmissions("form", 2, {
        since: "2025-01-01T00:00:00.000Z",
        until: "2025-01-03T00:00:00.000Z"
      })
    ).resolves.toEqual([submission]);
    const list = calls.find(({ kind, sql }) => kind === "all" && sql?.includes("submitted_at >= ?"));
    expect(list?.params).toEqual(["form", 2, "2025-01-01T00:00:00.000Z", "2025-01-03T00:00:00.000Z"]);
  });

  it("runs migration once and clears both tables in transactional batches", async () => {
    const { db, calls } = createD1Mock({ first: [null, null] });
    const storage = createD1Storage({ db, autoMigrate: true });
    await storage.getSchema("form", 1);
    await storage.getSchema("form", 2);
    await storage.clear();
    expect(calls.filter(({ kind }) => kind === "batch").map(({ size }) => size)).toEqual([3, 2]);
  });

  it("rejects unsuccessful and malformed D1 results", async () => {
    const failed = createD1Mock({ run: [{ success: false }] });
    await expect(createD1Storage({ db: failed.db }).saveSubmission(submission)).rejects.toThrow(/statement failed/);

    const missing = createD1Mock({ all: [{ success: true }] });
    await expect(createD1Storage({ db: missing.db }).listSubmissions("form")).rejects.toThrow(/results array/);

    const shortMigration = createD1Mock({ batch: [[{ success: true }]] });
    await expect(createD1Storage({ db: shortMigration.db, autoMigrate: true }).listSchemas()).rejects.toThrow(
      /migration returned 1 results/
    );
  });

  it("retains schemas when clearing one form and rejects unsafe identifiers", async () => {
    const { db, calls } = createD1Mock();
    const storage = createD1Storage({ db });
    await storage.clearResponses?.("form");
    const clear = calls.find(({ kind, sql }) => kind === "run" && sql?.includes("WHERE form_id = ?"));
    expect(clear?.params).toEqual(["form"]);
    expect(() => createD1Storage({ db, schemasTable: "schemas; DROP TABLE forms" })).toThrow(TypeError);
  });
});
