import { FormBuilder, type FormBuilderComponents } from "@form-engine-ts/react";
import { fireEvent, render, screen } from "@testing-library/react";
import { createMuiBuilderComponents, muiBuilderComponents, muiDefaultIconResolver } from "../src";

const schema = {
  id: "mui-form",
  version: 1,
  title: "MUI form",
  fields: [{ id: "name", type: "text" as const, title: "Name", required: true }]
};

describe("@form-engine-ts/mui", () => {
  it("renders the builder with MUI controls and preserves accessible labels", () => {
    const onChange = vi.fn();
    render(<FormBuilder schema={schema} onChange={onChange} components={muiBuilderComponents} />);

    expect(screen.getByRole("textbox", { name: /Form title/u })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "質問文 / Question Title" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add question" })).toBeInTheDocument();
    expect(screen.getAllByText("質問文 / Question Title")).toHaveLength(1);
  });

  it("supports builder actions and component overrides", () => {
    const onChange = vi.fn();
    const custom: Partial<FormBuilderComponents> = {
      Button: ({ children, onClick, action: _action, targetId: _targetId, ...props }) => (
        <button type="button" {...props} onClick={onClick} data-testid="custom-button">
          {children}
        </button>
      )
    };
    render(<FormBuilder schema={schema} onChange={onChange} components={createMuiBuilderComponents(custom)} />);

    fireEvent.click(screen.getByRole("button", { name: "Add question" }));
    expect(onChange).toHaveBeenCalled();
    expect(screen.getAllByTestId("custom-button").length).toBeGreaterThan(0);
  });

  it("provides MUI icon mappings and uses a custom resolver", () => {
    expect(muiDefaultIconResolver("moveUp")).toBeTruthy();
    const resolver = vi.fn(() => <span data-testid="custom-icon" />);
    const components = createMuiBuilderComponents({ renderIcon: resolver });
    const onChange = vi.fn();
    render(<FormBuilder schema={schema} onChange={onChange} components={components} />);

    expect(resolver).toHaveBeenCalledWith("moveUp");
    expect(screen.getAllByTestId("custom-icon").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Delete Name" })).toBeInTheDocument();
  });
});
