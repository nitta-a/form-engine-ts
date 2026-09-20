import { parseCreationAssistantResponse } from "@form-engine-ts/core";
import { describe, expect, it } from "vitest";
import { mockCreationAssistantAdapter } from "./mockCreationAssistantAdapter";

describe("preview creation mock", () => {
  it("walks purpose, audience, goals, and ready", async () => {
    const first = parseCreationAssistantResponse(
      await mockCreationAssistantAdapter.respond({ latestMessage: "勤怠システム", brief: {} })
    );
    expect(first.type).toBe("clarification");
    const second = parseCreationAssistantResponse(
      await mockCreationAssistantAdapter.respond({ latestMessage: "社員", brief: first.brief })
    );
    expect(second.type).toBe("clarification");
    const third = parseCreationAssistantResponse(
      await mockCreationAssistantAdapter.respond({ latestMessage: "使いやすさ", brief: second.brief })
    );
    expect(third.type).toBe("ready");
  });
});
