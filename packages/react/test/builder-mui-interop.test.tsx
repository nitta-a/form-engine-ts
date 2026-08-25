import { render, screen } from "@testing-library/react";
import type { BuilderTextInputProps, FormBuilderComponents } from "../src";
import { FormBuilder } from "../src";

const schema = {
  id: "interop-form",
  version: 1,
  title: "Interop form",
  fields: [{ id: "name", type: "text" as const, title: "Name", required: true }]
};

function LabelledTextInput({ id, label, value, onChange, error, helperText, ...props }: BuilderTextInputProps) {
  return (
    <div data-testid="custom-text-input">
      {label === undefined ? null : <label htmlFor={id}>{label}</label>}
      <input
        {...props}
        id={id}
        value={value}
        aria-invalid={error === true ? true : undefined}
        aria-describedby={props["aria-describedby"]}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      {helperText === undefined || helperText.length === 0 ? null : (
        <span id={props["aria-describedby"]}>{helperText}</span>
      )}
    </div>
  );
}

describe("FormBuilder design-system interop", () => {
  it("passes labels and error descriptions to injected inputs without an outer label", () => {
    const components: FormBuilderComponents = { TextInput: LabelledTextInput };
    render(
      <FormBuilder
        schema={{ ...schema, title: "" }}
        onChange={() => undefined}
        components={components}
        features={{ pages: false, localization: false, conditions: false }}
      />
    );

    expect(screen.getByLabelText("質問文 / Question Title")).toHaveAttribute("id", "builder-field-name-title");
    expect(screen.getAllByText("質問文 / Question Title")).toHaveLength(1);
    expect(screen.getByLabelText("Form title")).toHaveAttribute("aria-describedby", "builder-form-title-error");
    expect(document.getElementById("builder-form-title-error")).toHaveTextContent("Required");
  });

  it("suppresses default style classes with either opt-out prop", () => {
    const { container, rerender } = render(
      <FormBuilder
        schema={schema}
        onChange={() => undefined}
        disableDefaultStyles
        features={{ pages: false, localization: false, conditions: false }}
      />
    );
    expect(container.querySelector('[class*="form-engine-builder"]')).toBeNull();
    expect(container.querySelector('[class*="feb-"]')).toBeNull();

    rerender(
      <FormBuilder
        schema={schema}
        onChange={() => undefined}
        unstyled
        features={{ pages: false, localization: false, conditions: false }}
      />
    );
    expect(container.querySelector('[class*="form-engine-builder"]')).toBeNull();
    expect(container.querySelector('[class*="feb-"]')).toBeNull();
  });

  it("resolves custom icons by action type before fallback icons", () => {
    const components: FormBuilderComponents = {
      renderIcon: (actionType) => <span data-testid={`icon-${actionType}`} />
    };
    render(<FormBuilder schema={schema} onChange={() => undefined} components={components} />);

    expect(screen.getByTestId("icon-moveUp")).toBeInTheDocument();
    expect(screen.getByTestId("icon-moveDown")).toBeInTheDocument();
    expect(screen.getByTestId("icon-delete")).toBeInTheDocument();
  });
});
