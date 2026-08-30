import { FormBuilder, type FormBuilderComponents } from "@form-engine-ts/react";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  createMuiBuilderComponents,
  mergeMuiAdapterOptions,
  muiBuilderComponents,
  muiDefaultIconResolver,
  resolveMuiAdapterOptions
} from "../src";

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

  it("merges nested adapter options and applies defaults without mutating inputs", () => {
    const base = {
      buttonVariant: "outlined" as const,
      buttonVariants: { primary: "text" as const },
      layoutOptions: { sectionOrder: ["questions" as const] },
      fieldEditorOptions: { byType: { text: { title: "readOnly" as const } } },
      localizationOptions: { collapsible: true },
      localization: { workspaceOptions: { sourceLocale: "en" } }
    };
    const overrides = {
      buttonVariants: { danger: "text" as const },
      fieldEditorOptions: { byType: { number: { description: "hidden" as const } } },
      localizationOptions: { defaultExpanded: "always" as const },
      localization: { workspaceOptions: { targetLocale: "ja" } }
    };

    const merged = mergeMuiAdapterOptions(base, overrides);
    expect(merged).toEqual({
      buttonVariant: "outlined",
      buttonVariants: { primary: "text", danger: "text" },
      layoutOptions: { sectionOrder: ["questions"] },
      fieldEditorOptions: { byType: { text: { title: "readOnly" }, number: { description: "hidden" } } },
      localizationOptions: { collapsible: true, defaultExpanded: "always" },
      localization: { workspaceOptions: { sourceLocale: "en", targetLocale: "ja" } }
    });
    expect(base).toEqual({
      buttonVariant: "outlined",
      buttonVariants: { primary: "text" },
      layoutOptions: { sectionOrder: ["questions"] },
      fieldEditorOptions: { byType: { text: { title: "readOnly" } } },
      localizationOptions: { collapsible: true },
      localization: { workspaceOptions: { sourceLocale: "en" } }
    });
    expect(resolveMuiAdapterOptions(merged)).toMatchObject({
      size: "medium",
      variant: "outlined",
      buttonVariant: "outlined",
      buttonVariants: { primary: "text", secondary: "outlined", danger: "text" },
      fullWidth: true,
      inputFullWidth: true,
      buttonFullWidth: false,
      fieldEditorOptions: { byType: { text: { title: "readOnly" }, number: { description: "hidden" } } },
      localizationOptions: { collapsible: true, defaultExpanded: "always" }
    });
  });
});
