import { createSubmission } from "../src";

describe("generic submission metadata", () => {
  it("propagates the metadata type through the input factory", () => {
    const submission = createSubmission<{ deckId: string; piiConfirmed: boolean }>({
      formId: "guide",
      formVersion: 1,
      answers: { title: "Welcome" },
      metadata: { deckId: "deck_123", piiConfirmed: false },
      submittedAt: "2026-08-29T00:00:00.000Z"
    });

    expectTypeOf(submission.metadata.deckId).toEqualTypeOf<string>();
    expect(submission.metadata).toEqual({ deckId: "deck_123", piiConfirmed: false });
  });
});
