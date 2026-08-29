import { createSubmissionErrorFromPii } from "../src";

describe("createSubmissionErrorFromPii", () => {
  it("creates a serializable confirmation error with field details", () => {
    const error = createSubmissionErrorFromPii([{ fieldId: "email", type: "email", typeLabel: "メールアドレス" }], {
      messageKey: "privacy.confirm"
    });

    expect(error.payload).toEqual({
      code: "PII_CONFIRMATION_REQUIRED",
      messageKey: "privacy.confirm",
      fieldErrors: { email: "個人情報（メールアドレス）が含まれている可能性があります。" },
      formErrors: ["個人情報の確認が必要です。"],
      piiFindings: [{ fieldId: "email", type: "email", typeLabel: "メールアドレス" }],
      piiWarningAcknowledged: false
    });
  });
});
