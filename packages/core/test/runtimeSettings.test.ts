import { describe, expect, it } from "vitest";
import { migrateFormRuntimeSettings } from "../src";

describe("form runtime settings migration", () => {
  it("copies only acceptance settings from the explicitly selected published schema", () => {
    expect(
      migrateFormRuntimeSettings(
        {
          id: "form-1",
          version: 8,
          title: "Versioned title",
          description: "Versioned description",
          completionMessage: "Versioned completion",
          submissionSettings: {
            openAt: "2026-09-01T00:00:00.000Z",
            closeAt: "2026-09-30T00:00:00.000Z",
            maxResponses: 100
          },
          fields: []
        },
        "2026-09-01T00:00:00.000Z",
        { iconKey: "calendar", colorToken: "blue" }
      )
    ).toEqual({
      formId: "form-1",
      openAt: "2026-09-01T00:00:00.000Z",
      closeAt: "2026-09-30T00:00:00.000Z",
      maxResponses: 100,
      iconKey: "calendar",
      colorToken: "blue",
      updatedAt: "2026-09-01T00:00:00.000Z"
    });
  });

  it("rejects inverted ranges and invalid response limits", () => {
    expect(() =>
      migrateFormRuntimeSettings(
        {
          id: "form-1",
          version: 1,
          title: "Form",
          submissionSettings: { openAt: "2026-10-01T00:00:00.000Z", closeAt: "2026-09-01T00:00:00.000Z" },
          fields: []
        },
        "2026-09-01T00:00:00.000Z"
      )
    ).toThrow("closeAt must be later than openAt.");
  });
});
