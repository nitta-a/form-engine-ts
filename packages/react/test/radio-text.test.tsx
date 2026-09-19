import type { FormSchema, FormValues } from "@form-engine-ts/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormRenderer } from "../src";

const schema: FormSchema = {
  id: "radio-text-renderer",
  version: 1,
  title: "Radio text",
  fields: [
    {
      id: "choice",
      type: "radio",
      title: "Choice",
      required: true,
      options: [
        { id: "yes", label: "Yes" },
        { id: "other", label: "Other", textInput: true }
      ]
    }
  ]
};

describe("radio option text input", () => {
  it("shows selected option text, clears it on another selection, and submits the option", async () => {
    const user = userEvent.setup();
    const submitted: FormValues[] = [];
    render(<FormRenderer schema={schema} onSubmit={(values) => void submitted.push(values)} />);

    await user.click(screen.getByLabelText("Other"));
    const text = screen.getByRole("textbox", { name: "Additional text for Other (optional)" });
    await user.type(text, "Something else");
    await user.click(screen.getByLabelText("Yes"));
    expect(screen.queryByRole("textbox", { name: "Additional text for Other (optional)" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(submitted).toEqual([{ choice: "yes" }]);
  });

  it("passes a compound answer and supports the text input slot", async () => {
    const user = userEvent.setup();
    const submitted: FormValues[] = [];
    render(
      <FormRenderer
        schema={schema}
        onSubmit={(values) => void submitted.push(values)}
        slots={{
          renderRadioTextInput: ({ inputId, value, onChange, label }) => (
            <input
              data-testid="custom-radio-text"
              id={inputId}
              aria-label={label}
              value={value}
              onChange={(event) => onChange(event.target.value)}
            />
          )
        }}
      />
    );

    await user.click(screen.getByLabelText("Other"));
    await user.type(screen.getByTestId("custom-radio-text"), "Details");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(submitted).toEqual([{ choice: { optionId: "other", text: "Details" } }]);
  });
});
