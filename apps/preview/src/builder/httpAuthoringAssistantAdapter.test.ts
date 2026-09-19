import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpAuthoringAssistantAdapter } from "./httpAuthoringAssistantAdapter";

afterEach(() => vi.unstubAllGlobals());

describe("HTTP authoring adapter", () => {
  it("posts the request and returns structured provider output", async () => {
    const suggestion = { id: "s1", summary: "ok", operations: [], baseSchemaHash: "hash" };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => suggestion });
    vi.stubGlobal("fetch", fetchMock);
    const adapter = createHttpAuthoringAssistantAdapter("/assistant");
    await expect(adapter.generate({ intent: "generate_form" })).resolves.toEqual(suggestion);
    expect(fetchMock).toHaveBeenCalledWith(
      "/assistant",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ intent: "generate_form" }) })
    );
  });

  it("reports HTTP failures and forwards AbortSignal", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    vi.stubGlobal("fetch", fetchMock);
    const adapter = createHttpAuthoringAssistantAdapter("/assistant");
    await expect(adapter.generate({ intent: "generate_form" })).rejects.toThrow("503");

    const signal = new AbortController().signal;
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    await adapter.generate({ intent: "generate_form" }, signal);
    expect(fetchMock).toHaveBeenLastCalledWith("/assistant", expect.objectContaining({ signal }));
  });
});
