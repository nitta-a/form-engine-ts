import { normalizePiiFindingsToMetadata } from "../src";

describe("normalizePiiFindingsToMetadata", () => {
  it("deduplicates finding types and keeps the count", () => {
    expect(
      normalizePiiFindingsToMetadata(
        [
          { fieldId: "a", type: "email" },
          { fieldId: "b", type: "email" },
          { fieldId: "c", type: "phone" }
        ],
        true
      )
    ).toEqual({ piiConfirmed: true, piiFindingTypes: ["email", "phone"], piiDetectedCount: 3 });
  });
});
