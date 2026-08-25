import type { AsyncTranslationAdapter, FormSchema } from "@form-engine-ts/core";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import "@form-engine-ts/react/styles.css";
import {
  createMuiBuilderComponents,
  createMuiBuilderProps,
  createMuiCheckboxAdapter,
  createMuiIconButtonAdapter,
  createMuiTextInputAdapter,
  MuiButtonAdapter,
  MuiFormBuilder
} from "../src";

const schema: FormSchema = {
  id: "mui-integrated",
  version: 1,
  title: "MUI integrated form",
  defaultLocale: "en",
  supportedLocales: ["en", "ja"],
  fields: [
    {
      id: "choice",
      type: "select",
      title: "Choice",
      required: true,
      options: [
        { id: "first", label: "First" },
        { id: "second", label: "Second" }
      ]
    }
  ]
};

function Harness({ translationAdapter }: { readonly translationAdapter?: AsyncTranslationAdapter }) {
  const [current, setCurrent] = useState(schema);
  return (
    <>
      <MuiFormBuilder
        schema={current}
        onChange={setCurrent}
        muiOptions={{ size: "small", dense: true }}
        {...(translationAdapter === undefined ? {} : { translationAdapter })}
      />
      <output data-testid="schema-state">{JSON.stringify(current)}</output>
    </>
  );
}

describe("MuiFormBuilder", () => {
  it("forces unstyled mode and applies shared size and theme options", () => {
    const theme = createTheme({ palette: { primary: { main: "#123456" } }, shape: { borderRadius: 18 } });
    const { container } = render(
      <ThemeProvider theme={theme}>
        <MuiFormBuilder schema={schema} onChange={() => undefined} muiOptions={{ size: "small" }} />
      </ThemeProvider>
    );

    expect(container.querySelector('[class*="form-engine-builder"]')).toBeNull();
    expect(container.querySelector('[class*="feb-"]')).toBeNull();
    expect(container.querySelectorAll(".MuiInputBase-sizeSmall").length).toBeGreaterThan(0);
    for (const button of container.querySelectorAll(".MuiButton-root"))
      expect(button).toHaveClass("MuiButton-sizeSmall");
    for (const button of container.querySelectorAll(".MuiIconButton-root"))
      expect(button).toHaveClass("MuiIconButton-sizeSmall");

    const addButton = screen.getByRole("button", { name: "Add question" });
    expect(addButton).toHaveClass("MuiButton-colorPrimary");
    expect(Array.from(document.querySelectorAll("style")).some((style) => style.textContent?.includes("#123456"))).toBe(
      true
    );
    const root = container.querySelector<HTMLElement>('[aria-label="Form builder"]');
    expect(root).not.toBeNull();
    if (root !== null) expect(getComputedStyle(root).borderRadius).toBe("18px");
  });

  it("provides MUI layout slots without relying on React builder classes", () => {
    const { container } = render(<Harness />);

    expect(container.querySelector('[data-mui-slot="field-editor"]')).toBeInTheDocument();
    expect(container.querySelector('[data-mui-slot="option-editor"]')).toBeInTheDocument();
    expect(container.querySelector('[data-mui-slot="toolbar"]')).toBeInTheDocument();
    expect(container.querySelector('[data-mui-slot="localization"]')).toBeInTheDocument();
    const fieldEditor = container.querySelector<HTMLElement>('[data-mui-slot="field-editor"]');
    const toolbar = container.querySelector<HTMLElement>('[data-mui-slot="toolbar"]');
    expect(fieldEditor === null ? "" : getComputedStyle(fieldEditor).padding).not.toBe("0px");
    expect(toolbar === null ? "" : getComputedStyle(toolbar).display).toBe("flex");
  });

  it("supports type changes, option ordering and deletion, translation editing, translation batches, and adding fields", async () => {
    const user = userEvent.setup();
    const translationAdapter: AsyncTranslationAdapter = {
      translateText: vi.fn(async (text: string) => `ja:${text}`),
      translateBatch: vi.fn(async (texts: readonly string[]) => texts.map((text) => `ja:${text}`))
    };
    render(<Harness translationAdapter={translationAdapter} />);

    const fieldEditor = screen.getByText("Choice").closest<HTMLElement>('[data-mui-slot="field-editor"]');
    expect(fieldEditor).not.toBeNull();
    if (fieldEditor === null) return;
    await user.click(within(fieldEditor).getByRole("combobox", { name: /Type/u }));
    await user.click(screen.getByRole("option", { name: "radio" }));
    await waitFor(() => expect(screen.getByTestId("schema-state")).toHaveTextContent('"type":"radio"'));

    await user.click(screen.getByRole("button", { name: "Move Second up" }));
    await waitFor(() =>
      expect(screen.getByTestId("schema-state").textContent?.indexOf('"label":"Second"')).toBeLessThan(
        screen.getByTestId("schema-state").textContent?.indexOf('"label":"First"') ?? 0
      )
    );
    await user.click(screen.getByRole("button", { name: "Delete First" }));
    await waitFor(() => expect(screen.getByTestId("schema-state")).not.toHaveTextContent('"label":"First"'));

    await user.click(screen.getByRole("tab", { name: "ja" }));
    const translatedTitle = await screen.findByRole("textbox", { name: "Translated form title" });
    fireEvent.change(translatedTitle, { target: { value: "日本語タイトル" } });
    await waitFor(() => expect(screen.getByTestId("schema-state")).toHaveTextContent("日本語タイトル"));
    await user.click(screen.getByRole("button", { name: "Translate all text" }));
    await waitFor(() => expect(translationAdapter.translateBatch).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: "Add question" }));
    await waitFor(() =>
      expect(JSON.parse(screen.getByTestId("schema-state").textContent ?? "{}").fields).toHaveLength(2)
    );
  });

  it("links MUI error helper text through aria-describedby", () => {
    render(<MuiFormBuilder schema={{ ...schema, title: "" }} onChange={() => undefined} />);

    const title = screen.getByRole("textbox", { name: /Form title/u });
    expect(title).toHaveAttribute("aria-invalid", "true");
    expect(title).toHaveAttribute("aria-describedby", "builder-form-title-error");
    expect(document.getElementById("builder-form-title-error")).toHaveTextContent("Required");
  });

  it("forwards native input attributes and supplies action-aware icon tooltips", async () => {
    const user = userEvent.setup();
    const TextInput = createMuiTextInputAdapter({ size: "small" });
    const Checkbox = createMuiCheckboxAdapter({ size: "small" });
    const IconButton = createMuiIconButtonAdapter({ size: "small" });
    render(
      <>
        <span id="explicit-label">Explicit label</span>
        <TextInput
          id="native-input"
          name="nativeName"
          label="Native input"
          value="value"
          required
          readOnly
          error
          helperText="Input error"
          aria-describedby="native-input-error"
          aria-labelledby="explicit-label"
          onChange={() => undefined}
        />
        <Checkbox
          id="native-checkbox"
          name="consent"
          label="Consent"
          checked={false}
          required
          error
          helperText="Consent error"
          aria-describedby="native-checkbox-error"
          onChange={() => undefined}
        />
        <IconButton actionType="delete" icon={<span>icon</span>} onClick={() => undefined} />
      </>
    );

    const input = screen.getByRole("textbox", { name: "Explicit label" });
    expect(input).toHaveAttribute("id", "native-input");
    expect(input).toHaveAttribute("name", "nativeName");
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("readonly");
    expect(input).toHaveAttribute("aria-describedby", "native-input-error");
    expect(document.getElementById("native-input-error")).toHaveTextContent("Input error");
    const checkbox = screen.getByRole("checkbox", { name: "Consent" });
    expect(checkbox).toHaveAttribute("name", "consent");
    expect(checkbox).toBeRequired();
    expect(checkbox).toHaveAttribute("aria-describedby", "native-checkbox-error");
    expect(document.getElementById("native-checkbox-error")).toHaveTextContent("Consent error");
    const deleteButton = screen.getByRole("button", { name: "削除" });
    expect(deleteButton).toHaveClass("MuiIconButton-colorError", "MuiIconButton-sizeSmall");
    await user.hover(deleteButton);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("削除");
  });

  it("exports low-level builder props and individual adapter factories", () => {
    const CustomButton = () => <button type="button">Custom</button>;
    const props = createMuiBuilderProps({ size: "small", variant: "filled" });
    const components = createMuiBuilderComponents({}, { Button: CustomButton });
    expect(props.disableDefaultStyles).toBe(true);
    expect(props.components?.Button).toBeDefined();
    expect(props.slots?.fieldEditor).toBeDefined();
    expect(components.Button).toBe(CustomButton);
    expect(MuiButtonAdapter).toBeDefined();
    expect(createMuiTextInputAdapter({ size: "small" })).toBeTypeOf("function");
  });
});
