import type { FormSubmission } from "@form-engine-ts/core";
import { fromLegacyFormSubmission } from "../src";

describe("legacy submission boundary", () => {
  it("converts an answers payload to canonical values", () => {
    const legacy = {
      id: "legacy-1",
      formId: "form",
      formVersion: 1,
      answers: { name: "Ada" },
      metadata: { source: "migration" },
      submittedAt: "2026-08-30T00:00:00.000Z"
    };
    const submission: FormSubmission = fromLegacyFormSubmission(legacy);

    expect(submission.values).toEqual({ name: "Ada" });
    expect("answers" in submission).toBe(false);
  });
});
