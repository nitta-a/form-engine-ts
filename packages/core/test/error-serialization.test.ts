import {
  deserializeSubmissionError,
  deserializeSubmissionErrorFromTrpc,
  FormSubmissionError,
  type FormSubmissionSerializedError,
  serializeSubmissionError,
  serializeSubmissionErrorForTrpc,
  trpcSubmissionErrorAdapter
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

  it("round-trips typed errors through tRPC-shaped data", () => {
    const error = new FormSubmissionError({
      code: "VALIDATION_FAILED",
      messageKey: "validation.submission",
      fieldErrors: { name: "validation.required" },
      formErrors: ["Invalid submission."]
    });
    const data = serializeSubmissionErrorForTrpc(error);
    expect(data.source).toBe("form-engine");
    expect(deserializeSubmissionErrorFromTrpc({ shape: { data } })?.payload).toMatchObject(error.payload);
    expect(trpcSubmissionErrorAdapter.deserialize({ data })?.payload).toMatchObject(error.payload);
  });
});
