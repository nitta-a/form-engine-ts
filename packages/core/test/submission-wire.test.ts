import { type FormSubmission, FormSubmissionWireSchema, fromFormSubmissionWire, toFormSubmissionWire } from "../src";

describe("submission wire conversion", () => {
  it("round-trips locale and canonical values through runtime validation", () => {
    const submission: FormSubmission = {
      id: "submission-1",
      formId: "form-1",
      formVersion: 1,
      values: { name: "Ada" },
      locale: "en-US",
      metadata: { source: "test" },
      submittedAt: "2026-08-29T00:00:00.000Z"
    };

    const wire = toFormSubmissionWire(submission);
    const parsed = FormSubmissionWireSchema.parse(wire);

    expect(fromFormSubmissionWire(parsed)).toEqual(submission);
    expect("answers" in fromFormSubmissionWire(parsed)).toBe(false);
  });

  it("keeps locale optional for older wire payloads", () => {
    const wire = FormSubmissionWireSchema.parse({
      id: "submission-1",
      formId: "form-1",
      formVersion: 1,
      values: {},
      metadata: {},
      submittedAt: "2026-08-29T00:00:00.000Z"
    });

    expect(fromFormSubmissionWire(wire).locale).toBeUndefined();
  });
});
