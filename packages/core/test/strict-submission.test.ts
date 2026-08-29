import { type StrictFormSubmission, StrictFormSubmissionWireSchema, toFormSubmissionWire } from "../src";

describe("strict submission contract", () => {
  const submission: StrictFormSubmission = {
    id: "submission-1",
    formId: "form-1",
    formVersion: 1,
    values: { answer: "yes" },
    locale: "en-US",
    metadata: {},
    submittedAt: "2026-08-29T00:00:00.000Z"
  };

  it("requires a non-empty locale when converting to strict wire format", () => {
    expect(toFormSubmissionWire(submission, { requireLocale: true })).toMatchObject({ locale: "en-US" });
    expect(() => toFormSubmissionWire({ ...submission, locale: "" }, { requireLocale: true })).toThrow(
      /Missing required "locale"/
    );
  });

  it("rejects wire payloads that omit locale", () => {
    const result = StrictFormSubmissionWireSchema.safeParse({
      id: submission.id,
      formId: submission.formId,
      formVersion: submission.formVersion,
      values: submission.values,
      metadata: submission.metadata,
      submittedAt: submission.submittedAt
    });
    expect(result.success).toBe(false);
  });
});
