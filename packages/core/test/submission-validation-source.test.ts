import type { FormSchema, FormSubmission } from "../src";
import { assertValidFormSubmissionWith } from "../src";

const schema: FormSchema = {
  id: "validated",
  version: 1,
  title: "Validated",
  fields: [{ id: "name", type: "text", title: "Name", required: true }]
};

const submission: FormSubmission = {
  id: "submission-1",
  formId: "validated",
  formVersion: 1,
  values: { name: "Ada" },
  metadata: {},
  submittedAt: "2026-08-30T00:00:00.000Z"
};

describe("submission validation sources", () => {
  it("accepts a FormSchema and an async validator", async () => {
    await expect(assertValidFormSubmissionWith(schema, submission)).resolves.toBeUndefined();
    const validator = vi.fn(async (value: FormSubmission) => {
      expect(value.values.name).toBe("Ada");
    });
    await expect(assertValidFormSubmissionWith(validator, submission)).resolves.toBeUndefined();
    expect(validator).toHaveBeenCalledOnce();
  });

  it("rejects a validator result with structured errors", async () => {
    await expect(
      assertValidFormSubmissionWith(
        () => ({ valid: false, fieldErrors: { name: "validation.required" }, formErrors: [] }),
        submission
      )
    ).rejects.toThrow("validation.required");
  });
});
