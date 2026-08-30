import { fromLegacyFormSubmission } from "../src";

describe("fromLegacyFormSubmission", () => {
  it("maps legacy answers and preserves optional canonical fields", () => {
    const legacy = {
      id: "legacy-1",
      formId: "form",
      formVersion: 3,
      answers: { name: "Ada", accepted: true },
      locale: "ja",
      metadata: { source: "migration" },
      submittedAt: "2026-08-30T00:00:00.000Z",
      schemaRevision: 7
    } as const;

    expect(fromLegacyFormSubmission(legacy)).toEqual({
      id: "legacy-1",
      formId: "form",
      formVersion: 3,
      values: { name: "Ada", accepted: true },
      locale: "ja",
      metadata: { source: "migration" },
      submittedAt: "2026-08-30T00:00:00.000Z",
      schemaRevision: 7
    });
  });

  it("omits optional fields when the legacy submission does not provide them", () => {
    const submission = fromLegacyFormSubmission({
      id: "legacy-2",
      formId: "form",
      formVersion: 1,
      answers: { name: "Grace" },
      metadata: { source: "migration" },
      submittedAt: "2026-08-30T00:00:00.000Z"
    });

    expect(submission).not.toHaveProperty("locale");
    expect(submission).not.toHaveProperty("schemaRevision");
  });
});
