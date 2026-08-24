import type { AsyncTranslationAdapter, FormSchema } from "@form-engine-ts/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { FormBuilder, type FormBuilderProps } from "../src";

const baseSchema: FormSchema = {
  id: "builder-v211",
  version: 1,
  title: "Builder",
  defaultLocale: "en",
  supportedLocales: ["en", "ja"],
  fields: [{ id: "seed", type: "text", title: "Seed", required: false }]
};

function BuilderHarness({
  initial = baseSchema,
  ...props
}: Omit<FormBuilderProps, "schema" | "onChange"> & { readonly initial?: FormSchema }) {
  const [schema, setSchema] = useState(initial);
  return (
    <>
      <FormBuilder {...props} schema={schema} onChange={setSchema} />
      <output data-testid="schema-state">{JSON.stringify(schema)}</output>
    </>
  );
}

describe("FormBuilder v2.1.1", () => {
  it("uses the first allowed type when text is disallowed", async () => {
    const user = userEvent.setup();
    render(
      <BuilderHarness
        policy={{ allowedFieldTypes: ["radio", "multi-select", "textarea"] }}
        idFactory={(kind) => `allowed-${kind}`}
      />
    );
    await user.click(screen.getByRole("button", { name: "Add question" }));
    await waitFor(() => expect(screen.getByTestId("schema-state")).toHaveTextContent('"type":"radio"'));
  });

  it("prefers an allowed defaultFieldType", async () => {
    const user = userEvent.setup();
    render(
      <BuilderHarness
        defaultFieldType="textarea"
        policy={{ allowedFieldTypes: ["radio", "textarea"] }}
        idFactory={(kind) => `default-${kind}`}
      />
    );
    await user.click(screen.getByRole("button", { name: "Add question" }));
    await waitFor(() => expect(screen.getByTestId("schema-state")).toHaveTextContent('"type":"textarea"'));
  });

  it("disables field creation when no type is allowed", () => {
    render(<BuilderHarness policy={{ allowedFieldTypes: [] }} />);
    expect(screen.getByRole("button", { name: "Add question" })).toBeDisabled();
  });

  it("reports max-field and max-option action errors exactly once", async () => {
    const onFieldError = vi.fn();
    const fieldView = render(<BuilderHarness policy={{ maxFields: 1 }} onActionError={onFieldError} />);
    const addField = screen.getByRole("button", { name: "Add question" }) as HTMLButtonElement;
    expect(addField).toBeDisabled();
    fireEvent.click(addField);
    expect(onFieldError).toHaveBeenCalledTimes(1);
    expect(onFieldError).toHaveBeenCalledWith({ type: "max_fields_exceeded", max: 1 }, { action: "addField" });
    fieldView.unmount();

    const onOptionError = vi.fn();
    const choiceSchema: FormSchema = {
      ...baseSchema,
      fields: [
        {
          id: "choice",
          type: "radio",
          title: "Choice",
          required: false,
          options: [{ id: "one", label: "One" }]
        }
      ]
    };
    render(<BuilderHarness initial={choiceSchema} policy={{ maxOptionsPerField: 1 }} onActionError={onOptionError} />);
    const addOption = screen.getByRole("button", { name: "Add option" });
    expect(addOption).toBeDisabled();
    fireEvent.click(addOption);
    expect(onOptionError).toHaveBeenCalledTimes(1);
    expect(onOptionError).toHaveBeenCalledWith(
      { type: "max_options_exceeded", max: 1 },
      { action: "addOption", targetId: "choice" }
    );
  });

  it("defaults automatic translation to missing-only", async () => {
    const user = userEvent.setup();
    const adapter: AsyncTranslationAdapter = {
      translateText: vi.fn(async (text: string) => `ja:${text}`),
      translateBatch: vi.fn(async (texts: readonly string[]) => texts.map((text) => `ja:${text}`))
    };
    const schema: FormSchema = {
      ...baseSchema,
      translations: { ja: { title: "手修正タイトル" } }
    };
    render(<BuilderHarness initial={schema} translationAdapter={adapter} />);
    await user.selectOptions(screen.getByLabelText("Edit locale"), "ja");
    await user.click(screen.getByRole("button", { name: "Translate all text" }));
    await waitFor(() => expect(screen.getByTestId("schema-state")).toHaveTextContent("手修正タイトル"));
    expect(screen.getByTestId("schema-state")).toHaveTextContent("ja:Seed");
    expect(adapter.translateBatch).toHaveBeenCalledWith(["Seed"], "ja", "en");
  });

  it("honors overwrite all for automatic translation", async () => {
    const user = userEvent.setup();
    const adapter: AsyncTranslationAdapter = {
      translateText: vi.fn(async (text: string) => `ja:${text}`),
      translateBatch: vi.fn(async (texts: readonly string[]) => texts.map((text) => `ja:${text}`))
    };
    const schema: FormSchema = { ...baseSchema, translations: { ja: { title: "手修正タイトル" } } };
    render(<BuilderHarness initial={schema} translationAdapter={adapter} translationOptions={{ overwrite: "all" }} />);
    await user.selectOptions(screen.getByLabelText("Edit locale"), "ja");
    await user.click(screen.getByRole("button", { name: "Translate all text" }));
    await waitFor(() => expect(screen.getByTestId("schema-state")).toHaveTextContent("ja:Builder"));
    expect(screen.getByTestId("schema-state")).not.toHaveTextContent("手修正タイトル");
  });

  it("creates and stores metadata for manual translations", async () => {
    const user = userEvent.setup();
    const createMetadata = vi.fn(() => ({ source: "manual", isManual: true }) as const);
    const schema: FormSchema = {
      ...baseSchema,
      completionMessage: "Complete",
      translations: { ja: { completionMessage: "完了" } },
      translationMetadata: { ja: { completionMessage: { isManual: true, revision: 1 } } }
    };
    render(<BuilderHarness initial={schema} createManualTranslationMetadata={createMetadata} />);
    await user.selectOptions(screen.getByLabelText("Edit locale"), "ja");
    const inputs = screen.getAllByLabelText("Completion message");
    const localized = inputs[1];
    if (localized === undefined) throw new Error("Expected the localized completion editor");
    await user.type(localized, "済");
    expect(createMetadata).toHaveBeenCalledWith({
      locale: "ja",
      kind: "form",
      nodeId: "builder-v211",
      property: "completionMessage",
      sourceText: "Complete",
      translatedText: "完了済",
      existingTranslationMetadata: { isManual: true, revision: 1 }
    });
    await waitFor(() =>
      expect(screen.getByTestId("schema-state")).toHaveTextContent(
        '"completionMessage":{"source":"manual","isManual":true}'
      )
    );
  });

  it("updates manual text without a metadata callback", async () => {
    const user = userEvent.setup();
    const schema: FormSchema = { ...baseSchema, completionMessage: "Complete" };
    render(<BuilderHarness initial={schema} />);
    await user.selectOptions(screen.getByLabelText("Edit locale"), "ja");
    const localized = screen.getAllByLabelText("Completion message")[1];
    if (localized === undefined) throw new Error("Expected the localized completion editor");
    await user.type(localized, "完了");
    await waitFor(() => expect(screen.getByTestId("schema-state")).toHaveTextContent('"completionMessage":"完了"'));
    expect(screen.getByTestId("schema-state")).not.toHaveTextContent("translationMetadata");
  });
});
