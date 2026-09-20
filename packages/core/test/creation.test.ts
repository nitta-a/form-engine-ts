import { describe, expect, it } from "vitest";
import {
  CREATION_ASSISTANT_RESPONSE_JSON_SCHEMA,
  canGenerateCreationDraft,
  evaluateCreationBriefReadiness,
  mergeSurveyCreationBrief,
  parseCreationAssistantResponse,
  parseSurveyCreationBrief
} from "../src";

describe("survey creation assistant contracts", () => {
  it("requires purpose plus audience or goals and allows the turn limit fallback", () => {
    expect(evaluateCreationBriefReadiness({}).ready).toBe(false);
    expect(evaluateCreationBriefReadiness({ purpose: "Learn more" }).ready).toBe(false);
    expect(evaluateCreationBriefReadiness({ purpose: "Learn more", audience: "Customers" }).ready).toBe(true);
    expect(evaluateCreationBriefReadiness({ purpose: "Learn more", goals: ["Find pain points"] }).ready).toBe(true);
    expect(canGenerateCreationDraft({ purpose: "Learn more" }, 3)).toBe(true);
  });

  it("merges structured brief updates without losing nested constraints", () => {
    expect(
      mergeSurveyCreationBrief(
        { purpose: "Learn more", constraints: { tone: "neutral" } },
        { audience: "Customers", constraints: { anonymous: true } }
      )
    ).toEqual({
      purpose: "Learn more",
      audience: "Customers",
      constraints: { tone: "neutral", anonymous: true }
    });
  });

  it("parses clarification, ready, quick replies, and rejects unknown fields", () => {
    const clarification = parseCreationAssistantResponse({
      type: "clarification",
      message: "Who will answer?",
      brief: { purpose: "Learn more" },
      missing: ["audience"],
      suggestions: [{ id: "customers", label: "Customers", value: "customers" }]
    });
    expect(clarification.type).toBe("clarification");
    expect(parseCreationAssistantResponse({ type: "ready", message: "Ready", brief: { purpose: "Learn" } })).toEqual({
      type: "ready",
      message: "Ready",
      brief: { purpose: "Learn" }
    });
    expect(parseSurveyCreationBrief({ purpose: "Learn", contentMode: "survey" })).toEqual({
      purpose: "Learn",
      contentMode: "survey"
    });
    expect(CREATION_ASSISTANT_RESPONSE_JSON_SCHEMA).toMatchObject({ oneOf: expect.any(Array) });
    expect(() => parseCreationAssistantResponse({ type: "ready", message: "bad", brief: {}, extra: true })).toThrow(
      "Invalid creation assistant response"
    );
  });
});
