import type { TableClient } from "@azure/data-tables";
import type { FormSchema, FormSubmission } from "@form-engine-ts/core";
import {
  type AzureTableClientLike,
  type AzureTableEntityCodec,
  type AzureTableEntityPage,
  createAzureTableStorage
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
});
