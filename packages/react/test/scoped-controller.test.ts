import type { FormSchema } from "@form-engine-ts/core";
import { createScopedSubmissionController } from "../src";

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
});
