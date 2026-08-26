import type { FormSchema } from "@form-engine-ts/core";
import type { FieldEditorHeaderSlotProps, FieldTypeSelectSlotProps } from "@form-engine-ts/react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MuiFormBuilder, MuiSelectAdapter } from "../src";

const choiceSchema: FormSchema = {
  id: "rich-select-form",
  version: 1,
  title: "Rich select form",
  fields: [
    {
      id: "choice",
      type: "select",
      title: "Choice",
      required: true,
      options: [{ id: "one", label: "One" }]
    }
  ]
};

describe("MUI rich select options and FieldEditor slots", () => {
  it("renders option icons, descriptions, and the selected icon inline", () => {
    render(
      <MuiSelectAdapter
        id="choice"
        label="Choice"
        value="one"
        onChange={() => undefined}
        options={[
          { value: "one", label: "One", description: "The first choice", icon: <span data-testid="one-icon" /> }
        ]}
      />
    );

    expect(screen.getAllByTestId("one-icon")).toHaveLength(1);
    expect(screen.getByRole("combobox", { name: "Choice" })).toHaveAttribute("aria-haspopup", "listbox");
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Choice" }));
    expect(screen.getAllByTestId("one-icon")).toHaveLength(2);
    expect(screen.getByRole("option", { name: "One The first choice" })).toBeInTheDocument();
  });

  it("uses the fine-grained FieldEditor slots without replacing the editor", () => {
    const FieldTypeSelect = ({ currentType, onChangeType }: FieldTypeSelectSlotProps) => (
      <button type="button" data-testid="custom-type-select" onClick={() => onChangeType("textarea")}>
        {currentType}
      </button>
    );
    const FieldEditorHeader = ({ field, index, totalFields }: FieldEditorHeaderSlotProps) => (
      <header data-testid="custom-field-header">
        {field.title} {index + 1}/{totalFields}
      </header>
    );
    const onChange = vi.fn();

    render(
      <MuiFormBuilder
        schema={choiceSchema}
        onChange={onChange}
        features={{ pages: false, localization: false, conditions: false }}
        slots={{ fieldTypeSelect: FieldTypeSelect, fieldEditorHeader: FieldEditorHeader }}
      />
    );

    expect(screen.getByTestId("custom-field-header")).toHaveTextContent("Choice 1/1");
    expect(screen.getByTestId("custom-type-select")).toHaveTextContent("select");
    expect(screen.queryByRole("combobox", { name: "Type" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("custom-type-select"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ fields: [expect.objectContaining({ type: "textarea" })] })
    );
  });

  it("passes custom type icons and control props to MUI controls", () => {
    render(
      <MuiFormBuilder
        schema={choiceSchema}
        onChange={() => undefined}
        features={{ pages: false, localization: false, conditions: false }}
        components={{ renderFieldTypeIcon: (type) => <span data-testid={`icon-${type}`} /> }}
        muiSlotProps={{
          select: { variant: "filled", "data-testid": "custom-select" },
          textField: { "data-testid": "custom-input" }
        }}
      />
    );

    expect(screen.getAllByTestId("custom-input").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("custom-select").length).toBeGreaterThan(0);
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Type" }));
    expect(screen.getByTestId("icon-text")).toBeInTheDocument();
    expect(screen.getAllByTestId("icon-select").length).toBeGreaterThan(0);
  });
});
