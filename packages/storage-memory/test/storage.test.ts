import type { FormSubmission } from "@form-engine/core";
import { createMemoryStorageAdapter } from "../src";

function submission(id: string, version = 1): FormSubmission {
  return {
    id,
    formId: "form",
    formVersion: version,
    locale: "en",
    values: { choices: ["a"] },
    submittedAt: `2025-01-0${version}T00:00:00.000Z`
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

  it("stores, lists, updates, and deletes schemas", async () => {
    const storage = createMemoryStorageAdapter();
    const schema = {
      id: "form",
      version: 1,
      titleKey: "title",
      fields: [{ id: "answer", type: "text", labelKey: "answer" }]
    } as const;
    await storage.saveSchema(schema);
    expect(await storage.getSchema("form", 1)).toEqual(schema);
    await storage.saveSchema({ ...schema, titleKey: "updated" });
    expect((await storage.listSchemas())[0]?.titleKey).toBe("updated");
    await storage.deleteSchema("form", 1);
    expect(await storage.listSchemas()).toEqual([]);
  });
});
