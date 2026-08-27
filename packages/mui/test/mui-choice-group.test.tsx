import type { FormSchema } from "@form-engine-ts/core";
import { FormRenderer } from "@form-engine-ts/react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MuiChoiceGroupSlot } from "../src";

const schema: FormSchema = {
  id: "mui-choice-group",
  version: 1,
  title: "MUI choice group",
  fields: [
    {
      id: "contact",
      type: "radio",
      title: "Preferred contact",
      required: true,
      options: [
        { id: "email", label: "Email" },
        { id: "phone", label: "Phone" }
      ]
    }
  ]
};

describe("MuiChoiceGroupSlot", () => {
  it("renders a themed MUI wrapper and exposes the field legend", () => {
    render(
      <FormRenderer
        schema={schema}
        appearance={{ choiceField: "grouped" }}
        slots={{ renderChoiceGroup: MuiChoiceGroupSlot }}
        onSubmit={() => undefined}
      />
    );

    expect(document.querySelector(".MuiPaper-root")).toBeInTheDocument();
    expect(screen.getByText("Preferred contact")).toHaveClass("MuiFormLabel-root");
    expect(screen.getByRole("radio", { name: "Email" })).toBeInTheDocument();
  });

  it("uses the error color when the grouped field is invalid", async () => {
    const user = userEvent.setup();
    render(
      <FormRenderer
        schema={schema}
        appearance={{ choiceField: "grouped" }}
        slots={{ renderChoiceGroup: MuiChoiceGroupSlot }}
        onSubmit={() => undefined}
      />
    );

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(screen.getByText("This field is required.")).toHaveClass("Mui-error");
    expect(screen.getByRole("group", { name: "Preferred contact" })).toBeInTheDocument();
    expect(screen.getByText("Preferred contact")).toHaveClass("Mui-error");
  });
});
