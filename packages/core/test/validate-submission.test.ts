import { type FormSchema, type FormSubmission, validateSubmission } from "../src";

const schema: FormSchema = {
  id: "contact",
  version: 1,
  title: "Contact",
  fields: [
    { id: "name", type: "text", title: "Name", required: true },
    { id: "comment", type: "textarea", title: "Comment", required: false }
  ]
};

describe("validateSubmission", () => {
  it("combines schema failures and privacy findings", () => {
    const submission: FormSubmission = {
      id: "submission-1",
      formId: "contact",
      formVersion: 1,
      locale: "en",
      values: { comment: "Call me at 555-123-4567" },
      submittedAt: "2026-08-29T00:00:00.000Z"
    };
    const result = validateSubmission(schema, submission, {
      privacyEngine: {
        detect: () => [{ fieldId: "comment", type: "phone" }]
      }
    });

    expect(result.valid).toBe(false);
    expect(result.fieldErrors).toEqual({
      name: "validation.required",
      comment: "validation.sensitiveData"
    });
    expect(result.piiFindings).toEqual([{ fieldId: "comment", type: "phone" }]);
  });
});
