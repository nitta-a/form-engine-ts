import type { TableClient } from "@azure/data-tables";
import type { FormSchema, FormSubmission } from "@form-engine-ts/core";
import {
  type AzureTableClientLike,
  type AzureTableEntityCodec,
  type AzureTableEntityPage,
  type AzureTableSubmissionCodec,
  createAzureTableStorage,
  createLegacyArrayAzureTableCodec,
  createLegacyAzureTableCodec
} from "../src";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createClientStub() {
  const entities = new Map<string, Record<string, unknown>>();
  const filters: string[] = [];
  const pageRequests: { readonly maxPageSize?: number; readonly continuationToken?: string }[] = [];
  const key = (partitionKey: string, rowKey: string) => `${partitionKey}\u0000${rowKey}`;
  const client: AzureTableClientLike = {
    async createEntity(entity) {
      const entityKey = key(String(entity.partitionKey), String(entity.rowKey));
      if (entities.has(entityKey)) throw new Error("EntityAlreadyExists");
      entities.set(entityKey, clone(entity));
    },
    async upsertEntity(entity) {
      entities.set(key(String(entity.partitionKey), String(entity.rowKey)), clone(entity));
    },
    async getEntity(partitionKey, rowKey) {
      const entity = entities.get(key(partitionKey, rowKey));
      if (entity === undefined) throw { statusCode: 404 };
      return clone(entity);
    },
    listEntities(options) {
      if (options?.queryOptions?.filter !== undefined) filters.push(options.queryOptions.filter);
      const sorted = [...entities.values()].sort(
        (left, right) =>
          String(left.partitionKey).localeCompare(String(right.partitionKey)) ||
          String(left.rowKey).localeCompare(String(right.rowKey))
      );
      return {
        async *[Symbol.asyncIterator]() {
          for (const entity of sorted) yield clone(entity);
        },
        byPage(settings = {}) {
          return (async function* () {
            pageRequests.push(settings);
            const start = settings.continuationToken === undefined ? 0 : Number(settings.continuationToken);
            const pageSize = settings.maxPageSize ?? sorted.length;
            const end = Math.min(start + pageSize, sorted.length);
            const values = sorted.slice(start, end).map(clone);
            const continuationToken = end < sorted.length ? String(end) : undefined;
            const page: AzureTableEntityPage = Object.assign(values, {
              ...(continuationToken === undefined ? {} : { continuationToken })
            });
            yield page;
          })();
        }
      };
    },
    async deleteEntity(partitionKey, rowKey) {
      entities.delete(key(partitionKey, rowKey));
    }
  };
  return { client, entities, filters, pageRequests };
}

const schema: FormSchema = {
  id: "form",
  version: 2,
  title: "Form",
  fields: [{ id: "answer", type: "text", title: "Answer", required: false }]
};

function submission(id: string, submittedAt = "2026-08-24T00:00:00.000Z"): FormSubmission {
  return {
    id,
    formId: "form",
    formVersion: 2,
    locale: "ja",
    submittedAt,
    values: { answer: id },
    metadata: { channel: "ARGS", cohort: id.endsWith("0") ? "even" : "other" }
  };
}

describe("createAzureTableStorage", () => {
  it("accepts the official Azure TableClient shape", () => {
    expectTypeOf<TableClient>().toMatchTypeOf<AzureTableClientLike>();
  });

  it("stores schemas and submissions with Azure Table partition and row keys", async () => {
    const { client, entities } = createClientStub();
    const storage = createAzureTableStorage({ client });
    await storage.saveSchema(schema);
    await storage.saveSubmission(submission("response"));
    expect(await storage.getSchema("form", 2)).toEqual(schema);
    expect(await storage.listSchemas()).toEqual([schema]);
    expect([...entities.values()]).toContainEqual(
      expect.objectContaining({
        partitionKey: "form",
        rowKey: "2026-08-24T00:00:00.000Z_response",
        kind: "submission"
      })
    );
    await expect(storage.saveSubmission(submission("response"))).rejects.toThrow(/AlreadyExists/);
  });

  it("uses canonical values without answers and returns typed idempotency results", async () => {
    const { client, entities } = createClientStub();
    const storage = createAzureTableStorage<{ channel: string }>({ client, idempotentSubmissions: true });
    const value = { ...submission("idempotent"), metadata: { channel: "ARGS" } };

    const created = await storage.saveSubmission(value);
    const duplicate = await storage.saveSubmission(value);
    const conflict = await storage.saveSubmission({ ...value, values: { answer: "changed" } });

    expect(created?.status).toBe("created");
    expect(duplicate?.status).toBe("duplicate");
    expect(conflict).toEqual(
      expect.objectContaining({
        status: "conflict",
        submissionId: "idempotent",
        existingPayloadHash: expect.any(String)
      })
    );
    expect([...entities.values()].find((entity) => entity.kind === "submission")).not.toHaveProperty("answers");
  });

  it("validates submissions with an injected validator before creating an entity", async () => {
    const { client, entities } = createClientStub();
    const validator = vi.fn((value: FormSubmission) => {
      if (value.values.answer !== "accepted") throw new Error("submission rejected");
    });
    const storage = createAzureTableStorage({ client, submissionValidator: validator });

    await expect(storage.saveSubmission(submission("rejected"))).rejects.toThrow("submission rejected");
    expect(validator).toHaveBeenCalledOnce();
    expect([...entities.values()].filter((entity) => entity.kind === "submission")).toHaveLength(0);
  });

  it("can reject legacy answers entities explicitly", async () => {
    const { client, entities } = createClientStub();
    entities.set("form\u0000legacy", {
      partitionKey: "form",
      rowKey: "legacy",
      answers: "[]",
      answeredAt: "2026-08-24T00:00:00.000Z",
      surveyVersion: 2
    });
    const storage = createAzureTableStorage({ client, rejectLegacyAnswers: true });

    await expect(storage.listSubmissionPage("form")).rejects.toThrow(/legacy answers column is not supported/);
  });

  it("pages equal timestamps without gaps and injects OData filters", async () => {
    const { client, filters, pageRequests } = createClientStub();
    const storage = createAzureTableStorage({ client });
    const expected = Array.from({ length: 501 }, (_, index) => `response-${String(index).padStart(4, "0")}`);
    await Promise.all(expected.map((id) => storage.saveSubmission(submission(id))));
    const first = await storage.listSubmissionPage("form", {
      version: 2,
      locale: "ja",
      since: "2026-08-24T00:00:00.000Z",
      until: "2026-08-24T23:59:59.999Z",
      pageSize: 500
    });
    expect(first.items.map((item) => item.id)).toEqual(expected.slice(0, 500));
    expect(pageRequests).toEqual([{ maxPageSize: 500 }]);
    if (first.nextCursor === undefined) throw new Error("Expected cursor");
    expect(first.nextCursor).toBe("500");
    const second = await storage.listSubmissionPage("form", { cursor: first.nextCursor, pageSize: 500 });
    expect(second.items.map((item) => item.id)).toEqual(expected.slice(500));
    expect(pageRequests).toEqual([{ maxPageSize: 500 }, { maxPageSize: 500, continuationToken: "500" }]);
    expect(filters[0]).toContain("PartitionKey eq 'form'");
    expect(filters[0]).toContain("formVersion eq 2");
    expect(filters[0]).toContain("locale eq 'ja'");
    expect(filters[1]).not.toContain("RowKey");
  });

  it("applies predicates and metadata filters before sizing pages", async () => {
    const { client, filters } = createClientStub();
    const storage = createAzureTableStorage({ client });
    await storage.saveSubmission(submission("item-0"));
    await storage.saveSubmission(submission("item-1"));
    const page = await storage.listSubmissionPage("form", {
      pageSize: 1,
      metadataFilters: { cohort: "even" },
      filter: (item) => item.values.answer === "item-0"
    });
    expect(page).toEqual({ items: [submission("item-0")], hasMore: true, nextCursor: "1" });
    expect(filters[0]).toContain("(cohort eq 'even')");
  });

  it("supports separate table clients, custom codecs, and custom OData conversion", async () => {
    const schemas = createClientStub();
    const submissions = createClientStub();
    const codec: AzureTableEntityCodec<FormSubmission> = {
      createPartitionKey: (item) => `custom:${item.formId}`,
      createPartitionKeyFromFormId: (formId) => `custom:${formId}`,
      createRowKey: (item) => `response:${item.id}`,
      serialize: (item) => ({ customPayload: JSON.stringify(item) }),
      deserialize: (entity) => {
        if (typeof entity.customPayload !== "string") throw new Error("Missing custom payload");
        return JSON.parse(entity.customPayload) as FormSubmission;
      }
    };
    const toODataFilter = vi.fn(() => "deckId eq 'xyz' and isPii eq false");
    const storage = createAzureTableStorage({
      schemasTableClient: schemas.client,
      submissionsTableClient: submissions.client,
      submissionCodec: codec,
      toODataFilter
    });
    await storage.saveSchema(schema);
    const customSubmission = { ...submission("custom"), metadata: { deckId: "xyz", isPii: false } };
    await storage.saveSubmission(customSubmission);
    expect([...schemas.entities.values()]).toHaveLength(1);
    expect([...submissions.entities.values()]).toContainEqual(
      expect.objectContaining({ partitionKey: "custom:form", rowKey: "response:custom" })
    );
    const page = await storage.listSubmissionPage("form", { metadataFilters: { deckId: "xyz", isPii: false } });
    expect(page.items.map((item) => item.id)).toEqual(["custom"]);
    expect(submissions.filters.at(-1)).toContain("PartitionKey eq 'custom:form'");
    expect(submissions.filters.at(-1)).toContain("deckId eq 'xyz' and isPii eq false");
    expect(toODataFilter).toHaveBeenCalledWith({ metadataFilters: { deckId: "xyz", isPii: false } });
  });

  it("round-trips legacy partition/ULID layouts through a resolver and performs a bounded filtered scan", async () => {
    const schemas = createClientStub();
    const responses = createClientStub();
    const codec: AzureTableSubmissionCodec<FormSubmission> = {
      createEntity: (item) => ({ entityType: "legacy-response", body: JSON.stringify(item) }),
      deserialize: (entity) => {
        if (typeof entity.body !== "string") throw new Error("Missing legacy body");
        return JSON.parse(entity.body) as FormSubmission;
      },
      matchesEntity: (entity) => entity.entityType === "legacy-response",
      createPartitionKey: (item) => `${item.formId}_v${item.formVersion}`,
      createPartitionKeyFromQuery: (formId, query) =>
        query.version === undefined ? undefined : `${formId}_v${query.version}`,
      createRowKey: (item) => item.id
    };
    const clientResolver = vi.fn(async () => responses.client);
    const buildSubmissionFilter = vi.fn((formId: string) => `SurveyId eq '${formId}'`);
    const storage = createAzureTableStorage({
      schemasTableClient: schemas.client,
      clientResolver,
      codec,
      buildSubmissionFilter,
      maxScanPages: 3
    });
    for (const [id, accepted] of [
      ["01H00000000000000000000001", false],
      ["01H00000000000000000000002", true],
      ["01H00000000000000000000003", false],
      ["01H00000000000000000000004", true]
    ] as const) {
      await storage.saveSubmission({ ...submission(id), metadata: { accepted } });
    }
    expect([...responses.entities.values()][0]).toEqual(
      expect.objectContaining({
        partitionKey: "form_v2",
        rowKey: "01H00000000000000000000001",
        entityType: "legacy-response"
      })
    );
    expect([...responses.entities.values()][0]).not.toHaveProperty("kind");
    const page = await storage.listSubmissionPage("form", {
      version: 2,
      pageSize: 2,
      filter: { op: "eq", path: "metadata.accepted", value: true }
    });
    expect(page.items.map((item) => item.id)).toEqual(["01H00000000000000000000002", "01H00000000000000000000004"]);
    expect(responses.pageRequests).toHaveLength(3);
    expect(buildSubmissionFilter).toHaveBeenCalledWith("form", expect.objectContaining({ version: 2, pageSize: 2 }));
    expect(clientResolver).toHaveBeenCalledWith(
      expect.objectContaining({ formId: "form", query: expect.objectContaining({ version: 2 }) })
    );
  });

  it("pages individual text answers and resumes inside the same entity", async () => {
    const { client, filters } = createClientStub();
    const storage = createAzureTableStorage({ client, maxScanPages: 2 });
    await storage.saveSubmission({
      ...submission("multi"),
      values: { first: "one", second: "two", third: "three", empty: "" },
      metadata: { deck: "deck-a", pii: false }
    });
    if (storage.listTextAnswerPage === undefined) throw new Error("Expected text answer paging");
    const query = {
      version: 2,
      locale: "ja",
      pageSize: 2,
      fieldIds: ["first", "second", "third", "empty"],
      metadataFilters: { deck: "deck-a" },
      filter: { op: "eq", path: "metadata.pii", value: false } as const
    };
    const first = await storage.listTextAnswerPage("form", query);
    expect(first.items).toEqual([
      expect.objectContaining({
        responseId: "multi",
        fieldId: "first",
        text: "one",
        metadata: { deck: "deck-a", pii: false }
      }),
      expect.objectContaining({
        responseId: "multi",
        fieldId: "second",
        text: "two",
        metadata: { deck: "deck-a", pii: false }
      })
    ]);
    expect(first.hasMore).toBe(true);
    if (first.nextCursor === undefined) throw new Error("Expected text answer cursor");

    const second = await storage.listTextAnswerPage("form", { ...query, cursor: first.nextCursor });
    expect(second).toEqual({
      items: [
        {
          responseId: "multi",
          formId: "form",
          formVersion: 2,
          fieldId: "third",
          text: "three",
          locale: "ja",
          submittedAt: "2026-08-24T00:00:00.000Z",
          metadata: { deck: "deck-a", pii: false }
        }
      ],
      hasMore: false
    });
    expect(filters.at(-1)).toContain("deck eq 'deck-a'");
    expect(filters.at(-1)).toContain("pii eq false");
  });

  it("bounds empty-answer scans and resumes on the next native page without gaps", async () => {
    const { client, pageRequests } = createClientStub();
    const storage = createAzureTableStorage({ client, maxScanPages: 1 });
    for (const id of ["empty-a", "empty-b", "empty-c"]) {
      await storage.saveSubmission({ ...submission(id), values: { first: "", second: "", third: "" } });
    }
    await storage.saveSubmission({
      ...submission("filled"),
      values: { first: "one", second: "two", third: "three" }
    });
    if (storage.listTextAnswerPage === undefined) throw new Error("Expected text answer paging");
    const query = { pageSize: 2, fieldIds: ["first", "second", "third"] };

    const emptyPage = await storage.listTextAnswerPage("form", query);
    expect(emptyPage.items).toEqual([]);
    expect(emptyPage.hasMore).toBe(true);
    if (emptyPage.nextCursor === undefined) throw new Error("Expected cursor after bounded scan");

    const firstAnswers = await storage.listTextAnswerPage("form", { ...query, cursor: emptyPage.nextCursor });
    expect(firstAnswers.items.map(({ fieldId, text }) => ({ fieldId, text }))).toEqual([
      { fieldId: "first", text: "one" },
      { fieldId: "second", text: "two" }
    ]);
    if (firstAnswers.nextCursor === undefined) throw new Error("Expected cursor inside the filled entity");

    const finalAnswers = await storage.listTextAnswerPage("form", { ...query, cursor: firstAnswers.nextCursor });
    expect(finalAnswers.items.map(({ fieldId, text }) => ({ fieldId, text }))).toEqual([
      { fieldId: "third", text: "three" }
    ]);
    expect(finalAnswers.hasMore).toBe(false);
    expect(pageRequests).toHaveLength(3);
  });

  it("rejects a text-answer cursor when its filter fingerprint changes", async () => {
    const { client } = createClientStub();
    const storage = createAzureTableStorage({ client, maxScanPages: 1 });
    for (const id of ["one", "two", "three"]) await storage.saveSubmission(submission(id));
    if (storage.listTextAnswerPage === undefined) throw new Error("Expected text answer paging");
    const first = await storage.listTextAnswerPage("form", {
      pageSize: 1,
      fieldIds: ["answer"],
      filter: { op: "eq", path: "deckId", value: "A" }
    });
    expect(first).toMatchObject({ items: [], hasMore: true });
    if (first.nextCursor === undefined) throw new Error("Expected a fingerprinted cursor");
    await expect(
      storage.listTextAnswerPage("form", {
        pageSize: 1,
        fieldIds: ["answer"],
        filter: { op: "eq", path: "deckId", value: "B" },
        cursor: first.nextCursor
      })
    ).rejects.toThrow("invalid_cursor_context");
  });

  it("deletes individual responses, form responses, schemas, and all configured entities", async () => {
    const { client } = createClientStub();
    const storage = createAzureTableStorage({ client });
    await storage.saveSchema(schema);
    await storage.saveSubmission(submission("one"));
    await storage.saveSubmission(submission("two"));
    await storage.deleteSubmission("one");
    expect((await storage.listSubmissions("form")).map((item) => item.id)).toEqual(["two"]);
    await storage.clearResponses?.("form");
    expect(await storage.listSubmissions("form")).toEqual([]);
    await storage.deleteSchema("form", 2);
    expect(await storage.getSchema("form", 2)).toBeNull();
    await storage.saveSchema(schema);
    await storage.clear();
    expect(await storage.listSchemas()).toEqual([]);
  });

  it("maps submission fields to physical Azure Table property names", async () => {
    const { client, filters, entities } = createClientStub();
    const storage = createAzureTableStorage({
      client,
      fieldMapping: { formVersion: "surveyVersion", submittedAt: "answeredAt" }
    });
    await storage.saveSubmission(submission("mapped"));

    expect([...entities.values()]).toContainEqual(
      expect.objectContaining({ surveyVersion: 2, answeredAt: "2026-08-24T00:00:00.000Z" })
    );
    const page = await storage.listSubmissionPage("form", {
      version: 2,
      since: "2026-08-24T00:00:00.000Z"
    });
    expect(page.items).toEqual([submission("mapped")]);
    expect(filters.at(-1)).toContain("surveyVersion eq 2");
    expect(filters.at(-1)).toContain("answeredAt ge '2026-08-24T00:00:00.000Z'");
  });
});

describe("createLegacyArrayAzureTableCodec", () => {
  it("round-trips legacy answers arrays", () => {
    const codec = createLegacyArrayAzureTableCodec<{ readonly tenantId: string }>({
      metadataExtractor: (entity) => ({ tenantId: String(entity.tenantId) })
    });
    const submission = {
      id: "response-1",
      formId: "form",
      formVersion: 2,
      values: { first: "Ada", score: 5 },
      locale: "en-US",
      metadata: { tenantId: "tenant-1" },
      submittedAt: "2026-08-29T00:00:00.000Z"
    } as const;

    const entity = codec.encode(submission);
    expect(entity).toMatchObject({ PartitionKey: "form", RowKey: "response-1", surveyVersion: 2, locale: "en-US" });
    expect(codec.decode(entity)).toEqual(submission);
  });
});

describe("createLegacyAzureTableCodec", () => {
  it("decodes legacy answers and timestamp properties into canonical values", () => {
    const codec = createLegacyAzureTableCodec();

    expect(
      codec.decode({
        PartitionKey: "form",
        RowKey: "submission",
        answers: JSON.stringify({ name: "Ada" }),
        answeredAt: "2026-08-29T00:00:00.000Z",
        surveyVersion: 3
      })
    ).toEqual({
      id: "submission",
      formId: "form",
      formVersion: 3,
      values: { name: "Ada" },
      metadata: {},
      submittedAt: "2026-08-29T00:00:00.000Z"
    });
  });
});
