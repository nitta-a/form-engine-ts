import type { FormSchema, TranslationAdapter } from "@form-engine-ts/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import {
  FormBuilder,
  FormRenderer,
  type SubmissionConfirmationSlotProps,
  type SubmissionReceipt,
  type SubmissionReceiptStore,
  submissionReceiptQueryKey,
  useSubmissionReceipts
} from "../src";

const schema: FormSchema = {
  id: "v28",
  version: 8,
  title: "Original title",
  description: "Original description",
  fields: [{ id: "comment", type: "text", title: "Comment", required: false }]
};

const protectionTranslator: TranslationAdapter = {
  translate(key) {
    return (
      {
        "form.submit": "Submit",
        "form.submissionBlocked": "Localized blocked",
        "form.confirmSensitiveData": "Localized confirmation",
        "form.confirmSubmission": "Localized confirm",
        "form.cancelSubmission": "Localized cancel",
        "form.alreadySubmitted": "Localized already submitted",
        "form.submitAnother": "Localized submit another"
      }[key] ?? key
    );
  }
};

function createReceiptStore() {
  const receipts = new Map<string, SubmissionReceipt>();
  const store: SubmissionReceiptStore = {
    async get(formId, formVersion) {
      return receipts.get(submissionReceiptQueryKey(formId, formVersion)) ?? null;
    },
    async getBatch(queries) {
      return new Map(
        queries.flatMap((query) => {
          const key = submissionReceiptQueryKey(query.formId, query.formVersion);
          const receipt = receipts.get(key);
          return receipt === undefined ? [] : [[key, receipt] as const];
        })
      );
    },
    save: vi.fn(async (receipt: SubmissionReceipt) => {
      receipts.set(submissionReceiptQueryKey(receipt.formId, receipt.formVersion), receipt);
    }),
    async remove(formId, formVersion) {
      receipts.delete(submissionReceiptQueryKey(formId, formVersion));
    }
  };
  return store;
}

function ReceiptProbe({ store }: { readonly store: SubmissionReceiptStore }) {
  const result = useSubmissionReceipts(store, [
    { formId: "v28", formVersion: 8 },
    { formId: "other", formVersion: 1 }
  ]);
  const first = result.receipts.get(submissionReceiptQueryKey("v28", 8));
  const second = result.receipts.get(submissionReceiptQueryKey("other", 1));
  return (
    <output data-testid="receipt-probe">
      {result.isLoading ? "loading" : `${first?.submissionId ?? "missing"},${second?.submissionId ?? "missing"}`}
    </output>
  );
}

describe("v2.8 React authoring and receipts", () => {
  it("passes confirmation context and stores the response returned by onSubmit", async () => {
    const user = userEvent.setup();
    const store = createReceiptStore();
    const confirmation = vi.fn((props: SubmissionConfirmationSlotProps) => (
      <button type="button" onClick={props.onConfirm}>
        Confirm with context
      </button>
    ));
    const onSubmit = vi.fn(async () =>
      schema.version === 8
        ? {
            submissionId: "response-28",
            submittedAt: "2026-08-25T05:10:00.000Z"
          }
        : undefined
    );
    render(
      <FormRenderer
        schema={schema}
        onSubmit={onSubmit}
        receiptStore={store}
        submissionGuards={[
          (_currentSchema, values) => ({
            status: "confirm",
            findings: [{ fieldId: "comment", type: "email" }],
            message: `Review ${String(values.comment)}`
          })
        ]}
        slots={{ renderSubmissionConfirmation: confirmation }}
      />
    );
    await user.type(await screen.findByLabelText("Comment"), "ada@example.com");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(confirmation).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Review ada@example.com",
        schema: expect.objectContaining({ id: "v28", version: 8 }),
        visibleValues: { comment: "ada@example.com" }
      })
    );
    await user.click(screen.getByRole("button", { name: "Confirm with context" }));
    await waitFor(() =>
      expect(store.save).toHaveBeenCalledWith({
        formId: "v28",
        formVersion: 8,
        submissionId: "response-28",
        submittedAt: "2026-08-25T05:10:00.000Z"
      })
    );
    await store.save({
      formId: "other",
      formVersion: 1,
      submissionId: "other-1",
      submittedAt: "2026-08-25T05:11:00.000Z"
    });
    render(<ReceiptProbe store={store} />);
    await waitFor(() => expect(screen.getByTestId("receipt-probe")).toHaveTextContent("response-28,other-1"));
  });

  it("edits form source title and description through builder primitives", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [current, setCurrent] = useState(schema);
      return (
        <>
          <FormBuilder schema={current} onChange={setCurrent} />
          <output data-testid="builder-schema">{JSON.stringify(current)}</output>
        </>
      );
    }
    render(<Harness />);
    const title = screen.getByLabelText("Form title");
    const description = screen.getByLabelText("Form description");
    await user.clear(title);
    await user.type(title, "Updated title");
    await user.clear(description);
    await user.type(description, "Updated description");
    expect(screen.getByTestId("builder-schema")).toHaveTextContent('"title":"Updated title"');
    expect(screen.getByTestId("builder-schema")).toHaveTextContent('"description":"Updated description"');
  });

  it("reports source-text policy failures through the builder action pipeline", () => {
    const onChange = vi.fn();
    const onActionError = vi.fn();
    render(
      <FormBuilder schema={schema} onChange={onChange} policy={{ maxTextLength: 8 }} onActionError={onActionError} />
    );
    fireEvent.change(screen.getByLabelText("Form title"), { target: { value: "Title is too long" } });
    expect(onChange).not.toHaveBeenCalled();
    expect(onActionError).toHaveBeenCalledWith(
      { type: "max_text_length_exceeded", max: 8 },
      { action: "setSourceText", params: { kind: "form", property: "title" } }
    );
  });

  it("translates standard block, confirmation, and already-submitted messages", async () => {
    const user = userEvent.setup();
    const blocked = render(
      <FormRenderer
        schema={schema}
        translator={protectionTranslator}
        onSubmit={() => undefined}
        submissionGuards={[() => ({ status: "block", findings: [] })]}
      />
    );
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Localized blocked");
    blocked.unmount();

    const store = createReceiptStore();
    render(
      <FormRenderer
        schema={schema}
        translator={protectionTranslator}
        onSubmit={() => ({ submissionId: "localized-28" })}
        receiptStore={store}
        submissionGuards={[() => ({ status: "confirm", findings: [] })]}
      />
    );
    await user.click(await screen.findByRole("button", { name: "Submit" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("Localized confirmation");
    expect(screen.getByRole("button", { name: "Localized cancel" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Localized confirm" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Localized already submitted");
  });
});
