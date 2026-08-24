import type { FormSchema } from "@form-engine-ts/core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createLocalStorageSubmissionAttemptStore,
  FormRenderer,
  type SubmissionReceipt,
  type SubmissionReceiptStore,
  submissionReceiptQueryKey,
  useSubmissionReceipts
} from "../src";

const schema: FormSchema = {
  id: "v29",
  version: 9,
  title: "Retry form",
  fields: [{ id: "comment", type: "text", title: "Comment", required: false }]
};

function LegacyReceiptProbe({ store }: { readonly store: SubmissionReceiptStore }) {
  const result = useSubmissionReceipts(store, [
    { formId: "v29", formVersion: 9 },
    { formId: "other", formVersion: 1 }
  ]);
  return (
    <output data-testid="legacy-receipts">
      {result.isLoading
        ? "loading"
        : [
            result.receipts.get(submissionReceiptQueryKey("v29", 9))?.submissionId,
            result.receipts.get(submissionReceiptQueryKey("other", 1))?.submissionId
          ].join(",")}
    </output>
  );
}

describe("v2.9 receipt resilience and submission attempts", () => {
  afterEach(() => localStorage.clear());

  it("keeps submission successful and reports a receipt persistence error", async () => {
    const user = userEvent.setup();
    const error = new DOMException("Storage quota exceeded", "QuotaExceededError");
    const receiptStore: SubmissionReceiptStore = {
      async get() {
        return null;
      },
      async save() {
        throw error;
      },
      async remove() {}
    };
    const onReceiptError = vi.fn();
    const onSubmit = vi.fn(() => ({
      submissionId: "server-29",
      submittedAt: "2026-08-25T06:40:00.000Z"
    }));
    render(
      <FormRenderer schema={schema} onSubmit={onSubmit} receiptStore={receiptStore} onReceiptError={onReceiptError} />
    );

    await user.click(await screen.findByRole("button", { name: "Submit" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Submitted.");
    expect(onReceiptError).toHaveBeenCalledWith(expect.objectContaining({ message: String(error) }), {
      formId: "v29",
      formVersion: 9,
      submissionId: "server-29",
      submittedAt: "2026-08-25T06:40:00.000Z"
    });
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("reuses a failed attempt id, promotes it to a receipt, and clears it after success", async () => {
    const user = userEvent.setup();
    const attemptStore = createLocalStorageSubmissionAttemptStore({ namespace: "v29_attempt" });
    await attemptStore.getOrCreate("v29", 9, () => "attempt-29");
    let receipt: SubmissionReceipt | null = null;
    const receiptStore: SubmissionReceiptStore = {
      async get() {
        return receipt;
      },
      async save(value) {
        receipt = value;
      },
      async remove() {
        receipt = null;
      }
    };
    const onSubmit = vi.fn().mockRejectedValueOnce(new Error("network unavailable")).mockResolvedValueOnce(undefined);
    render(
      <FormRenderer schema={schema} onSubmit={onSubmit} receiptStore={receiptStore} attemptStore={attemptStore} />
    );
    await user.type(await screen.findByLabelText("Comment"), "retry me");

    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenLastCalledWith({
      comment: "retry me",
      attemptId: "attempt-29",
      submissionId: "attempt-29"
    });
    await expect(attemptStore.get("v29", 9)).resolves.toMatchObject({ attemptId: "attempt-29" });

    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(onSubmit).toHaveBeenLastCalledWith({
      comment: "retry me",
      attemptId: "attempt-29",
      submissionId: "attempt-29"
    });
    await waitFor(() => expect(receipt).toMatchObject({ submissionId: "attempt-29" }));
    await expect(attemptStore.get("v29", 9)).resolves.toBeNull();
  });

  it("falls back to individual gets for legacy receipt stores without getBatch", async () => {
    const receipts = new Map<string, SubmissionReceipt>([
      [
        submissionReceiptQueryKey("v29", 9),
        { formId: "v29", formVersion: 9, submissionId: "first", submittedAt: "2026-08-25T00:00:00.000Z" }
      ],
      [
        submissionReceiptQueryKey("other", 1),
        { formId: "other", formVersion: 1, submissionId: "second", submittedAt: "2026-08-25T00:00:00.000Z" }
      ]
    ]);
    const get = vi.fn(async (formId: string, formVersion: number) => {
      return receipts.get(submissionReceiptQueryKey(formId, formVersion)) ?? null;
    });
    const store: SubmissionReceiptStore = {
      get,
      async save() {},
      async remove() {}
    };
    render(<LegacyReceiptProbe store={store} />);
    await waitFor(() => expect(screen.getByTestId("legacy-receipts")).toHaveTextContent("first,second"));
    expect(get).toHaveBeenCalledTimes(2);
  });
});
