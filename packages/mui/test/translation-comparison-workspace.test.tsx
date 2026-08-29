import type { FormSchema } from "@form-engine-ts/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { TranslationComparisonWorkspace } from "../src";

const schema: FormSchema = {
  id: "mui-comparison",
  version: 1,
  title: "Customer survey",
  defaultLocale: "en",
  supportedLocales: ["en", "ja"],
  fields: [{ id: "name", type: "text", title: "Name", required: false }]
};

describe("TranslationComparisonWorkspace", () => {
  it("renders source and translation columns with a read-only source", () => {
    render(<TranslationComparisonWorkspace schema={schema} targetLocale="ja" i18n={{ locale: "en" }} />);

    const row = screen.getByTestId("translation-comparison-row-form-title");
    expect(row).toHaveStyle({ display: "grid" });
    expect(screen.getByText("Customer survey")).toBeInTheDocument();
    expect(screen.getAllByRole("textbox", { name: /Translation/u })).toHaveLength(2);
    expect(screen.queryByRole("textbox", { name: /Customer survey/u })).not.toBeInTheDocument();
  });

  it("passes edited translation schema to the parent", () => {
    const onChange = vi.fn();
    render(
      <TranslationComparisonWorkspace schema={schema} targetLocale="ja" onChange={onChange} i18n={{ locale: "en" }} />
    );

    fireEvent.change(screen.getByRole("textbox", { name: /Translation.*Title/u }), {
      target: { value: "顧客アンケート" }
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ translations: { ja: { title: "顧客アンケート" } } })
    );
  });

  it("keeps internal paths out of the default UI and supports locale operations", () => {
    const onChange = vi.fn();
    const onLocaleAdded = vi.fn();
    render(
      <TranslationComparisonWorkspace
        schema={schema}
        targetLocale="ja"
        availableLocales={[{ locale: "fr", label: "Français" }]}
        onChange={onChange}
        onLocaleAdded={onLocaleAdded}
        i18n={{ locale: "ja" }}
      />
    );

    expect(screen.getByText(/フォーム/u)).toBeInTheDocument();
    expect(screen.queryByText("form.title")).not.toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "Français" }));
    fireEvent.click(screen.getByRole("button", { name: "翻訳言語を追加" }));

    expect(onLocaleAdded).toHaveBeenCalledWith("fr");
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ supportedLocales: ["en", "ja", "fr"] }));
  });

  it("shows the internal path only when explicitly requested", () => {
    render(
      <TranslationComparisonWorkspace schema={schema} targetLocale="ja" showInternalPath i18n={{ locale: "ja" }} />
    );

    expect(screen.getByText(/form\.title/u)).toBeInTheDocument();
  });
});
