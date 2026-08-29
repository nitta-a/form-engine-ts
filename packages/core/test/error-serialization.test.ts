import {
  deserializeSubmissionError,
  FormSubmissionError,
  type FormSubmissionSerializedError,
  serializeSubmissionError
} from "../src";

describe("submission error serialization", () => {
  it("serializes and restores a typed error payload", () => {
    const payload: FormSubmissionSerializedError = {
      code: "PII_CONFIRMATION_REQUIRED",
      messageKey: "renderer.confirmSensitiveDataMessage",
      fieldErrors: { comment: "validation.sensitiveData" },
      formErrors: ["Review sensitive data."],
      piiFindings: [{ fieldId: "comment", type: "phone" }],
      piiWarningAcknowledged: false
    };

    const restored = deserializeSubmissionError(serializeSubmissionError(new FormSubmissionError(payload)));

    expect(restored).toBeInstanceOf(FormSubmissionError);
    expect(restored.payload).toEqual(payload);
  });
});
