import type { FormSchema, FormSubmission } from "@form-engine-ts/core";
import type { Db } from "mongodb";
import { createMongoDbStorage } from "../src";

type TestDocument = Record<string, unknown> & { _id: string };

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function matches(document: TestDocument, filter: Record<string, unknown>): boolean {
  return Object.entries(filter).every(([key, value]) => document[key] === value);
}

function createDbStub() {
  const collections = new Map<string, Map<string, TestDocument>>();
  const collection = (name: string) => {
    const documents = collections.get(name) ?? new Map<string, TestDocument>();
    collections.set(name, documents);
    return {
      async updateOne(filter: Record<string, unknown>, update: Record<string, unknown>, options: { upsert?: boolean }) {
        const existing = [...documents.values()].find((document) => matches(document, filter));
        const changes = (update.$set ?? {}) as Record<string, unknown>;
        if (existing !== undefined) {
          documents.set(existing._id, clone({ ...existing, ...changes }));
        } else if (options.upsert) {
          const next = clone({ ...filter, ...changes }) as TestDocument;
          documents.set(next._id, next);
        }
      },
      async findOne(filter: Record<string, unknown>) {
        const found = [...documents.values()].find((document) => matches(document, filter));
        return found === undefined ? null : clone(found);
      },
      find(filter: Record<string, unknown>) {
        return {
          async toArray() {
            return [...documents.values()].filter((document) => matches(document, filter)).map(clone);
          }
        };
      },
      async deleteOne(filter: Record<string, unknown>) {
        const found = [...documents.values()].find((document) => matches(document, filter));
        if (found !== undefined) documents.delete(found._id);
      },
      async deleteMany(filter: Record<string, unknown>) {
        for (const [id, document] of documents) {
          if (matches(document, filter)) documents.delete(id);
        }
      },
      async insertOne(document: TestDocument) {
        if (documents.has(document._id)) throw new Error(`E11000 duplicate key: ${document._id}`);
        documents.set(document._id, clone(document));
      },
      async countDocuments(filter: Record<string, unknown>) {
        return [...documents.values()].filter((document) => matches(document, filter)).length;
      }
    };
  };
  return { db: { collection } as unknown as Db, collections };
}

function schema(id = "form", version = 1, title = "title"): FormSchema {
  return {
    id,
    version,
    title,
    fields: [{ id: "answer", type: "text", title: "answer", required: false }]
  };
}

function submission(id: string, formId = "form", version = 1, submittedAt = "2025-01-01"): FormSubmission {
  return {
    id,
    formId,
    formVersion: version,
    locale: "en",
    submittedAt,
    values: { answer: "yes" }
  };
}

describe("createMongoDbStorage", () => {
  it("supports versioned schema CRUD, replacement, ordering, and defensive copies", async () => {
    const { db } = createDbStub();
    const adapter = createMongoDbStorage({ db });
    await adapter.saveSchema(schema("z-form", 2));
    await adapter.saveSchema(schema("form", 1));
    await adapter.saveSchema(schema("form", 2));
    await adapter.saveSchema(schema("form", 1, "updated"));
    expect(await adapter.getSchema("form", 1)).toEqual(schema("form", 1, "updated"));
    expect((await adapter.listSchemas()).map(({ id, version }) => `${id}@${version}`)).toEqual([
      "form@1",
      "form@2",
      "z-form@2"
    ]);
    const loaded = await adapter.getSchema("form", 1);
    if (loaded === null) throw new Error("Expected schema");
    (loaded.fields[0] as { title: string }).title = "mutated";
    expect((await adapter.getSchema("form", 1))?.fields[0]?.title).toBe("answer");
    await adapter.deleteSchema("form", 1);
    expect(await adapter.getSchema("form", 1)).toBeNull();
  });

  it("supports submission CRUD, filtering, deterministic ordering, and duplicate rejection", async () => {
    const { db } = createDbStub();
    const adapter = createMongoDbStorage({ db });
    await adapter.saveSubmission(submission("later", "form", 1, "2025-01-02"));
    await adapter.saveSubmission(submission("earlier", "form", 1, "2025-01-01"));
    await adapter.saveSubmission(submission("v2", "form", 2, "2025-01-03"));
    await adapter.saveSubmission(submission("other", "other-form"));
    await expect(adapter.saveSubmission(submission("earlier", "other-form"))).rejects.toThrow(/E11000/);
    expect((await adapter.listSubmissions("form", 1)).map(({ id }) => id)).toEqual(["earlier", "later"]);
    expect(await adapter.listSubmissions("form")).toHaveLength(3);
    const loaded = await adapter.listSubmissions("form", 1);
    (loaded[0]?.values as Record<string, string>).answer = "mutated";
    expect((await adapter.listSubmissions("form", 1))[0]?.values.answer).toBe("yes");
    await adapter.deleteSubmission("earlier");
    expect((await adapter.listSubmissions("form", 1)).map(({ id }) => id)).toEqual(["later"]);
  });

  it("clears one form across versions without deleting schemas or other forms", async () => {
    const { db } = createDbStub();
    const adapter = createMongoDbStorage({ db });
    await adapter.saveSchema(schema());
    await adapter.saveSubmission(submission("one", "form", 1));
    await adapter.saveSubmission(submission("two", "form", 2));
    await adapter.saveSubmission(submission("other", "other-form"));
    await adapter.clearResponses?.("form");
    expect(await adapter.listSubmissions("form")).toEqual([]);
    expect(await adapter.listSubmissions("other-form")).toHaveLength(1);
    expect(await adapter.getSchema("form", 1)).toEqual(schema());
  });

  it("uses custom collection names and clear only empties those collections", async () => {
    const { db, collections } = createDbStub();
    const adapter = createMongoDbStorage({
      db,
      schemasCollectionName: "schemas_custom",
      responsesCollectionName: "responses_custom"
    });
    collections.set("unrelated", new Map([["keep", { _id: "keep", value: true }]]));
    await adapter.saveSchema(schema());
    await adapter.saveSubmission(submission("one"));
    await adapter.clear();
    expect(await adapter.listSchemas()).toEqual([]);
    expect(await adapter.listSubmissions("form")).toEqual([]);
    expect(collections.get("unrelated")?.has("keep")).toBe(true);
  });

  it("rejects invalid collection names and corrupt stored data", async () => {
    const { db, collections } = createDbStub();
    expect(() => createMongoDbStorage({ db, schemasCollectionName: " " })).toThrow(TypeError);
    const adapter = createMongoDbStorage({ db });
    await adapter.saveSubmission(submission("corrupt"));
    const document = collections.get("form_responses")?.get("corrupt");
    if (document === undefined) throw new Error("Expected stored response");
    (document.submission as { values: Record<string, unknown> }).values.answer = { invalid: true };
    await expect(adapter.listSubmissions("form")).rejects.toThrow(/invalid/);
  });
});
