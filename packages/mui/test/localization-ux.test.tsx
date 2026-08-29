import type { FormSchema } from "@form-engine-ts/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MuiFormBuilder } from "../src";

const schema: FormSchema = {
  id: "localization-ux",
  version: 1,
  title: "Localization UX",
  defaultLocale: "en",
  supportedLocales: [],
  fields: [{ id: "name", type: "text", title: "Name", required: true }]
};

function ControlledBuilder({
  initialSchema = schema,
  localizationOptions,
  policy
}: {
  readonly initialSchema?: FormSchema;
  readonly localizationOptions?: React.ComponentProps<typeof MuiFormBuilder>["localizationOptions"];
  readonly policy?: React.ComponentProps<typeof MuiFormBuilder>["policy"];
}) {
  const [current, setCurrent] = useState(initialSchema);
  return (
    <>
      <MuiFormBuilder
        schema={current}
        onChange={setCurrent}
        {...(localizationOptions === undefined ? {} : { localizationOptions })}
        {...(policy === undefined ? {} : { policy })}
      />
      <output data-testid="schema-state">{JSON.stringify(current)}</output>
    </>
  );
}

describe("MUI localization UX", () => {
  it("normalizes availableLocales, excludes registered locales, and disables the empty selector", async () => {
    const user = userEvent.setup();
    render(
      <ControlledBuilder
        localizationOptions={{
          availableLocales: [
            { value: "en", label: "English" },
            { value: "zh", label: "Chinese" }
          ]
        }}
      />
    );

    await user.click(screen.getByRole("combobox", { name: "Select a locale to add" }));
    expect(screen.getByRole("option", { name: "Chinese" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "English" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "Chinese" }));
    await user.click(screen.getByRole("button", { name: "Add locale" }));

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "Select a locale to add" })).toHaveAttribute("aria-disabled", "true");
    });
    expect(screen.getByText("すべての候補言語が追加済みです")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "zh" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "zh" })).toHaveFocus();
  });

  it("intersects availableLocales with policy.allowedLocales", async () => {
    const user = userEvent.setup();
    render(
      <ControlledBuilder
        localizationOptions={{
          availableLocales: ["en", "zh", "fr"]
        }}
        policy={{ allowedLocales: ["en", "fr"] }}
      />
    );

    await user.click(screen.getByRole("combobox", { name: "Select a locale to add" }));
    expect(screen.getByRole("option", { name: "fr" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "zh" })).not.toBeInTheDocument();
  });

  it("applies the beforeQuestions placement preset", () => {
    const { container } = render(
      <MuiFormBuilder
        schema={schema}
        onChange={() => undefined}
        localizationOptions={{ placement: "beforeQuestions" }}
      />
    );
    const basicSettings = document.getElementById("builder-basic-settings-heading");
    const localization = container.querySelector('[data-mui-slot="localization"]');
    const questions = container.querySelector('[data-mui-slot="field-editor"]');
    expect(basicSettings).not.toBeNull();
    expect(localization).not.toBeNull();
    expect(questions).not.toBeNull();
    if (basicSettings === null || localization === null || questions === null) return;
    expect(basicSettings.compareDocumentPosition(localization) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(localization.compareDocumentPosition(questions) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it("renders the standard summary and updates it after adding a locale", async () => {
    const user = userEvent.setup();
    render(<ControlledBuilder localizationOptions={{ showSummary: true }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Translations not configured");

    await user.type(screen.getByRole("textbox", { name: "Add locale" }), "fr");
    await user.click(screen.getByRole("button", { name: "Add locale" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("2 locales configured"));
  });

  it("prefers a custom summary renderer", () => {
    render(
      <MuiFormBuilder
        schema={schema}
        onChange={() => undefined}
        localizationOptions={{
          showSummary: true,
          renderSummary: ({ defaultLocale, totalLocales }) => (
            <output data-testid="custom-summary">
              {defaultLocale}:{totalLocales}
            </output>
          )
        }}
      />
    );
    expect(screen.getByTestId("custom-summary")).toHaveTextContent("en:1");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("adds the selected locale when Enter is pressed in the selector", async () => {
    const user = userEvent.setup();
    render(<ControlledBuilder localizationOptions={{ availableLocales: [{ value: "fr", label: "French" }] }} />);
    const select = screen.getByRole("combobox", { name: "Select a locale to add" });
    await user.click(select);
    await user.click(screen.getByRole("option", { name: "French" }));
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Select a locale to add" }), { key: "Enter" });
    await waitFor(() => expect(screen.getByRole("tab", { name: "fr" })).toHaveAttribute("aria-selected", "true"));
  });

  it("renders the translation workspace inline and persists edits", async () => {
    const user = userEvent.setup();
    function ControlledInlineBuilder() {
      const [current, setCurrent] = useState(schema);
      return (
        <MuiFormBuilder
          schema={current}
          onChange={setCurrent}
          localization={{ mode: "inline-workspace", workspaceOptions: { availableLocales: ["fr"] } }}
        />
      );
    }
    render(<ControlledInlineBuilder />);

    expect(screen.getByTestId("translation-workspace")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "翻訳言語" }), "fr");
    await user.click(screen.getByRole("button", { name: "言語を追加" }));
    expect(screen.getByRole("tab", { name: "fr" })).toBeInTheDocument();
  });
});
