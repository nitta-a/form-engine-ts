import { createLocalStorageSubmissionReceiptStore, type SubmissionReceipt, submissionReceiptQueryKey } from "../src";

describe("scoped submission receipts", () => {
  it("keeps form receipts compatible and separates deck/session receipts", async () => {
    const store = createLocalStorageSubmissionReceiptStore({ namespace: "scope-test" });
    const formReceipt: SubmissionReceipt = {
      formId: "form",
      formVersion: 1,
      submittedAt: "2026-01-01T00:00:00.000Z",
      submissionId: "form-submission"
    };
    const deckReceipt: SubmissionReceipt = {
      ...formReceipt,
      deckId: "deck-1",
      sessionId: "session-1",
      submissionId: "deck-submission"
    };

    await store.save(formReceipt);
    await store.save(deckReceipt);

    expect(await store.get("form", 1)).toEqual(formReceipt);
    expect(await store.get("form", 1, { deckId: "deck-1", sessionId: "session-1" })).toEqual(deckReceipt);
    expect(await store.get("form", 1, { deckId: "deck-2", sessionId: "session-1" })).toBeNull();
    expect(submissionReceiptQueryKey("form", 1)).toBe("form:v1");
    expect(submissionReceiptQueryKey("form", 1, { deckId: "deck-1", sessionId: "session-1" })).toContain("deck-1");
  });
});
