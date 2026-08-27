import type { FormSchema } from "@form-engine-ts/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormRenderer, type SubmissionReceipt, type SubmissionReceiptStore } from "../src";

const schema: FormSchema = {
  id: "renderer-confirmation",
  version: 1,
  title: "Review form",
  fields: [
    { id: "name", type: "text", title: "Name", required: true },
    {
      id: "team",
      type: "select",
      title: "Team",
      required: true,
      options: [
        { id: "design", label: "Design" },
        { id: "engineering", label: "Engineering" }
      ]
    }
  ]
};

function createReceiptStore() {
  let receipt: SubmissionReceipt | null = null;
  const save = vi.fn(async (nextReceipt: SubmissionReceipt) => {
    receipt = nextReceipt;
  });
  const store: SubmissionReceiptStore = {
    async get() {
      return receipt;
    },
    save,
    async remove() {
      receipt = null;
    }
  };
  return store;
}

describe("FormRenderer generic submission confirmation", () => {
  it("submits immediately when generic confirmation is disabled", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);
    render(<FormRenderer schema={schema} onSubmit={onSubmit} submissionConfirmation={{ enabled: false }} />);

    await user.type(screen.getByLabelText(/Name/), "Ada");
    await user.selectOptions(screen.getByLabelText(/Team/), "engineering");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(screen.queryByText("Review your answers")).not.toBeInTheDocument();
  });

  it("shows a replace-mode answer summary and returns to the form on cancel", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);
    render(
      <FormRenderer
        schema={schema}
        onSubmit={onSubmit}
        submissionConfirmation={{ enabled: true, renderMode: "replace" }}
      />
    );

    await user.type(screen.getByLabelText(/Name/), "Ada");
    await user.selectOptions(screen.getByLabelText(/Team/), "engineering");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    const confirmation = await screen.findByRole("dialog");
    expect(confirmation).toHaveTextContent("Name: Ada");
    expect(confirmation).toHaveTextContent("Team: Engineering");
    expect(onSubmit).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByLabelText(/Name/)).toHaveValue("Ada");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("confirms once and saves the receipt without duplicate submission", async () => {
    const user = userEvent.setup();
    const receiptStore = createReceiptStore();
    const onSubmit = vi.fn(async () => ({ submissionId: "confirmation-1" }));
    render(
      <FormRenderer
        schema={schema}
        onSubmit={onSubmit}
        receiptStore={receiptStore}
        submissionConfirmation={{ enabled: true, renderMode: "replace" }}
      />
    );

    await user.type(await screen.findByLabelText(/Name/), "Ada");
    await user.selectOptions(screen.getByLabelText(/Team/), "engineering");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    const confirmButton = await screen.findByRole("button", { name: "Proceed" });
    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Submitted."));
    expect(receiptStore.save).toHaveBeenCalledWith(
      expect.objectContaining({ formId: schema.id, formVersion: schema.version, submissionId: "confirmation-1" })
    );
  });
});
