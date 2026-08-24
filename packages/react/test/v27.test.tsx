import type { FormSchema, FormValues } from "@form-engine-ts/core";
import type { SensitiveDataFinding } from "@form-engine-ts/privacy";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createLocalStorageSubmissionReceiptStore,
  FormRenderer,
  type SubmissionGuard,
  type SubmissionReceipt,
  type SubmissionReceiptStore
} from "../src";

const schema: FormSchema = {
  id: "guarded",
  version: 7,
  title: "Guarded form",
  fields: [
    {
      id: "comment",
      type: "textarea",
      title: "Comment",
      required: false,
      minLength: 2,
      maxLength: 500,
      pattern: "^[\\s\\S]+$"
    }
  ]
};

function createReceiptStore() {
  let receipt: SubmissionReceipt | null = null;
  const store: SubmissionReceiptStore = {
    get: vi.fn(async () => receipt),
    save: vi.fn(async (value) => {
      receipt = value;
    }),
    remove: vi.fn(async () => {
      receipt = null;
    })
  };
  return store;
}

describe("v2.7 submission protection", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("pauses email submission for confirmation, saves a receipt, and restores submitted state", async () => {
    const user = userEvent.setup();
    const receiptStore = createReceiptStore();
    const finding: SensitiveDataFinding = {
      fieldId: "comment",
      type: "email",
      matchedText: "ada@example.com"
    };
    const guardImplementation: SubmissionGuard = (_currentSchema, values) =>
      String(values.comment).includes("@") ? { status: "confirm", findings: [finding] } : { status: "allow" };
    const guard = vi.fn(guardImplementation);
    const onSubmit = vi.fn(async (_values: FormValues) => undefined);
    const slots = {
      renderSubmissionConfirmation: ({
        findings,
        onConfirm
      }: {
        findings: readonly SensitiveDataFinding[];
        onConfirm: () => void;
      }) => (
        <button type="button" onClick={onConfirm}>
          Confirm guarded submission ({findings.length})
        </button>
      ),
      renderAlreadySubmitted: ({ receipt: stored }: { receipt: SubmissionReceipt }) => (
        <div data-testid="already-submitted">Submitted at {stored.submittedAt}</div>
      )
    };
    const view = render(
      <FormRenderer
        schema={schema}
        onSubmit={onSubmit}
        submissionGuards={[guard]}
        receiptStore={receiptStore}
        slots={slots}
      />
    );
    await screen.findByRole("heading", { name: "Guarded form" });
    await user.type(screen.getByLabelText("Comment"), "ada@example.com");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByRole("button", { name: "Confirm guarded submission (1)" })).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirm guarded submission (1)" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(receiptStore.save).toHaveBeenCalledOnce();
    expect(await screen.findByTestId("already-submitted")).toBeInTheDocument();

    view.unmount();
    render(
      <FormRenderer
        schema={schema}
        onSubmit={onSubmit}
        submissionGuards={[guard]}
        receiptStore={receiptStore}
        slots={slots}
      />
    );
    expect(await screen.findByTestId("already-submitted")).toBeInTheDocument();
    expect(receiptStore.get).toHaveBeenCalledTimes(2);
  });

  it("applies DOM text constraints and reports the browser-limited character count", async () => {
    const user = userEvent.setup();
    render(
      <FormRenderer
        schema={schema}
        onSubmit={() => undefined}
        slots={{
          renderCharacterCount: ({ current, max }) => (
            <output data-testid="character-count">
              {current}/{max}
            </output>
          )
        }}
      />
    );
    const textarea = screen.getByLabelText("Comment");
    expect(textarea).toHaveAttribute("minlength", "2");
    expect(textarea).toHaveAttribute("maxlength", "500");
    expect(textarea).toHaveAttribute("pattern", "^[\\s\\S]+$");
    await user.click(textarea);
    await user.paste("x".repeat(501));
    expect(textarea).toHaveValue("x".repeat(500));
    expect(screen.getByTestId("character-count")).toHaveTextContent("500/500");
  });

  it("recovers safely from corrupt local receipt JSON", async () => {
    const store = createLocalStorageSubmissionReceiptStore({ namespace: "test_receipt" });
    localStorage.setItem("test_receipt:guarded:v7", "{broken");
    await expect(store.get("guarded", 7)).resolves.toBeNull();
    const receipt: SubmissionReceipt = {
      formId: "guarded",
      formVersion: 7,
      submissionId: "submission-1",
      submittedAt: "2026-08-25T00:00:00.000Z"
    };
    await store.save(receipt);
    await expect(store.get("guarded", 7)).resolves.toEqual(receipt);
    await store.remove("guarded", 7);
    await expect(store.get("guarded", 7)).resolves.toBeNull();
  });
});
