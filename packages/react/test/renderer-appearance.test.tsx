import type { FormSchema, FormValues } from "@form-engine-ts/core";
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
    {
      id: "channels",
      type: "multi-select",
      title: "Preferred channels",
      required: true,
      options: [
        { id: "email", label: "Email" },
        { id: "phone", label: "Phone" },
        { id: "chat", label: "Chat" }
      ]
    },
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
    expect(container.querySelector('[data-field-id="choice"]')).not.toHaveClass("fe-choice-group");
    expect(container.querySelector('[data-field-id="consent"]')).not.toHaveClass("fe-choice-group");
    expect(container.querySelector('[data-field-id="channels"]')).toHaveClass("fe-field--multi-select");
    expect(container.querySelector('[data-field-id="channels"]')).not.toHaveClass("fe-choice-group");
    expect(screen.getByLabelText("Name")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Team").tagName).toBe("SELECT");
  });

  it("renders radio, checkbox, and multi-select fields as accessible grouped controls", async () => {
    const user = userEvent.setup();
    let submittedValues: FormValues | undefined;
    render(
      <FormRenderer
        schema={schema}
        appearance={{ choiceField: "grouped" }}
        onSubmit={(values) => {
          submittedValues = values;
        }}
      />
    );

    const radioGroup = screen.getByRole("group", { name: "Preferred contact" });
    const checkboxGroup = screen.getByRole("group", { name: "Agree to the terms" });
    const multiSelectGroup = screen.getByRole("group", { name: "Preferred channels" });
    expect(radioGroup).toHaveClass("fe-choice-group");
    expect(checkboxGroup).toHaveAttribute("aria-required", "true");
    expect(checkboxGroup).toHaveAttribute("aria-invalid", "false");
    expect(multiSelectGroup).toHaveClass("fe-choice-group");
    expect(multiSelectGroup).toHaveClass("fe-field--multi-select");

    const email = within(radioGroup).getByLabelText("Email");
    const phone = within(radioGroup).getByLabelText("Phone");
    await user.click(email);
    expect(email).toBeChecked();
    await user.keyboard("{ArrowDown}");
    expect(phone).toBeChecked();

    const consent = screen.getByLabelText("Agree to the terms");
    consent.focus();
    await user.keyboard(" ");
    expect(consent).toBeChecked();

    const channels = within(multiSelectGroup);
    const emailChannel = channels.getByLabelText("Email");
    const phoneChannel = channels.getByLabelText("Phone");
    await user.click(emailChannel);
    await user.click(phoneChannel);
    expect(emailChannel).toBeChecked();
    expect(phoneChannel).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(submittedValues?.channels).toEqual(["email", "phone"]);

    emailChannel.focus();
    await user.keyboard(" ");
    expect(emailChannel).not.toBeChecked();
    await user.tab();
    expect(phoneChannel).toHaveFocus();
    await user.keyboard(" ");
    expect(phoneChannel).not.toBeChecked();
    await user.click(phoneChannel);
  });

  it("resolves choice layouts independently by question type", () => {
    const { container } = render(
      <FormRenderer
        schema={schema}
        appearance={{ choiceField: { radio: "grouped", checkbox: "default" } }}
        onSubmit={() => undefined}
      />
    );

    expect(container.querySelector('[data-field-id="choice"]')).toHaveClass("fe-choice-group");
    expect(container.querySelector('[data-field-id="choice"]')?.tagName).toBe("FIELDSET");
    expect(container.querySelector('[data-field-id="consent"]')).not.toHaveClass("fe-choice-group");
    expect(container.querySelector('[data-field-id="consent"]')?.tagName).toBe("DIV");
    expect(container.querySelector('[data-field-id="channels"]')).not.toHaveClass("fe-choice-group");
  });

  it("replaces the standard grouped wrapper with renderChoiceGroup", () => {
    render(
      <FormRenderer
        schema={schema}
        appearance={{ choiceField: { radio: "grouped" } }}
        slots={{
          renderChoiceGroup: ({ field, children }) => <div data-testid={`custom-group-${field.id}`}>{children}</div>
        }}
        onSubmit={() => undefined}
      />
    );

    expect(screen.getByTestId("custom-group-choice")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Preferred contact" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("custom-group-consent")).not.toBeInTheDocument();
  });

  it("places required errors inside grouped fieldsets and marks them invalid", async () => {
    const user = userEvent.setup();
    render(<FormRenderer schema={schema} appearance={{ choiceField: "grouped" }} onSubmit={() => undefined} />);

    await user.click(screen.getByRole("button", { name: "Submit" }));

    const radioGroup = screen.getByRole("group", { name: "Preferred contact" });
    const checkboxGroup = screen.getByRole("group", { name: "Agree to the terms" });
    const multiSelectGroup = screen.getByRole("group", { name: "Preferred channels" });
    expect(radioGroup).toHaveAttribute("aria-invalid", "true");
    expect(checkboxGroup).toHaveAttribute("aria-invalid", "true");
    expect(multiSelectGroup).toHaveAttribute("aria-invalid", "true");
    expect(within(radioGroup).getByRole("alert")).toHaveClass("fe-field-error");
    expect(within(checkboxGroup).getByRole("alert")).toHaveClass("fe-field-error");
    expect(within(multiSelectGroup).getByRole("alert")).toHaveClass("fe-field-error");
    expect(radioGroup.getAttribute("aria-describedby")).toMatch(/choice-error/);
  });
});
