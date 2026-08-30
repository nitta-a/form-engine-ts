import type { FormSchema } from "@form-engine-ts/core";
import { createScopedSubmissionController, createSubmissionIdentity } from "../src";

const schema: FormSchema = {
  id: "survey",
  version: 1,
  title: "Survey",
  fields: [{ id: "answer", type: "text", title: "Answer", required: false }]
};

describe("scoped submission controller", () => {
  it("creates a valid ULID and keeps deck scopes independent", async () => {
    const first = createScopedSubmissionController({
      schema,
      scope: { formId: schema.id, formVersion: schema.version, deckId: "deck-a" },
      idFormat: "ulid",
      onSubmit: async () => ({ receiptId: "receipt-a" })
    });
    const second = createScopedSubmissionController({
      schema,
      scope: { formId: schema.id, formVersion: schema.version, deckId: "deck-b" },
      idFormat: "ulid",
      onSubmit: async () => ({ receiptId: "receipt-b" })
    });

    await first.submit({});
    expect(first.getState().submission?.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/u);
    expect(first.getState().isSubmitted).toBe(true);
    expect(second.getState().isSubmitted).toBe(false);
  });

  it("shares one identity configuration between submission creation and the controller", async () => {
    const identity = createSubmissionIdentity({
      schema,
      scope: { formId: schema.id, formVersion: schema.version, deckId: "shared" },
      idFormat: "ulid"
    });
    const controller = createScopedSubmissionController({
      identity,
      onSubmit: async (submission) => {
        expect(submission.id).toMatch(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/u);
        return {};
      }
    });

    await controller.submit({ answer: "one" });
    const next = await identity.createSubmission({ answer: "two" }, "ja", "2026-08-30T00:00:00.000Z");
    expect(next.id).toBe(controller.getState().attemptId);
  });
});
