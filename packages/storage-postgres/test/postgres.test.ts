import type { FormSchema, FormSubmission } from "@form-engine-ts/core";
import type { Pool } from "pg";
import { createPostgresStorage, type PostgresClientLike } from "../src";

const schema: FormSchema = {
  id: "form",
  version: 2,
  title: "title",
  defaultLocale: "en",
  supportedLocales: ["en", "ja"],
  metadata: { owner: "ARGS" },
  translationMetadata: { ja: { title: { provider: "machine" } } },
  fields: [{ id: "answer", type: "text", title: "answer", required: false, metadata: { source: "api" } }]
};

function submission(id = "response", submittedAt = "2025-01-02T00:00:00.000Z"): FormSubmission {
  return {
    id,
    formId: "form",
    formVersion: 2,
    locale: "en",
    submittedAt,
    values: { answer: "yes" },
    metadata: { channel: "ARGS" },
    translationMetadata: { ja: { title: { provider: "human" } } }
  };
}

function clientWithRows(...rows: readonly unknown[][]) {
  const queue = [...rows];
  const query = vi.fn(async (_text: string, _params?: unknown[]) => ({ rows: queue.shift() ?? [] }));
  return { client: { query } as PostgresClientLike, query };
}

describe("createPostgresStorage", () => {
  it("accepts the node-postgres Pool query shape", () => {
    expectTypeOf<Pool["query"]>().toMatchTypeOf<PostgresClientLike["query"]>();
  });

  it("upserts schemas with bound JSONB parameters", async () => {
    const { client, query } = clientWithRows([]);
    const storage = createPostgresStorage({ client });
    await storage.saveSchema(schema);
    expect(query).toHaveBeenCalledOnce();
    expect(query.mock.calls[0]?.[0]).toMatch(/ON CONFLICT \(form_id, form_version\) DO UPDATE/);
    expect(query.mock.calls[0]?.[1]).toEqual(["form", 2, JSON.stringify(schema)]);
  });

  it("reads versioned schemas, preserves ordering SQL, and returns defensive copies", async () => {
    const row = { form_id: "form", form_version: 2, schema_json: schema };
    const { client, query } = clientWithRows([row], [row]);
    const storage = createPostgresStorage({ client });
    const loaded = await storage.getSchema("form", 2);
    expect(loaded).toEqual(schema);
    if (loaded === null) throw new Error("Expected schema");
    (loaded.fields[0] as { title: string }).title = "mutated";
    expect(row.schema_json.fields[0]?.title).toBe("answer");
    expect(await storage.listSchemas()).toEqual([schema]);
    expect(query.mock.calls[1]?.[0]).toMatch(/ORDER BY form_id, form_version/);
  });

  it("inserts complete submissions and builds bound inclusive range filters", async () => {
    const stored = submission();
    const row = {
      response_id: stored.id,
      form_id: stored.formId,
      form_version: stored.formVersion,
      locale: stored.locale,
      submitted_at: new Date(stored.submittedAt),
      submission_json: JSON.stringify(stored)
    };
    const { client, query } = clientWithRows([], [row]);
    const storage = createPostgresStorage({ client });
    await storage.saveSubmission(stored);
    expect(query.mock.calls[0]?.[1]).toEqual([
      "response",
      "form",
      2,
      "en",
      "2025-01-02T00:00:00.000Z",
      JSON.stringify(stored)
    ]);
    await expect(
      storage.listSubmissions("form", 2, {
        since: "2025-01-01T00:00:00.000Z",
        until: "2025-01-03T00:00:00.000Z"
      })
    ).resolves.toEqual([stored]);
    expect(query.mock.calls[1]?.[0]).toMatch(/form_version = \$2.*submitted_at >= \$3.*submitted_at <= \$4/s);
    expect(query.mock.calls[1]?.[1]).toEqual(["form", 2, "2025-01-01T00:00:00.000Z", "2025-01-03T00:00:00.000Z"]);
  });

  it("runs lazy migration exactly once and uses customized safe identifiers", async () => {
    const { client, query } = clientWithRows([], [], []);
    const storage = createPostgresStorage({
      client,
      schemasTable: "custom_schemas",
      responsesTable: "custom_responses",
      autoMigrate: true
    });
    await storage.getSchema("form", 1);
    await storage.deleteSchema("form", 1);
    expect(query.mock.calls[0]?.[0]).toMatch(/CREATE TABLE IF NOT EXISTS "custom_schemas"/);
    expect(query.mock.calls.filter(([sql]) => String(sql).includes("CREATE TABLE IF NOT EXISTS"))).toHaveLength(1);
  });

  it("deletes only requested data and propagates database failures", async () => {
    const query = vi.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.includes("INSERT INTO")) throw new Error("duplicate key");
      return { rows: [] };
    });
    const storage = createPostgresStorage({ client: { query } });
    await expect(storage.saveSubmission(submission())).rejects.toThrow(/duplicate key/);
    await storage.clearResponses?.("form");
    await storage.clear();
    expect(
      query.mock.calls.some(([sql, params]) => String(sql).includes("WHERE form_id = $1") && params?.[0] === "form")
    ).toBe(true);
    expect(query.mock.calls.filter(([sql]) => String(sql).startsWith("DELETE FROM"))).toHaveLength(3);
  });

  it("rejects unsafe identifiers and corrupt stored payloads", async () => {
    const { client } = clientWithRows([]);
    expect(() => createPostgresStorage({ client, schemasTable: "schemas; DROP TABLE forms" })).toThrow(TypeError);
    const corrupt = clientWithRows([
      {
        response_id: "response",
        form_id: "wrong",
        form_version: 2,
        locale: "en",
        submitted_at: "2025-01-02T00:00:00.000Z",
        submission_json: submission()
      }
    ]);
    await expect(createPostgresStorage({ client: corrupt.client }).listSubmissions("form")).rejects.toThrow(
      /inconsistent metadata/
    );
  });
});
