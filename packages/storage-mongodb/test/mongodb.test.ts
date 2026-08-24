import {
  createCloneTransitionPlan,
  createDeleteDraftTransitionPlan,
  type FormSchema,
  type FormSubmission,
  type FormVersionRecord,
  type VersionTransitionPlan
} from "@form-engine-ts/core";
import type { Db } from "mongodb";
import { createMongoDbStorage } from "../src";

type TestDocument = Record<string, unknown> & { _id: string };

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function property(document: TestDocument, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => {
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined;
  }, document);
}

function matches(document: TestDocument, filter: Record<string, unknown>): boolean {
  return Object.entries(filter).every(([key, value]) => {
    if (key === "$and") {
      return (
        Array.isArray(value) && value.every((candidate) => matches(document, candidate as Record<string, unknown>))
      );
    }
    if (key === "$or") {
      return Array.isArray(value) && value.some((candidate) => matches(document, candidate as Record<string, unknown>));
    }
    const actual = property(document, key);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return actual === value;
    const operators = value as Record<string, unknown>;
    const minimum = operators.$gte;
    const maximum = operators.$lte;
    const greaterThan = operators.$gt;
    const included = operators.$in;
    const exists = operators.$exists;
    const expectedType = operators.$type;
    const comparable = (left: unknown, right: unknown, comparison: (result: number) => boolean) => {
      if (typeof left === "number" && typeof right === "number") return comparison(left - right);
      if (typeof left === "string" && typeof right === "string") return comparison(left.localeCompare(right));
      return false;
    };
    return (
      (minimum === undefined || comparable(actual, minimum, (result) => result >= 0)) &&
      (maximum === undefined || comparable(actual, maximum, (result) => result <= 0)) &&
      (greaterThan === undefined || comparable(actual, greaterThan, (result) => result > 0)) &&
      (included === undefined || (Array.isArray(included) && included.includes(actual))) &&
      (exists === undefined || (actual !== undefined) === exists) &&
      (expectedType === undefined || (expectedType === "string" && typeof actual === "string"))
    );
  });
}

function createDbStub(options: { readonly transactionSupported?: boolean } = {}) {
  const collections = new Map<string, Map<string, TestDocument>>();
  const indexes = new Map<
    string,
    Array<{
      key: Record<string, number>;
      unique?: boolean;
      partialFilterExpression?: Record<string, unknown>;
      name?: string;
    }>
  >();
  const collection = (name: string) => {
    const documents = collections.get(name) ?? new Map<string, TestDocument>();
    collections.set(name, documents);
    const assertUnique = (candidate: TestDocument, excludingId?: string) => {
      for (const index of indexes.get(name) ?? []) {
        if (index.unique !== true) continue;
        if (index.partialFilterExpression !== undefined && !matches(candidate, index.partialFilterExpression)) continue;
        const duplicate = [...documents.values()].find(
          (document) =>
            document._id !== excludingId &&
            (index.partialFilterExpression === undefined || matches(document, index.partialFilterExpression)) &&
            Object.keys(index.key).every((key) => property(document, key) === property(candidate, key))
        );
        if (duplicate !== undefined) {
          throw Object.assign(new Error(`E11000 duplicate key for index ${index.name ?? "unnamed"}`), { code: 11000 });
        }
      }
    };
    return {
      async updateOne(filter: Record<string, unknown>, update: Record<string, unknown>, options: { upsert?: boolean }) {
        const existing = [...documents.values()].find((document) => matches(document, filter));
        const changes = (update.$set ?? {}) as Record<string, unknown>;
        if (existing !== undefined) {
          const next = clone({ ...existing, ...changes });
          for (const key of Object.keys((update.$unset ?? {}) as Record<string, unknown>)) delete next[key];
          assertUnique(next, existing._id);
          documents.set(existing._id, next);
          return { matchedCount: 1, upsertedCount: 0 };
        } else if (options.upsert) {
          const next = clone({ ...filter, ...changes }) as TestDocument;
          if (documents.has(next._id)) {
            throw Object.assign(new Error(`E11000 duplicate key: ${next._id}`), { code: 11000 });
          }
          assertUnique(next);
          documents.set(next._id, next);
          return { matchedCount: 0, upsertedCount: 1 };
        }
        return { matchedCount: 0, upsertedCount: 0 };
      },
      async findOne(filter: Record<string, unknown>) {
        const found = [...documents.values()].find((document) => matches(document, filter));
        return found === undefined ? null : clone(found);
      },
      find(filter: Record<string, unknown>) {
        const result = {
          sort(specification: Record<string, 1 | -1>) {
            const entries = Object.entries(specification);
            const sorted = [...documents.values()]
              .filter((document) => matches(document, filter))
              .sort((left, right) => {
                for (const [key, direction] of entries) {
                  const leftValue = String(property(left, key));
                  const rightValue = String(property(right, key));
                  const compared = leftValue.localeCompare(rightValue) * direction;
                  if (compared !== 0) return compared;
                }
                return 0;
              });
            const sortedResult = {
              async toArray() {
                return sorted.map(clone);
              },
              limit(count: number) {
                return {
                  async toArray() {
                    return sorted.slice(0, count).map(clone);
                  }
                };
              }
            };
            return sortedResult;
          },
          async toArray() {
            return [...documents.values()].filter((document) => matches(document, filter)).map(clone);
          }
        };
        return result;
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
        assertUnique(document);
        documents.set(document._id, clone(document));
      },
      async countDocuments(filter: Record<string, unknown>) {
        return [...documents.values()].filter((document) => matches(document, filter)).length;
      },
      async createIndexes(
        specifications: Array<{
          key: Record<string, number>;
          unique?: boolean;
          partialFilterExpression?: Record<string, unknown>;
          name?: string;
        }>
      ) {
        indexes.set(name, clone(specifications));
      }
    };
  };
  const client = {
    startSession() {
      return {
        async withTransaction(callback: () => Promise<unknown>) {
          if (options.transactionSupported === false) {
            throw Object.assign(new Error("Transaction numbers are only allowed on a replica set member or mongos"), {
              code: 20
            });
          }
          await callback();
        },
        async endSession() {}
      };
    }
  };
  return { db: { collection, client } as unknown as Db, collections, indexes };
}

function schema(id = "form", version = 1, title = "title"): FormSchema {
  return {
    id,
    version,
    title,
    defaultLocale: "en",
    supportedLocales: ["en", "ja"],
    metadata: { owner: "ARGS" },
    translationMetadata: { ja: { title: { provider: "machine" } } },
    fields: [{ id: "answer", type: "text", title: "answer", required: false, metadata: { source: "api" } }]
  };
}

function submission(id: string, formId = "form", version = 1, submittedAt = "2025-01-01"): FormSubmission {
  return {
    id,
    formId,
    formVersion: version,
    locale: "en",
    submittedAt,
    values: { answer: "yes" },
    metadata: { channel: "ARGS" },
    translationMetadata: { ja: { title: { provider: "human" } } }
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

  it("filters inclusive submittedAt ranges in MongoDB and composes them with versions", async () => {
    const { db } = createDbStub();
    const adapter = createMongoDbStorage({ db });
    await adapter.saveSubmission(submission("z", "form", 1, "2025-01-02T00:00:00.000Z"));
    await adapter.saveSubmission(submission("a", "form", 1, "2025-01-02T00:00:00.000Z"));
    await adapter.saveSubmission(submission("early", "form", 1, "2025-01-01T00:00:00.000Z"));
    await adapter.saveSubmission(submission("late", "form", 2, "2025-01-03T00:00:00.000Z"));
    expect(
      (
        await adapter.listSubmissions("form", 1, {
          since: "2025-01-02T00:00:00.000Z",
          until: "2025-01-02T00:00:00.000Z"
        })
      ).map(({ id }) => id)
    ).toEqual(["a", "z"]);
  });

  it("creates the form/timestamp and locale indexes", async () => {
    const { db, indexes } = createDbStub();
    const adapter = createMongoDbStorage({ db });
    await adapter.createIndexes();
    expect(indexes.get("form_responses")).toEqual([
      { key: { formId: 1, submittedAt: 1, _id: 1 }, name: "form_responses_form_submitted_at_id" },
      { key: { "submission.locale": 1 }, name: "form_responses_locale" }
    ]);
    expect(indexes.get("form_versions")).toEqual([
      { key: { formId: 1, version: 1 }, name: "unique_version_per_form", unique: true },
      {
        key: { formId: 1 },
        name: "unique_draft_per_form",
        unique: true,
        partialFilterExpression: { status: "draft" }
      },
      {
        key: { formId: 1 },
        name: "unique_published_per_form",
        unique: true,
        partialFilterExpression: { status: "published" }
      }
    ]);
  });

  it("rejects a second published version while allowing multiple archived versions", async () => {
    const { db } = createDbStub();
    const adapter = createMongoDbStorage({ db });
    await adapter.createIndexes();
    const versionRecord = (version: number, status: "published" | "archived"): FormVersionRecord => ({
      formId: "form",
      version,
      status,
      schema: schema("form", version),
      revision: 1,
      createdAt: "2026-08-25T00:00:00.000Z"
    });
    const plan = (expectedRevision: number, record: FormVersionRecord): VersionTransitionPlan => ({
      formId: "form",
      expectedRevision,
      nextRevision: expectedRevision + 1,
      publishedRecordToSave: record,
      archivedRecordsToSave: [],
      events: [],
      nextVersion: record.version + 1,
      timestamp: "2026-08-25T00:00:00.000Z"
    });
    expect(await adapter.commitVersionTransition(plan(0, versionRecord(1, "published")))).toEqual({
      success: true,
      value: { success: true }
    });
    const duplicate = await adapter.commitVersionTransition(plan(1, versionRecord(2, "published")));
    expect(duplicate).toMatchObject({ success: false, error: { type: "revision_conflict" } });

    const archivedPlan: VersionTransitionPlan = {
      formId: "archive-form",
      expectedRevision: 0,
      nextRevision: 1,
      archivedRecordsToSave: [versionRecord(3, "archived"), versionRecord(4, "archived")].map((record) => ({
        ...record,
        formId: "archive-form",
        schema: schema("archive-form", record.version)
      })),
      events: [],
      nextVersion: 5,
      timestamp: "2026-08-25T00:00:00.000Z"
    };
    expect(await adapter.commitVersionTransition(archivedPlan)).toEqual({ success: true, value: { success: true } });
    expect(await adapter.listVersionRecords("archive-form")).toHaveLength(2);
  });

  it("maps the draft partial-index violation to draft_already_exists", async () => {
    const { db } = createDbStub();
    const adapter = createMongoDbStorage({ db });
    await adapter.createIndexes();
    const draftRecord = (version: number): FormVersionRecord => ({
      formId: "draft-form",
      version,
      status: "draft",
      schema: schema("draft-form", version),
      revision: 1,
      createdAt: "2026-08-25T00:00:00.000Z"
    });
    const plan = (expectedRevision: number, version: number): VersionTransitionPlan => ({
      formId: "draft-form",
      expectedRevision,
      nextRevision: expectedRevision + 1,
      draftToCreate: draftRecord(version),
      events: [],
      nextVersion: version + 1,
      timestamp: "2026-08-25T00:00:00.000Z"
    });
    expect(await adapter.commitVersionTransition(plan(0, 1))).toEqual({
      success: true,
      value: { success: true }
    });
    expect(await adapter.commitVersionTransition(plan(1, 2))).toEqual({
      success: false,
      error: { type: "draft_already_exists", currentDraftVersion: 1 }
    });
  });

  it("archives the old published record before saving its replacement", async () => {
    const { db } = createDbStub();
    const adapter = createMongoDbStorage({ db });
    await adapter.createIndexes();
    const oldPublished: FormVersionRecord = {
      formId: "replace-form",
      version: 1,
      status: "published",
      schema: schema("replace-form", 1),
      revision: 1,
      createdAt: "2026-08-24T00:00:00.000Z"
    };
    expect(
      await adapter.commitVersionTransition({
        formId: "replace-form",
        expectedRevision: 0,
        nextRevision: 1,
        publishedRecordToSave: oldPublished,
        events: [],
        nextVersion: 2,
        timestamp: "2026-08-24T00:00:00.000Z"
      })
    ).toEqual({ success: true, value: { success: true } });
    const archived = {
      ...oldPublished,
      status: "archived" as const,
      revision: 2,
      archivedAt: "2026-08-25T00:00:00.000Z"
    };
    const replacement: FormVersionRecord = {
      ...oldPublished,
      version: 2,
      schema: schema("replace-form", 2),
      revision: 1,
      createdFromVersion: 1,
      createdAt: "2026-08-25T00:00:00.000Z"
    };
    expect(
      await adapter.commitVersionTransition({
        formId: "replace-form",
        expectedRevision: 1,
        nextRevision: 2,
        publishedRecordToSave: replacement,
        archivedRecordsToSave: [archived],
        events: [],
        nextVersion: 3,
        timestamp: "2026-08-25T00:00:00.000Z"
      })
    ).toEqual({ success: true, value: { success: true } });
    expect(await adapter.listVersionRecords("replace-form")).toEqual([archived, replacement]);
  });

  it("fails before writes when transactions are unsupported", async () => {
    const { db, collections } = createDbStub({ transactionSupported: false });
    const adapter = createMongoDbStorage({ db });
    const record: FormVersionRecord = {
      formId: "standalone",
      version: 1,
      status: "draft",
      schema: schema("standalone", 1),
      revision: 1,
      createdAt: "2026-08-25T00:00:00.000Z"
    };
    const result = await adapter.commitVersionTransition({
      formId: "standalone",
      expectedRevision: 0,
      nextRevision: 1,
      draftToCreate: record,
      events: [],
      nextVersion: 2,
      timestamp: "2026-08-25T00:00:00.000Z"
    });
    expect(result).toEqual({ success: false, error: { type: "transaction_unsupported" } });
    expect(collections.get("form_version_states")?.size).toBe(0);
    expect(collections.get("form_versions")?.size).toBe(0);
  });

  it("allows only one concurrent version transition for the same expected revision", async () => {
    const { db, collections } = createDbStub();
    const adapter = createMongoDbStorage({ db });
    const record: FormVersionRecord = {
      formId: "form",
      version: 2,
      status: "published",
      schema: schema("form", 2),
      revision: 2,
      createdFromVersion: 1,
      createdAt: "2026-08-24T00:00:00.000Z",
      publishedAt: "2026-08-24T01:00:00.000Z"
    };
    const plan: VersionTransitionPlan = {
      formId: "form",
      expectedRevision: 0,
      nextRevision: 1,
      draftToDeleteVersion: 2,
      publishedRecordToSave: record,
      archivedRecordsToSave: [],
      events: [
        {
          type: "version.published",
          formId: "form",
          fromRevision: 0,
          toRevision: 1,
          affectedVersions: [2],
          occurredAt: "2026-08-24T01:00:00.000Z"
        }
      ],
      nextVersion: 3,
      timestamp: "2026-08-24T01:00:00.000Z"
    };
    const results = await Promise.all([adapter.commitVersionTransition(plan), adapter.commitVersionTransition(plan)]);
    expect(results).toContainEqual({ success: true, value: { success: true } });
    expect(results).toContainEqual({
      success: false,
      error: { type: "revision_conflict", expectedRevision: 0, actualRevision: 1 }
    });
    expect(collections.get("form_version_states")?.get("form")?.revision).toBe(1);
    expect(collections.get("form_versions")?.get("version:form:2")?.record).toEqual(record);
    expect(await adapter.getVersionState("form")).toEqual({
      formId: "form",
      revision: 1,
      nextVersion: 3,
      publishedVersion: 2
    });
    expect(await adapter.getVersionRecord("form", 2)).toEqual(record);
    expect(await adapter.listVersionRecords("form")).toEqual([record]);
    expect(collections.get("form_version_events")?.size).toBe(1);
  });

  it("returns a typed storage conflict for a stale delete plan after cloning", async () => {
    const { db } = createDbStub();
    const adapter = createMongoDbStorage({ db });
    const sourceRecord: FormVersionRecord = {
      formId: "form",
      version: 1,
      status: "published",
      schema: schema("form", 1),
      revision: 1,
      createdAt: "2026-08-25T00:00:00.000Z",
      publishedAt: "2026-08-25T00:00:00.000Z"
    };
    const clone = createCloneTransitionPlan(
      { formId: "form", revision: 0, nextVersion: 2, publishedVersion: 1 },
      sourceRecord,
      { expectedRevision: 0, clonedAt: "2026-08-25T01:00:00.000Z" }
    );
    if (!clone.success || clone.value.plan.draftToCreate === undefined) throw new Error("Expected a clone plan");
    expect(await adapter.commitVersionTransition(clone.value.plan)).toEqual({
      success: true,
      value: { success: true }
    });

    const staleDelete = createDeleteDraftTransitionPlan(
      { ...clone.value.nextState, revision: 0 },
      clone.value.plan.draftToCreate,
      { expectedRevision: 0, deletedAt: "2026-08-25T02:00:00.000Z" }
    );
    if (!staleDelete.success) throw new Error("Expected a delete plan");
    expect(await adapter.commitVersionTransition(staleDelete.value.plan)).toEqual({
      success: false,
      error: { type: "revision_conflict", expectedRevision: 0, actualRevision: 1 }
    });
  });

  it("pages deterministically across equal timestamps and filters locale", async () => {
    const { db } = createDbStub();
    const adapter = createMongoDbStorage({ db });
    const timestamp = "2025-01-02T00:00:00.000Z";
    await adapter.saveSubmission(submission("c", "form", 1, timestamp));
    await adapter.saveSubmission(submission("a", "form", 1, timestamp));
    await adapter.saveSubmission(submission("b", "form", 1, timestamp));
    const first = await adapter.listSubmissionPage("form", { version: 1, locale: "en", pageSize: 2 });
    expect(first.items.map((item) => item.id)).toEqual(["a", "b"]);
    expect(first.nextCursor).toBeDefined();
    if (first.nextCursor === undefined) throw new Error("Expected a cursor");
    const second = await adapter.listSubmissionPage("form", { pageSize: 2, cursor: first.nextCursor });
    expect(second).toEqual({ items: [submission("c", "form", 1, timestamp)], hasMore: false });
  });

  it("applies metadata and predicate filters before page sizing", async () => {
    const { db } = createDbStub();
    const adapter = createMongoDbStorage({ db });
    await adapter.saveSubmission({ ...submission("a"), metadata: { channel: "other", tier: 2 } });
    const expected = { ...submission("b"), metadata: { channel: "ARGS", tier: 2 } };
    await adapter.saveSubmission(expected);
    await adapter.saveSubmission({ ...submission("c"), metadata: { channel: "ARGS", tier: 3 } });
    const page = await adapter.listSubmissionPage("form", {
      pageSize: 1,
      metadataFilters: { tier: 2 },
      filter: (item) => item.metadata?.channel === "ARGS"
    });
    expect(page).toEqual({ items: [expected], hasMore: false });
  });

  it("pushes generic filter ASTs into MongoDB and pages free-text answers", async () => {
    const { db } = createDbStub();
    const adapter = createMongoDbStorage({ db });
    await adapter.saveSubmission({ ...submission("a"), values: { answer: "first" }, metadata: { channel: "ARGS" } });
    await adapter.saveSubmission({ ...submission("b"), values: { answer: "second" }, metadata: { channel: "ARGS" } });
    await adapter.saveSubmission({ ...submission("c"), values: { answer: "third" }, metadata: { channel: "other" } });
    const query = {
      pageSize: 1,
      filter: {
        op: "and" as const,
        filters: [
          { op: "eq" as const, path: "metadata.channel", value: "ARGS" },
          { op: "in" as const, path: "values.answer", values: ["first", "second"] }
        ]
      }
    };
    expect((await adapter.listSubmissionPage("form", query)).items.map((item) => item.id)).toEqual(["a"]);
    const first = await adapter.listTextAnswerPage?.("form", "answer", query);
    expect(first?.items).toEqual([
      expect.objectContaining({ responseId: "a", fieldId: "answer", text: "first", metadata: { channel: "ARGS" } })
    ]);
    if (first?.nextCursor === undefined) throw new Error("Expected a text answer cursor.");
    const second = await adapter.listTextAnswerPage?.("form", "answer", { ...query, cursor: first.nextCursor });
    expect(second?.items).toEqual([expect.objectContaining({ responseId: "b", text: "second" })]);
    expect(second?.hasMore).toBe(false);
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
