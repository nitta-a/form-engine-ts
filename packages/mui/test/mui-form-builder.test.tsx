import type { AsyncTranslationAdapter, FormSchema, TranslationAdapter } from "@form-engine-ts/core";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import "@form-engine-ts/react/styles.css";
import {
  createMuiBuilderComponents,
  createMuiBuilderProps,
  createMuiButtonAdapter,
  createMuiCheckboxAdapter,
  createMuiIconButtonAdapter,
  createMuiTextInputAdapter,
  MuiButtonAdapter,
  MuiFormBuilder,
  type MuiFormBuilderProps
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

function MetadataHarness({
  createManualTranslationMetadata
}: {
  readonly createManualTranslationMetadata: NonNullable<MuiFormBuilderProps["createManualTranslationMetadata"]>;
}) {
  const [current, setCurrent] = useState<FormSchema>({
    ...schema,
    translationMetadata: { ja: { title: { previous: "metadata" } } }
  });
  return (
    <>
      <MuiFormBuilder
        schema={current}
        onChange={setCurrent}
        createManualTranslationMetadata={createManualTranslationMetadata}
      />
      <output data-testid="metadata-schema-state">{JSON.stringify(current)}</output>
    </>
  );
}

function InlineOptionsControlledHarness() {
  const [current, setCurrent] = useState(schema);
  return (
    <>
      <MuiFormBuilder
        schema={current}
        onChange={setCurrent}
        muiOptions={{ size: "small" }}
        localizationOptions={{ collapsible: true }}
      />
      <output data-testid="focus-schema-state">{JSON.stringify(current)}</output>
    </>
  );
}

function LocalizationOptionsHarness() {
  const [current, setCurrent] = useState<FormSchema>({ ...schema, supportedLocales: ["en"] });
  return (
    <MuiFormBuilder
      schema={current}
      onChange={setCurrent}
      localizationOptions={{ showSummary: true, emptyStateMessage: "Add a translation language above." }}
    />
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
    await user.click(screen.getByRole("option", { name: "Radio" }));
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
  }, 30000);

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
    const IconButton = createMuiIconButtonAdapter({
      size: "small",
      getActionLabel: (actionType) => `Localized ${actionType}`
    });
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
    const deleteButton = screen.getByRole("button", { name: "Localized delete" });
    expect(deleteButton).toHaveClass("MuiIconButton-colorError", "MuiIconButton-sizeSmall");
    await user.hover(deleteButton);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Localized delete");
  });

  it("uses the builder translator and injected locale labels throughout MUI slots", async () => {
    const user = userEvent.setup();
    const dictionary: Readonly<Record<string, string>> = {
      "builder.formBuilder": "JP: builder",
      "builder.basicSettings": "JP: basic",
      "builder.formTitle": "JP: form title",
      "builder.formDescription": "JP: form description",
      "builder.completionMessage": "JP: completion",
      "builder.pages": "JP: pages",
      "builder.enablePages": "JP: enable pages",
      "builder.questionTitle": "JP: question",
      "builder.type": "JP: type",
      "builder.description": "JP: description",
      "builder.required": "JP: required",
      "builder.options": "JP: options",
      "builder.optionLabel": "JP: option {{index}}",
      "builder.addOption": "JP: add option",
      "builder.moveUp": "JP: move {{title}} up",
      "builder.moveDown": "JP: move {{title}} down",
      "builder.delete": "JP: delete {{title}}",
      "builder.localization": "JP: localization",
      "builder.defaultLocale": "JP: default locale",
      "builder.addLocale": "JP: add locale",
      "builder.translationLocale": "JP: translation locale",
      "builder.selectLocale": "JP: select locale",
      "builder.translatedFormTitle": "JP: translated form title",
      "builder.translatedFormDescription": "JP: translated form description",
      "builder.translatedCompletionMessage": "JP: translated completion",
      "builder.translatedQuestionTitle": "JP: translated question",
      "builder.translatedDescription": "JP: translated description",
      "builder.translation": "JP: {{locale}} translation",
      "builder.fieldType.text": "JP: text",
      "builder.fieldType.textarea": "JP: textarea",
      "builder.fieldType.number": "JP: number",
      "builder.fieldType.rating": "JP: rating",
      "builder.fieldType.select": "JP: select",
      "builder.fieldType.multi-select": "JP: multi-select",
      "builder.fieldType.checkbox": "JP: checkbox",
      "builder.fieldType.radio": "JP: radio",
      "builder.addQuestion": "JP: add question"
    };
    const translator: TranslationAdapter = {
      translate: (key, _locale, params = {}) => {
        const template = dictionary[key] ?? `JP: ${key}`;
        return template.replace(/\{\{(\w+)\}\}/gu, (token, name: string) =>
          Object.hasOwn(params, name) ? String(params[name]) : token
        );
      }
    };
    render(
      <MuiFormBuilder
        schema={{
          ...schema,
          fields: [...schema.fields, { id: "notes", type: "textarea", title: "Notes", required: false }]
        }}
        onChange={() => undefined}
        locale="ja"
        translator={translator}
        muiOptions={{ getLocaleLabel: (locale) => (locale === "ja" ? "日本語" : "English") }}
      />
    );

    expect(screen.getByRole("textbox", { name: "JP: form title" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "日本語" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "English" })).not.toBeInTheDocument();
    const fieldEditor = screen.getByText("Choice").closest<HTMLElement>('[data-mui-slot="field-editor"]');
    expect(fieldEditor).not.toBeNull();
    if (fieldEditor === null) return;
    expect(within(fieldEditor).getByRole("button", { name: "JP: delete Choice" })).toBeInTheDocument();
    await user.hover(within(fieldEditor).getByRole("button", { name: "JP: delete Choice" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("JP: delete Choice");
    expect(screen.queryByText("Localization")).not.toBeInTheDocument();
  });

  it("matches feature and policy guards for conditions, pages, field types, and locales", async () => {
    const user = userEvent.setup();
    const guardedSchema: FormSchema = {
      ...schema,
      pages: [{ id: "page-1", title: "First page", questionIds: ["source", "choice"] }],
      fields: [
        { id: "source", type: "text", title: "Source", required: true },
        {
          id: "choice",
          type: "select",
          title: "Choice",
          required: true,
          displayCondition: { questionId: "source", operator: "equals", value: "show" },
          options: schema.fields[0]?.type === "select" ? schema.fields[0].options : []
        }
      ]
    };
    render(
      <MuiFormBuilder
        schema={guardedSchema}
        onChange={() => undefined}
        features={{ conditions: false, pages: false }}
        policy={{ allowedFieldTypes: ["select"], allowedLocales: ["en", "ja", "zh"], maxLocales: 2 }}
        muiOptions={{ getLocaleLabel: (locale) => ({ en: "English", ja: "日本語", zh: "中文" })[locale] ?? locale }}
      />
    );

    expect(screen.queryByLabelText("Display condition")).not.toBeInTheDocument();
    expect(screen.queryByText("Page manager")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Page")).not.toBeInTheDocument();
    const choiceEditor = screen.getByText("Choice").closest<HTMLElement>('[data-mui-slot="field-editor"]');
    expect(choiceEditor).not.toBeNull();
    if (choiceEditor === null) return;
    await user.click(within(choiceEditor).getByRole("combobox", { name: "Type" }));
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option", { name: "Select" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tab", { name: "English" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "日本語" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add locale" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Translate all text" })).not.toBeInTheDocument();
  });

  it("orders independent sections and applies collapsible, semantic variant, and slot-prop options", () => {
    const Button = createMuiButtonAdapter({
      buttonVariants: { primary: "contained", danger: "outlined" },
      fullWidth: false
    });
    const { container } = render(
      <>
        <MuiFormBuilder
          schema={schema}
          onChange={() => undefined}
          layoutOptions={{
            sectionOrder: ["basicSettings", "completionMessage", "questions", "addQuestion", "localization"]
          }}
          localizationOptions={{ collapsible: true, defaultExpanded: "when-configured" }}
          muiSlotProps={{ card: { sx: { p: "40px" } }, accordion: { elevation: 0 } }}
        />
        <Button variant="danger" onClick={() => undefined}>
          Danger action
        </Button>
      </>
    );

    const ordered = [
      document.getElementById("builder-basic-settings-heading"),
      document.getElementById("builder-completion-message-heading"),
      container.querySelector('[data-mui-slot="field-editor"]'),
      screen.getByRole("button", { name: "Add question" }),
      container.querySelector('[data-mui-slot="localization"]')
    ];
    expect(ordered.every((element) => element !== null)).toBe(true);
    for (let index = 0; index < ordered.length - 1; index += 1) {
      expect(
        (ordered[index]?.compareDocumentPosition(ordered[index + 1] as Node) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    }
    expect(screen.getByRole("button", { name: "Localization" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Danger action" })).toHaveClass("MuiButton-outlinedError");
    const fieldEditor = container.querySelector<HTMLElement>('[data-mui-slot="field-editor"]');
    expect(fieldEditor === null ? "" : getComputedStyle(fieldEditor).padding).toBe("40px");
  });

  it("stores metadata for manual form, field, and option translations from MUI slots", async () => {
    const user = userEvent.setup();
    const metadataFactory: NonNullable<MuiFormBuilderProps["createManualTranslationMetadata"]> = vi.fn((context) => ({
      isManuallyEdited: true,
      translationSource: "MANUAL",
      sourceText: context.sourceText
    }));
    render(<MetadataHarness createManualTranslationMetadata={metadataFactory} />);

    await user.click(screen.getByRole("tab", { name: "ja" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Translated form title" }), {
      target: { value: "フォーム" }
    });
    fireEvent.change(await screen.findByRole("textbox", { name: "Translated question title" }), {
      target: { value: "質問" }
    });
    const optionTranslation = document.getElementById("mui-option-first-ja");
    expect(optionTranslation).not.toBeNull();
    if (optionTranslation === null) return;
    fireEvent.change(optionTranslation, { target: { value: "選択肢" } });

    await waitFor(() => {
      const current = JSON.parse(screen.getByTestId("metadata-schema-state").textContent ?? "{}");
      expect(current.translationMetadata.ja.title).toEqual({
        isManuallyEdited: true,
        translationSource: "MANUAL",
        sourceText: "MUI integrated form"
      });
      expect(current.fields[0].translationMetadata.ja.title.sourceText).toBe("Choice");
      expect(current.fields[0].options[0].translationMetadata.ja.label.sourceText).toBe("First");
    });
    expect(metadataFactory).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "form",
        sourceText: "MUI integrated form",
        existingTranslationMetadata: { previous: "metadata" }
      })
    );
  });

  it("controls description/default-locale visibility and separates input and button widths", async () => {
    const user = userEvent.setup();
    render(
      <MuiFormBuilder
        schema={{
          ...schema,
          fields: schema.fields.map((field, index) =>
            index === 0 ? { ...field, description: "Source description" } : field
          )
        }}
        onChange={() => undefined}
        muiOptions={{
          inputFullWidth: true,
          buttonFullWidth: false,
          fieldEditorOptions: { description: "hidden" }
        }}
        localizationOptions={{ defaultLocaleControl: "readOnly" }}
      />
    );

    expect(screen.queryByRole("textbox", { name: "Description" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Default locale" })).not.toBeInTheDocument();
    expect(screen.getByText("en")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "ja" }));
    expect(screen.queryByRole("textbox", { name: "Translated description" })).not.toBeInTheDocument();
    const formTitle = screen.getByRole("textbox", { name: "Form title" });
    expect(formTitle.closest(".MuiTextField-root")).toHaveClass("MuiFormControl-fullWidth");
    expect(screen.getByRole("button", { name: "Add question" })).not.toHaveClass("MuiButton-fullWidth");
  });

  it("supports read-only descriptions and a fully hidden default-locale control", async () => {
    const user = userEvent.setup();
    render(
      <MuiFormBuilder
        schema={{
          ...schema,
          fields: schema.fields.map((field, index) =>
            index === 0 ? { ...field, description: "Source description" } : field
          )
        }}
        onChange={() => undefined}
        muiOptions={{ fieldEditorOptions: { description: "readOnly" } }}
        localizationOptions={{ defaultLocaleControl: "hidden" }}
      />
    );

    expect(screen.getByRole("textbox", { name: "Description" })).toHaveAttribute("readonly");
    expect(screen.queryByRole("textbox", { name: "Default locale" })).not.toBeInTheDocument();
    expect(screen.queryByText("Default locale")).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "ja" }));
    expect(screen.getByRole("textbox", { name: "Translated description" })).toHaveAttribute("readonly");
  });

  it("keeps localization actions and tabs on one line and updates the summary and empty state", async () => {
    const user = userEvent.setup();
    render(<LocalizationOptionsHarness />);

    expect(screen.getByText("Translations not configured")).toBeInTheDocument();
    expect(screen.getByText("Add a translation language above.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add locale" })).toHaveStyle({ whiteSpace: "nowrap" });

    await user.type(screen.getByRole("textbox", { name: "Add locale" }), "fr");
    await user.click(screen.getByRole("button", { name: "Add locale" }));

    await waitFor(() => {
      expect(screen.getByText("2 languages configured: en (default), fr")).toBeInTheDocument();
    });
    expect(screen.getByRole("tab", { name: "fr" })).toHaveStyle({ whiteSpace: "nowrap" });
    expect(screen.queryByText("Add a translation language above.")).not.toBeInTheDocument();
  });

  it("opens localization accordions according to the configured default expansion mode", () => {
    const emptySchema = { ...schema, supportedLocales: ["en"] };
    const { unmount } = render(
      <MuiFormBuilder
        schema={emptySchema}
        onChange={() => undefined}
        localizationOptions={{ collapsible: true, defaultExpanded: true }}
      />
    );
    expect(screen.getByRole("button", { name: "Localization" })).toHaveAttribute("aria-expanded", "true");
    unmount();

    render(
      <MuiFormBuilder
        schema={emptySchema}
        onChange={() => undefined}
        localizationOptions={{ collapsible: true, defaultExpanded: "when-configured" }}
      />
    );
    expect(screen.getByRole("button", { name: "Localization" })).toHaveAttribute("aria-expanded", "false");
  });

  it("preserves controlled input focus and accordion state when inline options change identity", async () => {
    const user = userEvent.setup();
    render(<InlineOptionsControlledHarness />);

    const accordion = screen.getByRole("button", { name: "Localization" });
    await user.click(accordion);
    expect(accordion).toHaveAttribute("aria-expanded", "true");
    const fieldEditor = screen.getByText("Choice").closest<HTMLElement>('[data-mui-slot="field-editor"]');
    expect(fieldEditor).not.toBeNull();
    if (fieldEditor === null) return;
    const titleInput = within(fieldEditor).getByRole("textbox", { name: "質問文 / Question Title" });
    await user.type(titleInput, " Hello World");

    expect(titleInput).toHaveValue("Choice Hello World");
    expect(titleInput).toHaveFocus();
    expect(within(fieldEditor).getByRole("textbox", { name: "質問文 / Question Title" })).toBe(titleInput);
    expect(screen.getByRole("button", { name: "Localization" })).toBe(accordion);
    expect(accordion).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("focus-schema-state")).toHaveTextContent("Choice Hello World");
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
