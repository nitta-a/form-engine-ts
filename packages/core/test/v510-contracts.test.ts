import {
  type FormSubmission,
  FormSubmissionError,
  type FormSubmissionSerializedError,
  FormSubmissionWireSchema,
  toFormSubmissionWire
} from "../src";

describe("v5.1 submission contracts", () => {
  it("converts canonical submissions to an alias-free wire payload", () => {
    const submission: FormSubmission = {
      id: "submission-1",
      formId: "form-1",
      formVersion: 2,
      locale: "ja",
      values: { answer: "はい" },
      metadata: { source: "test" },
      submittedAt: "2026-08-29T00:00:00.000Z"
    };
    const wire = toFormSubmissionWire(submission);

    expect(wire).toEqual({
      id: "submission-1",
      formId: "form-1",
      formVersion: 2,
      values: { answer: "はい" },
      locale: "ja",
      metadata: { source: "test" },
      submittedAt: "2026-08-29T00:00:00.000Z"
    });
    expect(FormSubmissionWireSchema.parse(wire)).toEqual(wire);
  });

  it("serializes structured submission errors through JSON.stringify", () => {
    const payload: FormSubmissionSerializedError = {
      code: "PII_CONFIRMATION_REQUIRED",
      messageKey: "form.confirmSensitiveData",
      fieldErrors: { comment: "validation.sensitiveData" },
      formErrors: [],
      piiFindings: [{ fieldId: "comment", type: "phone" }]
    };

    expect(JSON.parse(JSON.stringify(new FormSubmissionError(payload)))).toEqual(payload);
  });
});
