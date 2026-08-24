import type { FormSubmission } from "@form-engine-ts/core";
import { createMemoryStorageAdapter } from "../src";

function submission(id: string, version = 1, formId = "form", submittedAt?: string): FormSubmission {
  return {
    id,
    formId,
    formVersion: version,
    locale: "en",
    values: { choices: ["a"] },
    metadata: { channel: "ARGS", nested: { retained: true } },
    translationMetadata: { ja: { title: { provider: "human" } } },
    submittedAt: submittedAt ?? `2025-01-0${version}T00:00:00.000Z`
  };
}

describe("createMemoryStorageAdapter", () => {
  it("isolates instances, filters, sorts, and clears", async () => {
    const storage = createMemoryStorageAdapter();
    const other = createMemoryStorageAdapter();
    await storage.saveSubmission(submission("v2", 2));
    await storage.saveSubmission(submission("v1", 1));
    expect(await storage.listSubmissions("form")).toHaveLength(2);
    expect(await storage.listSubmissions("form", 1)).toEqual([expect.objectContaining({ id: "v1" })]);
    expect(await other.listSubmissions("form")).toEqual([]);
    await storage.clear();
    expect(await storage.listSubmissions("form")).toEqual([]);
  });

  it("defensively copies input and output", async () => {
    const storage = createMemoryStorageAdapter();
    const original = submission("one");
    await storage.saveSubmission(original);
    const first = await storage.listSubmissions("form");
    const firstSubmission = first[0];
    if (firstSubmission === undefined) throw new Error("Expected a stored submission.");
    (firstSubmission.values.choices as string[]).push("b");
    expect((await storage.listSubmissions("form"))[0]?.values.choices).toEqual(["a"]);
  });

  it("rejects duplicate IDs", async () => {
    const storage = createMemoryStorageAdapter();
    await storage.saveSubmission(submission("one"));
    await expect(storage.saveSubmission(submission("one", 2))).rejects.toThrow(/already exists/);
  });

  it("filters inclusive time ranges with versions and deterministic ID tie-breaking", async () => {
    const storage = createMemoryStorageAdapter();
    await storage.saveSubmission(submission("z", 1, "form", "2025-01-02T00:00:00.000Z"));
    await storage.saveSubmission(submission("a", 1, "form", "2025-01-02T00:00:00.000Z"));
    await storage.saveSubmission(submission("early", 1, "form", "2025-01-01T00:00:00.000Z"));
    await storage.saveSubmission(submission("late", 2, "form", "2025-01-03T00:00:00.000Z"));
    expect(
      (
        await storage.listSubmissions("form", 1, {
          since: "2025-01-02T00:00:00.000Z",
          until: "2025-01-02T00:00:00.000Z"
        })
      ).map(({ id }) => id)
    ).toEqual(["a", "z"]);
    expect(
      (await storage.listSubmissions("form", undefined, { since: "2025-01-02T00:00:00.000Z" })).map(({ id }) => id)
    ).toEqual(["a", "z", "late"]);
  });

  it("pages 500 items at a time without gaps or duplicates when timestamps match", async () => {
    const storage = createMemoryStorageAdapter();
    const timestamp = "2025-01-02T00:00:00.000Z";
    const expectedIds = Array.from({ length: 1001 }, (_, index) => `response-${String(index).padStart(4, "0")}`);
    await Promise.all(expectedIds.map((id) => storage.saveSubmission(submission(id, 1, "form", timestamp))));

    const receivedIds: string[] = [];
    let cursor: string | undefined;
    const pageSizes: number[] = [];
    do {
      const page = await storage.listSubmissionPage("form", {
        version: 1,
        pageSize: 500,
        ...(cursor === undefined ? {} : { cursor })
      });
      pageSizes.push(page.items.length);
      receivedIds.push(...page.items.map((item) => item.id));
      cursor = page.nextCursor;
      if (!page.hasMore) expect(page.nextCursor).toBeUndefined();
    } while (cursor !== undefined);

    expect(pageSizes).toEqual([500, 500, 1]);
    expect(receivedIds).toEqual(expectedIds);
    expect(new Set(receivedIds).size).toBe(1001);
  });

  it("applies custom predicates and metadata filters before page sizing", async () => {
    const storage = createMemoryStorageAdapter();
    await storage.saveSubmission(submission("one"));
    await storage.saveSubmission({ ...submission("two"), metadata: { channel: "ARGS", tier: 2 } });
    await storage.saveSubmission({ ...submission("three"), metadata: { channel: "other", tier: 2 } });
    const page = await storage.listSubmissionPage("form", {
      pageSize: 1,
      metadataFilters: { tier: 2 },
      filter: (item) => item.metadata?.channel === "ARGS"
    });
    expect(page).toEqual({ items: [{ ...submission("two"), metadata: { channel: "ARGS", tier: 2 } }], hasMore: false });
  });

  it("compares nested metadata as JSON values independent of object key order", async () => {
    const storage = createMemoryStorageAdapter();
    const stored = {
      ...submission("nested"),
      metadata: { profile: { first: "Ada", score: 2 } }
    };
    await storage.saveSubmission(stored);
    const page = await storage.listSubmissionPage("form", {
      metadataFilters: { profile: { score: 2, first: "Ada" } }
    });
    expect(page).toEqual({ items: [stored], hasMore: false });
  });

  it("stores, lists, updates, and deletes schemas", async () => {
    const storage = createMemoryStorageAdapter();
    const schema = {
      id: "form",
      version: 1,
      title: "title",
      defaultLocale: "en",
      supportedLocales: ["en", "ja"],
      metadata: { owner: "ARGS" },
      translationMetadata: { ja: { title: { provider: "machine" } } },
      fields: [{ id: "answer", type: "text", title: "answer", required: false, metadata: { source: "api" } }]
    } as const;
    await storage.saveSchema(schema);
    expect(await storage.getSchema("form", 1)).toEqual(schema);
    await storage.saveSchema({ ...schema, title: "updated" });
    expect((await storage.listSchemas())[0]?.title).toBe("updated");
    await storage.deleteSchema("form", 1);
    expect(await storage.listSchemas()).toEqual([]);
  });

  it("clears every version for one form without deleting schemas or other forms", async () => {
    const storage = createMemoryStorageAdapter();
    const schema = {
      id: "form",
      version: 1,
      title: "title",
      fields: [{ id: "answer", type: "text", title: "answer", required: false }]
    } as const;
    await storage.saveSchema(schema);
    await storage.saveSubmission(submission("one", 1));
    await storage.saveSubmission(submission("two", 2));
    await storage.saveSubmission(submission("other", 1, "other-form"));
    await storage.clearResponses?.("form");
    expect(await storage.listSubmissions("form")).toEqual([]);
    expect(await storage.listSubmissions("other-form")).toHaveLength(1);
    expect(await storage.getSchema("form", 1)).toEqual(schema);
  });
});
