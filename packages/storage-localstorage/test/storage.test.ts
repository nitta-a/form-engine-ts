import type { FormSchema, FormSubmission } from "@form-engine/core";
import { createLocalStorageAdapter, type StorageLike } from "../src";

function createStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    key: (index) => [...values.keys()][index] ?? null
  };
}

const schema: FormSchema = {
  id: "form",
  version: 1,
  titleKey: "title",
  fields: [{ id: "answer", type: "text", labelKey: "answer" }]
};

function submission(id: string, version = 1): FormSubmission {
  return {
    id,
    formId: "form",
    formVersion: version,
    locale: "en",
    values: { answer: "yes" },
    submittedAt: "2025-01-01T00:00:00.000Z"
  };
}

describe("createLocalStorageAdapter", () => {
  it("supports schema and submission CRUD with defensive copies", async () => {
    const adapter = createLocalStorageAdapter("one_", createStorage());
    await adapter.saveSchema(schema);
    expect(await adapter.getSchema("form", 1)).toEqual(schema);
    const loaded = await adapter.getSchema("form", 1);
    if (loaded === null) throw new Error("Expected schema");
    (loaded.fields as FormSchema["fields"]).slice();
    await adapter.saveSubmission(submission("one"));
    const responses = await adapter.listSubmissions("form", 1);
    expect(responses).toHaveLength(1);
    await adapter.deleteSubmission("one");
    expect(await adapter.listSubmissions("form")).toEqual([]);
    await adapter.deleteSchema("form", 1);
    expect(await adapter.listSchemas()).toEqual([]);
  });

  it("isolates prefixes, rejects duplicate IDs, and clears only its own keys", async () => {
    const storage = createStorage();
    const first = createLocalStorageAdapter("a_", storage);
    const second = createLocalStorageAdapter("b_", storage);
    await first.saveSubmission(submission("same"));
    await expect(first.saveSubmission(submission("same", 2))).rejects.toThrow(/already exists/);
    await second.saveSubmission(submission("same"));
    await first.clear();
    expect(await first.listSubmissions("form")).toEqual([]);
    expect(await second.listSubmissions("form")).toHaveLength(1);
  });

  it("reports corrupt JSON", async () => {
    const storage = createStorage();
    storage.setItem("pf_schema:form:1", "{");
    const adapter = createLocalStorageAdapter("pf_", storage);
    await expect(adapter.listSchemas()).rejects.toThrow(/invalid/);
  });
});
