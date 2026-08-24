import type { FormSchema } from "@form-engine-ts/core";
import { fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { FormBuilder, useFormBuilder } from "../src";

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

    const limited = renderHook(() => useFormBuilder({ schema, onChange: vi.fn(), policy: { maxLocales: 1 } }));
    expect(limited.result.current.addLocale("ja")).toEqual({
      success: false,
      error: { type: "max_locales_exceeded", max: 1 }
    });
    expect(limited.result.current.setDefaultLocale("ja")).toEqual({
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
});
