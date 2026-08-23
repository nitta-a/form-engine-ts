import type { FormSubmission } from "@form-engine/core";
import { DuplicateSubmissionError, MemoryStorageAdapter } from "../src";

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

describe("MemoryStorageAdapter", () => {
  it("isolates instances, filters, sorts, and clears", async () => {
    const storage = new MemoryStorageAdapter();
    const other = new MemoryStorageAdapter();
    await storage.saveSubmission(submission("v2", 2));
    await storage.saveSubmission(submission("v1", 1));
    expect(await storage.listSubmissions("form")).toHaveLength(2);
    expect(await storage.listSubmissions("form", 1)).toEqual([expect.objectContaining({ id: "v1" })]);
    expect(await other.listSubmissions("form")).toEqual([]);
    await storage.clear();
    expect(await storage.listSubmissions("form")).toEqual([]);
  });

  it("defensively copies input and output", async () => {
    const storage = new MemoryStorageAdapter();
    const original = submission("one");
    await storage.saveSubmission(original);
    const first = await storage.listSubmissions("form");
    const firstSubmission = first[0];
    if (firstSubmission === undefined) throw new Error("Expected a stored submission.");
    (firstSubmission.values.choices as string[]).push("b");
    expect((await storage.listSubmissions("form"))[0]?.values.choices).toEqual(["a"]);
  });

  it("rejects duplicate IDs", async () => {
    const storage = new MemoryStorageAdapter();
    await storage.saveSubmission(submission("one"));
    await expect(storage.saveSubmission(submission("one", 2))).rejects.toBeInstanceOf(DuplicateSubmissionError);
  });
});
