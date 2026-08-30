import { renderHook, waitFor } from "@testing-library/react";
import {
  createLocalStorageSubmissionReceiptStore,
  type SubmissionReceipt,
  type SubmissionReceiptQuery,
  type SubmissionReceiptStore,
  submissionReceiptQueryKey,
  useSubmissionReceipts
} from "../src";

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

  it("passes deck and session scope to stores without batch support", async () => {
    const receipt: SubmissionReceipt = {
      formId: "form",
      formVersion: 1,
      deckId: "deck-1",
      sessionId: "session-1",
      submittedAt: "2026-01-01T00:00:00.000Z"
    };
    const get = vi.fn(async (_formId: string, _formVersion: number, scope?: SubmissionReceiptQuery) =>
      scope?.deckId === receipt.deckId && scope?.sessionId === receipt.sessionId ? receipt : null
    );
    const store: SubmissionReceiptStore = {
      get,
      save: async () => undefined,
      remove: async () => undefined
    };

    const { result } = renderHook(() => useSubmissionReceipts(store, [receipt]));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(get).toHaveBeenCalledWith("form", 1, {
      formId: "form",
      formVersion: 1,
      deckId: "deck-1",
      sessionId: "session-1"
    });
    expect(result.current.receipts.get(submissionReceiptQueryKey("form", 1, receipt))).toEqual(receipt);
  });
});
