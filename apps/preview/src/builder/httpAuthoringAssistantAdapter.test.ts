import { describe, expect, it, vi } from "vitest";
import { createHttpAuthoringAssistantAdapter } from "./httpAuthoringAssistantAdapter";

describe("HTTP authoring adapter", () => {
  it("posts the request and returns structured provider output", async () => {
    const suggestion = { id: "s1", summary: "ok", operations: [], baseSchemaHash: "hash" };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => suggestion });
    vi.stubGlobal("fetch", fetchMock);
    const adapter = createHttpAuthoringAssistantAdapter("/assistant");
    if (adapter.generate === undefined) throw new Error("HTTP adapter is missing generate().");
    await expect(adapter.generate({ intent: "generate_form" })).resolves.toEqual(suggestion);
    expect(fetchMock).toHaveBeenCalledWith(
      "/assistant",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ intent: "generate_form" }) })
    );
    vi.unstubAllGlobals();
  });
});
