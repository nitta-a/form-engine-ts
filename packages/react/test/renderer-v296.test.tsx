import type { FormSchema } from "@form-engine-ts/core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormRenderer, FormSubmissionError } from "../src";

const summarySchema: FormSchema = {
  id: "v296-summary",
  version: 1,
  title: "Summary",
  completionMessage: "Complete",
  fields: [
    {
      id: "choice",
      type: "radio",
      title: "Choice",
      required: true,
      options: [
        { id: "a", label: "Option A" },
        { id: "b", label: "Option B" }
      ]
    },
    {
      id: "multiple",
      type: "multi-select",
      title: "Multiple",
      required: false,
      options: [
        { id: "x", label: "Option X" },
        { id: "y", label: "Option Y" }
      ]
    },
    {
      id: "hidden",
      type: "text",
      title: "Hidden",
      required: false,
      displayCondition: { questionId: "choice", operator: "equals", value: "never" }
    }
  ]
};

describe("v2.9.6 renderer features", () => {
  it("passes localized choice labels and excludes hidden answers from the default summary", async () => {
    const user = userEvent.setup();
    const completion = vi.fn((_props: { readonly message: string }) => null);
    render(<FormRenderer schema={summarySchema} onSubmit={() => undefined} slots={{ renderCompletion: completion }} />);

    await user.click(screen.getByLabelText("Option A"));
    await user.click(screen.getByLabelText("Option X"));
    await user.click(screen.getByLabelText("Option Y"));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(completion).toHaveBeenCalled());
    expect(completion.mock.lastCall?.[0]).toMatchObject({
      answers: { choice: "a", multiple: ["x", "y"] },
      submittedItems: [
        { fieldId: "choice", displayValue: "Option A", visible: true },
        { fieldId: "multiple", displayValue: "Option X, Option Y", visible: true }
      ]
    });
  });

  it("maps server field errors, preserves values, and focuses the first invalid field", async () => {
    const user = userEvent.setup();
    const schema: FormSchema = {
      id: "v296-server",
      version: 1,
      title: "Server errors",
      fields: [
        { id: "first", type: "text", title: "First", required: false },
        { id: "second", type: "text", title: "Second", required: false }
      ]
    };
    render(
      <FormRenderer
        schema={schema}
        onSubmit={async () => {
          throw new FormSubmissionError({
            code: "VALIDATION_FAILED",
            messageKey: "submission.validation",
            fieldErrors: { second: "This value is already used." },
            formErrors: ["Please correct the highlighted fields."]
          });
        }}
      />
    );

    await user.type(screen.getByLabelText("First"), "kept");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(screen.getByLabelText("Second")).toHaveFocus());
    expect(screen.getByLabelText("First")).toHaveValue("kept");
    expect(screen.getByText("This value is already used.")).toBeInTheDocument();
    expect(screen.getByText("Please correct the highlighted fields.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).not.toBeDisabled();
  });

  it("supports dialog confirmation cancellation with Escape and restores submit focus", async () => {
    const user = userEvent.setup();
    render(
      <FormRenderer
        schema={summarySchema}
        onSubmit={() => undefined}
        submissionConfirmationRenderMode="dialog"
        submissionGuards={[() => ({ status: "confirm", findings: [] })]}
      />
    );

    await user.click(screen.getByLabelText("Option A"));
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.getByRole("button", { name: "Submit" })).toHaveFocus());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("applies fieldsClassName to the default fields wrapper", () => {
    const { container } = render(
      <FormRenderer schema={summarySchema} onSubmit={() => undefined} fieldsClassName="custom" />
    );
    expect(container.querySelector(".fe-fields.custom")).toBeInTheDocument();
  });
});
