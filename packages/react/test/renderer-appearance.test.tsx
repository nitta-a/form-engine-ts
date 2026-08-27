import type { FormSchema } from "@form-engine-ts/core";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormRenderer } from "../src";

const schema: FormSchema = {
  id: "renderer-appearance",
  version: 1,
  title: "Appearance form",
  fields: [
    {
      id: "choice",
      type: "radio",
      title: "Preferred contact",
      required: true,
      options: [
        { id: "email", label: "Email" },
        { id: "phone", label: "Phone" }
      ]
    },
    { id: "consent", type: "checkbox", title: "Agree to the terms", required: true },
    { id: "name", type: "text", title: "Name", required: false },
    {
      id: "team",
      type: "select",
      title: "Team",
      required: false,
      options: [{ id: "support", label: "Support" }]
    }
  ]
};

describe("FormRenderer choice-field appearance", () => {
  it("keeps radio and checkbox fields flat by default without affecting other fields", () => {
    const { container } = render(<FormRenderer schema={schema} onSubmit={() => undefined} />);

    expect(container.querySelector('[data-field-id="choice"]')?.tagName).toBe("DIV");
    expect(container.querySelector('[data-field-id="consent"]')?.tagName).toBe("DIV");
    expect(container.querySelector("fieldset")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Team").tagName).toBe("SELECT");
  });

  it("renders radio and checkbox fields as accessible grouped controls", async () => {
    const user = userEvent.setup();
    render(<FormRenderer schema={schema} appearance={{ choiceField: "grouped" }} onSubmit={() => undefined} />);

    const radioGroup = screen.getByRole("group", { name: "Preferred contact" });
    const checkboxGroup = screen.getByRole("group", { name: "Agree to the terms" });
    expect(radioGroup).toHaveClass("fe-choice-group");
    expect(checkboxGroup).toHaveAttribute("aria-required", "true");
    expect(checkboxGroup).toHaveAttribute("aria-invalid", "false");

    const email = screen.getByLabelText("Email");
    const phone = screen.getByLabelText("Phone");
    await user.click(email);
    expect(email).toBeChecked();
    await user.keyboard("{ArrowDown}");
    expect(phone).toBeChecked();

    const consent = screen.getByLabelText("Agree to the terms");
    consent.focus();
    await user.keyboard(" ");
    expect(consent).toBeChecked();
  });

  it("places required errors inside grouped fieldsets and marks them invalid", async () => {
    const user = userEvent.setup();
    render(<FormRenderer schema={schema} appearance={{ choiceField: "grouped" }} onSubmit={() => undefined} />);

    await user.click(screen.getByRole("button", { name: "Submit" }));

    const radioGroup = screen.getByRole("group", { name: "Preferred contact" });
    const checkboxGroup = screen.getByRole("group", { name: "Agree to the terms" });
    expect(radioGroup).toHaveAttribute("aria-invalid", "true");
    expect(checkboxGroup).toHaveAttribute("aria-invalid", "true");
    expect(within(radioGroup).getByRole("alert")).toHaveClass("fe-field-error");
    expect(within(checkboxGroup).getByRole("alert")).toHaveClass("fe-field-error");
    expect(radioGroup.getAttribute("aria-describedby")).toMatch(/choice-error/);
  });
});
