import { describe, expect, it, vi } from "vitest";
import { createHttpCreationAssistantAdapter } from "./httpCreationAssistantAdapter";

describe("HTTP creation assistant adapter", () => {
  it("posts the structured conversation request and forwards the response", async () => {
    const response = { type: "ready", message: "Ready", brief: { purpose: "Learn" } };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => response });
    vi.stubGlobal("fetch", fetchMock);
    const result = await createHttpCreationAssistantAdapter("/conversation").respond({
      latestMessage: "Learn",
      brief: {}
    });
    expect(result).toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith(
      "/conversation",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ latestMessage: "Learn", brief: {} }) })
    );
    vi.unstubAllGlobals();
  });
});
