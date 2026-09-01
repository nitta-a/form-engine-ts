import type { FormSchema } from "@form-engine-ts/core";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { FormRenderer } from "../src";

const schema: FormSchema = {
  id: "a11y-form",
  version: 1,
  title: "Accessible survey",
  fields: [
    { id: "text", type: "text", title: "Name", required: true },
    { id: "textarea", type: "textarea", title: "Details", required: false },
    { id: "number", type: "number", title: "Age", min: 0, max: 120, required: false },
    { id: "rating", type: "rating", title: "Rating", min: 1, max: 5, required: true },
    {
      id: "radio",
      type: "radio",
      title: "Contact",
      required: true,
      options: [
        { id: "email", label: "Email" },
        { id: "phone", label: "Phone" }
      ]
    },
    {
      id: "select",
      type: "select",
      title: "Team",
      required: true,
      options: [{ id: "support", label: "Support" }]
    },
    { id: "checkbox", type: "checkbox", title: "Agree", required: true },
    {
      id: "multi",
      type: "multi-select",
      title: "Channels",
      required: true,
      options: [{ id: "email", label: "Email" }]
    }
  ]
};

describe("standard FormRenderer accessibility", () => {
  it.each([false, true])("has no axe violations in %s layout", async (groupedChoiceFields) => {
    const { container } = render(
      <FormRenderer schema={schema} groupedChoiceFields={groupedChoiceFields} onSubmit={() => undefined} />
    );
    const result = await axe.run(container);
    expect(result.violations).toEqual([]);
  });

  it("keeps group ARIA attributes valid while exposing errors on controls", async () => {
    const user = userEvent.setup();
    render(<FormRenderer schema={schema} groupedChoiceFields onSubmit={() => undefined} />);

    const radioGroup = screen.getByRole("group", { name: "Contact" });
    expect(radioGroup).not.toHaveAttribute("aria-required");
    expect(radioGroup).not.toHaveAttribute("aria-invalid");
    expect(within(radioGroup).getByLabelText("Email")).toHaveAttribute("required");

    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(within(radioGroup).getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  });
});
