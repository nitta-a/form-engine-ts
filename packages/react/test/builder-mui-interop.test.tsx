import type { TranslationAdapter } from "@form-engine-ts/core";
import { render, screen } from "@testing-library/react";
import type {
  BuilderFieldEditorSlotProps,
  BuilderLocalizationSlotProps,
  BuilderOptionEditorSlotProps,
  BuilderPagesSlotProps,
  BuilderTextInputProps,
  BuilderToolbarSlotProps,
  BuilderTranslationActionsSlotProps,
  FormBuilderComponents
} from "../src";
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

  it("passes the resolved translator to every builder slot", () => {
    const translator: TranslationAdapter = {
      translate: (key) => `translated:${key}`
    };
    const Toolbar = ({ translate }: BuilderToolbarSlotProps) => (
      <span data-testid="translated-toolbar">{translate("builder.actions.edit")}</span>
    );
    const FieldEditor = ({ translate }: BuilderFieldEditorSlotProps) => (
      <span data-testid="translated-field">{translate("builder.questionTitle")}</span>
    );
    const OptionEditor = ({ translate }: BuilderOptionEditorSlotProps) => (
      <span data-testid="translated-option">{translate("builder.optionLabel", { index: 1 })}</span>
    );
    const Pages = ({ translate }: BuilderPagesSlotProps) => (
      <span data-testid="translated-pages">{translate("builder.pages")}</span>
    );
    const Localization = ({ translate }: BuilderLocalizationSlotProps) => (
      <span data-testid="translated-localization">{translate("builder.localization")}</span>
    );
    const TranslationActions = ({ translate }: BuilderTranslationActionsSlotProps) => (
      <span data-testid="translated-actions">{translate("builder.autoTranslate")}</span>
    );
    const choiceSchema = {
      ...schema,
      defaultLocale: "en",
      supportedLocales: ["ja"],
      pages: [{ id: "page-1", title: "Page", questionIds: ["name"] }],
      fields: [
        {
          id: "choice",
          type: "select" as const,
          title: "Choice",
          required: true,
          options: [{ id: "one", label: "One" }]
        }
      ]
    };

    render(
      <>
        <FormBuilder
          schema={choiceSchema}
          onChange={() => undefined}
          translator={translator}
          slots={{
            toolbar: Toolbar,
            optionEditor: OptionEditor,
            pages: Pages,
            translationActions: TranslationActions
          }}
        />
        <FormBuilder
          schema={choiceSchema}
          onChange={() => undefined}
          translator={translator}
          slots={{ fieldEditor: FieldEditor }}
        />
        <FormBuilder
          schema={choiceSchema}
          onChange={() => undefined}
          translator={translator}
          slots={{ localization: Localization }}
        />
      </>
    );

    expect(screen.getByTestId("translated-toolbar")).toHaveTextContent("translated:builder.actions.edit");
    expect(screen.getByTestId("translated-field")).toHaveTextContent("translated:builder.questionTitle");
    expect(screen.getByTestId("translated-option")).toHaveTextContent("translated:builder.optionLabel");
    expect(screen.getByTestId("translated-pages")).toHaveTextContent("translated:builder.pages");
    expect(screen.getByTestId("translated-localization")).toHaveTextContent("translated:builder.localization");
    expect(screen.getByTestId("translated-actions")).toHaveTextContent("translated:builder.autoTranslate");
  });
});
