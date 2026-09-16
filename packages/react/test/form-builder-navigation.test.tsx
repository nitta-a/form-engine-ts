import { fireEvent, render, screen } from "@testing-library/react";
import { FormBuilder } from "../src";

const schema = {
  id: "navigation-form",
  version: 1,
  title: "Navigation form",
  completionMessage: "Complete",
  fields: [
    { id: "first", type: "text" as const, title: "First", required: false },
    { id: "second", type: "text" as const, title: "Second", required: false }
  ]
};

describe("FormBuilder navigation", () => {
  it("supports a custom preview slot for non-selected questions", () => {
    const onActiveFieldChange = vi.fn();
    render(
      <FormBuilder
        schema={schema}
        onChange={() => undefined}
        fieldEditorMode="single"
        activeFieldId="first"
        onActiveFieldChange={onActiveFieldChange}
        features={{ pages: false, localization: false, conditions: false }}
        slots={{
          fieldEditorPreview: ({ field, index, totalFields, onSelect }) => (
            <button type="button" data-testid={`preview-${field.id}`} onClick={onSelect}>
              {index + 1}/{totalFields}: {field.title}
            </button>
          )
        }}
      />
    );

    expect(screen.getByTestId("preview-second")).toHaveTextContent("2/2: Second");
    fireEvent.click(screen.getByTestId("preview-second"));
    expect(onActiveFieldChange).toHaveBeenCalledWith("second");
  });

  it("hides configured sections without changing the field editor mode", () => {
    render(
      <FormBuilder
        schema={schema}
        onChange={() => undefined}
        fieldEditorMode="single"
        activeFieldId="second"
        sectionOrder={["basicSettings", "completionMessage", "questions"]}
        sectionVisibility={{ basicSettings: false, completionMessage: false }}
        features={{ pages: false, localization: false, conditions: false }}
      />
    );

    expect(screen.queryByLabelText("Form title")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Completion message")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Second")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "First" })).toBeInTheDocument();
  });

  it("shows common settings when the controlled active field is cleared", () => {
    const { rerender } = render(
      <FormBuilder
        schema={schema}
        onChange={() => undefined}
        fieldEditorMode="single"
        activeFieldId="second"
        sectionOrder={["basicSettings", "completionMessage", "questions"]}
        sectionVisibility={{ basicSettings: false, completionMessage: false }}
        features={{ pages: false, localization: false, conditions: false }}
      />
    );

    expect(screen.queryByLabelText("Form title")).not.toBeInTheDocument();

    rerender(
      <FormBuilder
        schema={schema}
        onChange={() => undefined}
        fieldEditorMode="single"
        activeFieldId={undefined}
        sectionOrder={["basicSettings", "completionMessage", "questions"]}
        sectionVisibility={{ basicSettings: true, completionMessage: true }}
        features={{ pages: false, localization: false, conditions: false }}
      />
    );

    expect(screen.getByLabelText("Form title")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Completion message" })).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Second")).not.toBeInTheDocument();
  });

  it("focuses the active field title when the active field changes", () => {
    const { rerender } = render(
      <FormBuilder
        schema={schema}
        onChange={() => undefined}
        fieldEditorMode="single"
        activeFieldId="first"
        autoFocusActiveField
        features={{ pages: false, localization: false, conditions: false }}
      />
    );

    expect(document.activeElement).not.toBe(screen.getByDisplayValue("First"));

    rerender(
      <FormBuilder
        schema={schema}
        onChange={() => undefined}
        fieldEditorMode="single"
        activeFieldId="second"
        autoFocusActiveField
        features={{ pages: false, localization: false, conditions: false }}
      />
    );

    expect(document.activeElement).toBe(screen.getByDisplayValue("Second"));
  });

  it("keeps all field editors visible without autofocus opt-in", () => {
    const { rerender } = render(
      <FormBuilder
        schema={schema}
        onChange={() => undefined}
        fieldEditorMode="all"
        activeFieldId="first"
        features={{ pages: false, localization: false, conditions: false }}
      />
    );

    expect(screen.getByDisplayValue("First")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Second")).toBeInTheDocument();

    rerender(
      <FormBuilder
        schema={schema}
        onChange={() => undefined}
        fieldEditorMode="all"
        activeFieldId="second"
        features={{ pages: false, localization: false, conditions: false }}
      />
    );

    expect(screen.getByDisplayValue("First")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Second")).toBeInTheDocument();
    expect(document.activeElement).not.toBe(screen.getByDisplayValue("Second"));
  });
});
