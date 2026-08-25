import type { FormSchema } from "@form-engine-ts/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  FormRenderer,
  type RenderSubmitButtonProps,
  type SubmissionReceipt,
  type SubmissionReceiptStore
} from "../src";

const schema: FormSchema = {
  id: "renderer-submission",
  version: 1,
  title: "Submission form",
  completionMessage: "Thanks for your response.",
  fields: [{ id: "name", type: "text", title: "Name", required: true, minLength: 2 }]
};

describe("FormRenderer submission presentation", () => {
  it("replaces the form after success and focuses the completion status", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);
    render(
      <FormRenderer
        schema={schema}
        onSubmit={onSubmit}
        successRenderMode="replace"
        slots={{ renderCompletion: ({ message }) => <span data-testid="completion">{message}</span> }}
      />
    );

    await user.type(screen.getByLabelText(/Name/), "Ada");
    expect(screen.getByLabelText(/Name/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Submit" }));
    const completion = await screen.findByRole("status");
    expect(completion).toHaveAttribute("aria-live", "polite");
    expect(completion).toHaveAttribute("tabindex", "-1");
    expect(completion).toHaveFocus();
    expect(screen.getByTestId("completion")).toHaveTextContent("Thanks for your response.");
    expect(screen.queryByLabelText(/Name/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it.each(["append", "replace"] as const)("blocks duplicate submits in %s mode", async (successRenderMode) => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);
    const { container } = render(
      <FormRenderer schema={schema} onSubmit={onSubmit} successRenderMode={successRenderMode} />
    );
    await user.type(screen.getByLabelText(/Name/), "Ada");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await screen.findByRole("status");

    const form = container.querySelector("form");
    if (form !== null) fireEvent.submit(form);
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("exposes the successful disabled state to the submit-button slot", async () => {
    const user = userEvent.setup();
    const slotProps: RenderSubmitButtonProps[] = [];
    const onSubmit = vi.fn(async () => undefined);
    render(
      <FormRenderer
        schema={schema}
        onSubmit={onSubmit}
        slots={{
          renderSubmitButton: (props) => {
            slotProps.push(props);
            return (
              <button type="button" disabled={props.disabled} onClick={props.onSubmit}>
                Submit
              </button>
            );
          }
        }}
      />
    );

    await user.type(screen.getByLabelText(/Name/), "Ada");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() =>
      expect(slotProps.at(-1)).toMatchObject({
        isSubmitting: false,
        submitStatus: "success",
        disabled: true
      })
    );
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });

  it("sets error status and permits retry after a rejected submission", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValueOnce(new Error("network unavailable")).mockResolvedValueOnce(undefined);
    render(<FormRenderer schema={schema} onSubmit={onSubmit} errorMessageKey="submission.error" />);
    await user.type(screen.getByLabelText(/Name/), "Ada");

    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Submit" })).not.toBeDisabled());
    expect(onSubmit).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("status")).toHaveTextContent("Thanks for your response.");
  });

  it("keeps guard confirmation locked and shows completion before receipt state on revisit", async () => {
    const user = userEvent.setup();
    let savedReceipt: SubmissionReceipt | null = null;
    const receiptStore: SubmissionReceiptStore = {
      async get() {
        return savedReceipt;
      },
      async save(receipt) {
        savedReceipt = receipt;
      },
      async remove() {
        savedReceipt = null;
      }
    };
    const onSubmit = vi.fn(async () => ({ submissionId: "submission-1" }));
    const { unmount } = render(
      <FormRenderer
        schema={schema}
        onSubmit={onSubmit}
        successRenderMode="replace"
        receiptStore={receiptStore}
        submissionGuards={[async () => ({ status: "confirm", findings: [], message: "Please confirm." })]}
      />
    );

    await user.type(await screen.findByLabelText(/Name/), "Ada");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Please confirm.");
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Proceed" }));
    const completion = await screen.findByRole("status");
    expect(completion).toHaveFocus();
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(savedReceipt).toMatchObject({ submissionId: "submission-1" });

    unmount();
    render(<FormRenderer schema={schema} onSubmit={onSubmit} receiptStore={receiptStore} />);
    expect(await screen.findByText("Already submitted.")).toBeInTheDocument();
  });
});
