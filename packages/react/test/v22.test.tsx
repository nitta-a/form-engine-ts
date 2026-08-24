import type { FormSchema } from "@form-engine-ts/core";
import { fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { useState } from "react";
import {
  type BuilderButtonProps,
  type BuilderTextInputProps,
  type BuilderTranslationActionsSlotProps,
  FormBuilder,
  useFormBuilder
} from "../src";

const schema: FormSchema = {
  id: "builder-v22",
  version: 1,
  title: "Builder",
  defaultLocale: "en",
  supportedLocales: ["en"],
  fields: [
    { id: "name", type: "text", title: "Name", required: false },
    { id: "details", type: "textarea", title: "Details", required: false }
  ],
  pages: [
    { id: "basic", title: "Basic", questionIds: ["name"] },
    { id: "more", title: "More", questionIds: ["details"] }
  ]
};

describe("useFormBuilder v2.2", () => {
  it("guards page text without changing the schema", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useFormBuilder({ schema, onChange, policy: { maxTextLength: 8 } }));

    expect(result.current.updatePage("basic", (page) => ({ ...page, title: "Too long page" }))).toEqual({
      success: false,
      error: { type: "max_text_length_exceeded", max: 8 }
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("rejects disallowed locales and locale-count overflow for both locale actions", () => {
    const allowed = renderHook(() =>
      useFormBuilder({ schema, onChange: vi.fn(), policy: { allowedLocales: ["en", "ja"] } })
    );
    expect(allowed.result.current.addLocale("zh")).toEqual({
      success: false,
      error: { type: "disallowed_locale", locale: "zh" }
    });
    expect(allowed.result.current.setDefaultLocale("zh")).toEqual({
      success: false,
      error: { type: "disallowed_locale", locale: "zh" }
    });
    expect(allowed.result.current.setLocaleTranslation("zh", { kind: "form" }, "title", "表单")).toEqual({
      success: false,
      error: { type: "disallowed_locale", locale: "zh" }
    });

    const limited = renderHook(() => useFormBuilder({ schema, onChange: vi.fn(), policy: { maxLocales: 1 } }));
    expect(limited.result.current.addLocale("ja")).toEqual({
      success: false,
      error: { type: "max_locales_exceeded", max: 1 }
    });
    expect(limited.result.current.setDefaultLocale("ja")).toEqual({
      success: false,
      error: { type: "max_locales_exceeded", max: 1 }
    });
    expect(limited.result.current.setLocaleTranslation("ja", { kind: "form" }, "title", "フォーム")).toEqual({
      success: false,
      error: { type: "max_locales_exceeded", max: 1 }
    });
  });
});

describe("FormBuilder v2.2", () => {
  it("reports updatePage, addLocale, and setDefaultLocale failures exactly once with action context", () => {
    const pageError = vi.fn();
    const pageView = render(
      <FormBuilder schema={schema} onChange={vi.fn()} policy={{ maxTextLength: 8 }} onActionError={pageError} />
    );
    fireEvent.change(screen.getAllByLabelText("Page title")[0] as HTMLElement, {
      target: { value: "Too long page" }
    });
    expect(pageError).toHaveBeenCalledTimes(1);
    expect(pageError).toHaveBeenCalledWith(
      { type: "max_text_length_exceeded", max: 8 },
      { action: "updatePage", targetId: "basic" }
    );
    pageView.unmount();

    const localeError = vi.fn();
    const localeView = render(
      <FormBuilder schema={schema} onChange={vi.fn()} policy={{ maxLocales: 1 }} onActionError={localeError} />
    );
    fireEvent.change(screen.getByLabelText("Add locale"), { target: { value: "ja" } });
    const addLocale = screen.getByRole("button", { name: "Add locale" });
    expect(addLocale).toBeDisabled();
    fireEvent.click(addLocale);
    expect(localeError).toHaveBeenCalledTimes(1);
    expect(localeError).toHaveBeenCalledWith(
      { type: "max_locales_exceeded", max: 1 },
      { action: "addLocale", params: { locale: "ja" } }
    );
    localeView.unmount();

    const defaultError = vi.fn();
    render(
      <FormBuilder
        schema={schema}
        onChange={vi.fn()}
        policy={{ allowedLocales: ["en", "ja"] }}
        onActionError={defaultError}
      />
    );
    fireEvent.change(screen.getByLabelText("Default locale"), { target: { value: "zh" } });
    expect(defaultError).toHaveBeenCalledTimes(1);
    expect(defaultError).toHaveBeenCalledWith(
      { type: "disallowed_locale", locale: "zh" },
      { action: "setDefaultLocale", params: { locale: "zh" } }
    );
  });

  it("keeps the complete form visible but prevents every mutation in read-only mode", () => {
    const onChange = vi.fn();
    const onActionError = vi.fn();
    render(<FormBuilder schema={schema} onChange={onChange} onActionError={onActionError} readOnly />);

    expect(screen.getByRole("heading", { name: "Page manager" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Localization" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Name" })).toBeInTheDocument();
    for (const control of screen.getAllByRole("button")) expect(control).toBeDisabled();
    for (const control of screen.getAllByRole("textbox")) expect(control).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Default locale"), { target: { value: "ja" } });
    fireEvent.click(screen.getByRole("button", { name: "Add question" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(onActionError).not.toHaveBeenCalled();
  });

  it("hides each optional builder surface independently", () => {
    render(
      <FormBuilder
        schema={schema}
        onChange={vi.fn()}
        features={{ pages: false, localization: false, conditions: false }}
      />
    );

    expect(screen.queryByRole("heading", { name: "Page manager" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Localization" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Page")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Page display condition")).not.toBeInTheDocument();
    expect(screen.queryAllByLabelText("Display condition")).toHaveLength(0);
    expect(screen.getByRole("group", { name: "Name" })).toBeInTheDocument();
  });

  it("offers only unregistered allowed locales and disables adding at maxLocales", () => {
    const { rerender } = render(
      <FormBuilder schema={schema} onChange={vi.fn()} policy={{ allowedLocales: ["en", "ja", "fr"], maxLocales: 3 }} />
    );
    const localeSelect = screen.getByLabelText("Add locale");
    expect(
      within(localeSelect)
        .getAllByRole("option")
        .map((option) => option.textContent)
    ).toEqual(["—", "ja", "fr"]);

    rerender(
      <FormBuilder
        schema={{ ...schema, supportedLocales: ["en", "ja", "fr"] }}
        onChange={vi.fn()}
        policy={{ allowedLocales: ["en", "ja", "fr"], maxLocales: 3 }}
      />
    );
    expect(screen.getByRole("button", { name: "Add locale" })).toBeDisabled();
    expect(
      within(screen.getByLabelText("Add locale"))
        .getAllByRole("option")
        .map((option) => option.textContent)
    ).toEqual(["—"]);
  });

  it("renders injected button and text-input primitives and propagates changes and disabled state", () => {
    function CustomButton({ children, onClick, disabled, "aria-label": ariaLabel }: BuilderButtonProps) {
      return (
        <button type="button" data-design-system="button" disabled={disabled} aria-label={ariaLabel} onClick={onClick}>
          {children}
        </button>
      );
    }
    function CustomTextInput({ value, onChange, disabled, id, "aria-label": ariaLabel }: BuilderTextInputProps) {
      return (
        <input
          id={id}
          data-design-system="text-input"
          disabled={disabled}
          aria-label={ariaLabel}
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      );
    }
    function Harness({ readOnly = false }: { readonly readOnly?: boolean }) {
      const [current, setCurrent] = useState(schema);
      return (
        <>
          <FormBuilder
            schema={current}
            onChange={setCurrent}
            readOnly={readOnly}
            components={{ Button: CustomButton, TextInput: CustomTextInput }}
            idFactory={(kind) => `custom-${kind}`}
          />
          <output data-testid="custom-schema">{JSON.stringify(current)}</output>
        </>
      );
    }

    const view = render(<Harness />);
    expect(screen.getByRole("button", { name: "Add question" })).toHaveAttribute("data-design-system", "button");
    expect(screen.getAllByRole("textbox").every((input) => input.dataset.designSystem === "text-input")).toBe(true);
    fireEvent.change(screen.getAllByLabelText("Page title")[0] as HTMLElement, { target: { value: "Updated" } });
    expect(screen.getByTestId("custom-schema")).toHaveTextContent('"title":"Updated"');
    fireEvent.click(screen.getByRole("button", { name: "Add question" }));
    expect(screen.getByTestId("custom-schema")).toHaveTextContent('"id":"custom-field"');
    view.unmount();

    render(<Harness readOnly />);
    expect(screen.getByRole("button", { name: "Add question" })).toBeDisabled();
    expect(screen.getAllByRole("textbox").every((input) => input.matches(":disabled"))).toBe(true);
  });

  it("passes MUI-compatible state and labeling props to injected text inputs", () => {
    const observed = vi.fn();
    function MuiTextField(props: BuilderTextInputProps) {
      observed(props);
      return (
        <input
          aria-label={props.label}
          value={props.value}
          required={props.required}
          aria-invalid={props.error}
          onChange={(event) => props.onChange(event.currentTarget.value)}
        />
      );
    }
    render(<FormBuilder schema={schema} onChange={vi.fn()} components={{ TextInput: MuiTextField }} />);
    const fieldTitleProps = observed.mock.calls
      .map(([props]) => props as BuilderTextInputProps)
      .find((props) => props.name === "fields.name.title");
    expect(fieldTitleProps).toMatchObject({
      label: "質問文 / Question Title",
      required: true,
      error: false,
      helperText: ""
    });
  });

  it("fully replaces translation actions and exposes policy-aware builder actions", () => {
    function CustomActions({ actions }: BuilderTranslationActionsSlotProps) {
      return (
        <button type="button" onClick={() => actions.addLocale("ja")}>
          Run ARGS AI translation
        </button>
      );
    }
    function Harness() {
      const [current, setCurrent] = useState<FormSchema>({ ...schema, supportedLocales: ["en"] });
      return (
        <>
          <FormBuilder
            schema={current}
            onChange={setCurrent}
            slots={{ translationActions: CustomActions }}
            policy={{ allowedLocales: ["en", "ja"] }}
          />
          <output data-testid="slot-schema">{JSON.stringify(current)}</output>
        </>
      );
    }

    render(<Harness />);
    expect(screen.queryByRole("button", { name: "Translate all text" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Run ARGS AI translation" }));
    expect(screen.getByTestId("slot-schema")).toHaveTextContent('"supportedLocales":["en","ja"]');
  });

  it("exposes translation errors, clearing, and successful reports to the translation-actions slot", async () => {
    const translateBatch = vi
      .fn<(texts: readonly string[]) => Promise<readonly string[]>>()
      .mockRejectedValueOnce(new Error("translation failed"))
      .mockImplementation(async (texts) => texts.map((text) => `translated:${text}`));
    function TranslationActions({
      onAutoTranslate,
      translationError,
      translationReport,
      onClearTranslationError
    }: BuilderTranslationActionsSlotProps) {
      return (
        <div>
          <button type="button" onClick={onAutoTranslate}>
            Run translation
          </button>
          {translationError === undefined ? null : <output>{translationError}</output>}
          {onClearTranslationError === undefined ? null : (
            <button type="button" onClick={onClearTranslationError}>
              Clear translation error
            </button>
          )}
          {translationReport === undefined ? null : (
            <output>Updated slots: {translationReport.updatedSlots.length}</output>
          )}
        </div>
      );
    }
    function Harness() {
      const [current, setCurrent] = useState<FormSchema>({ ...schema, supportedLocales: ["en", "ja"] });
      return (
        <FormBuilder
          schema={current}
          onChange={setCurrent}
          translationAdapter={{ translateText: vi.fn(), translateBatch }}
          slots={{ translationActions: TranslationActions }}
        />
      );
    }

    render(<Harness />);
    fireEvent.change(screen.getByLabelText("Edit locale"), { target: { value: "ja" } });
    fireEvent.click(screen.getByRole("button", { name: "Run translation" }));
    expect(await screen.findAllByText("translation failed")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Clear translation error" }));
    expect(screen.queryAllByText("translation failed")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Run translation" }));
    expect(await screen.findByText(/Updated slots: [1-9]/)).toBeInTheDocument();
  });

  it("keeps the default DOM unchanged when component and slot overrides are omitted or empty", () => {
    const baseline = render(<FormBuilder schema={schema} onChange={vi.fn()} />);
    const baselineHtml = baseline.container.innerHTML;
    baseline.unmount();
    const explicitDefaults = render(<FormBuilder schema={schema} onChange={vi.fn()} components={{}} slots={{}} />);
    expect(explicitDefaults.container.innerHTML).toBe(baselineHtml);
  });
});
