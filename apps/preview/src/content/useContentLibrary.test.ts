import { createSubmission, type FormSchema } from "@form-engine-ts/core";
import { createMemoryStorageAdapter } from "@form-engine-ts/storage-memory";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useContentLibrary } from "./useContentLibrary";

const schema: FormSchema = {
  id: "feedback",
  version: 3,
  title: "Customer feedback",
  defaultLocale: "en",
  supportedLocales: ["en", "ja"],
  fields: [{ id: "notes", type: "textarea", title: "Your feedback", required: false }],
  translations: { ja: { title: "顧客の声", description: "ご意見をお聞かせください" } }
};

describe("survey library storage", () => {
  afterEach(cleanup);
  beforeEach(() => window.history.replaceState(null, "", "/"));

  it("duplicates the questions as a new form without copying responses or an old translated title", async () => {
    const storage = createMemoryStorageAdapter();
    await storage.saveSchema(schema);
    await storage.saveSubmission(
      createSubmission(
        schema,
        { notes: "Helpful service" },
        { id: "response", locale: "en", submittedAt: "2026-01-01T00:00:00Z" }
      )
    );
    const { result } = renderHook(() => useContentLibrary(storage));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.duplicate(schema, "Customer feedback (copy)"));
    const copy = result.current.selected;
    if (copy === undefined) throw new Error("Expected the copied form to be selected");
    expect(copy.id).not.toBe(schema.id);
    expect(copy.version).toBe(1);
    expect(copy.title).toBe("Customer feedback (copy)");
    expect(copy.fields).toEqual(schema.fields);
    expect(copy.translations?.ja).toEqual({ description: "ご意見をお聞かせください" });
    expect(await storage.listSubmissions(copy.id, copy.version)).toEqual([]);
    expect(await storage.listSubmissions(schema.id, schema.version)).toHaveLength(1);
    expect(await storage.getSchema(schema.id, schema.version)).toEqual(schema);
  });

  it("keeps a new survey unsaved until saved and refreshes library rows without losing that draft", async () => {
    const storage = createMemoryStorageAdapter();
    const { result } = renderHook(() => useContentLibrary(storage));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.create("survey", "New survey", "en", undefined, "draft"));
    const draft = result.current.selected;
    expect(await storage.getSchema("draft", 1)).toBeNull();
    await storage.saveSchema(schema);
    await act(() => result.current.refresh());
    expect(result.current.allSchemas).toEqual([schema]);
    expect(result.current.selected).toBe(draft);
  });

  it("shows refresh failures while retaining the loaded forms", async () => {
    const storage = createMemoryStorageAdapter();
    await storage.saveSchema(schema);
    const { result } = renderHook(() => useContentLibrary(storage));
    await waitFor(() => expect(result.current.loading).toBe(false));
    vi.spyOn(storage, "listSchemas").mockRejectedValueOnce(new Error("Storage unavailable"));
    await act(() => result.current.refresh());
    expect(result.current.error).toBe("Storage unavailable");
    expect(result.current.allSchemas).toEqual([schema]);
  });
});
