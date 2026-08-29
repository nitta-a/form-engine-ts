import type { FormSchema } from "@form-engine-ts/core";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { TranslationComparisonWorkspace } from "../src";

const schema: FormSchema = {
  id: "mui-comparison",
  version: 1,
  title: "Customer survey",
  defaultLocale: "en",
  supportedLocales: ["en", "ja"],
  fields: [{ id: "name", type: "text", title: "Name", required: false }]
};

const multiLocaleSchema: FormSchema = {
  ...schema,
  supportedLocales: ["en", "ja", "fr"]
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

  it("uses locale display names throughout the comparison UI", () => {
    render(
      <TranslationComparisonWorkspace
        schema={schema}
        targetLocale="ja"
        i18n={{
          locale: "ja",
          getLocaleLabel: (locale) => ({ en: "英語", ja: "日本語" })[locale] ?? locale
        }}
      />
    );

    expect(screen.getByText("元言語: 英語")).toBeInTheDocument();
    expect(screen.getByText("訳文 (日本語)")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "日本語" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "ja" })).not.toBeInTheDocument();
  });

  it("supports a select for switching between registered translation locales", () => {
    render(
      <TranslationComparisonWorkspace
        schema={multiLocaleSchema}
        targetLocale="ja"
        localeSelectorMode="select"
        i18n={{
          locale: "en",
          getLocaleLabel: (locale) => ({ en: "English", ja: "Japanese", fr: "French" })[locale] ?? locale
        }}
      />
    );

    const selector = screen.getByRole("combobox", { name: "Target language" });
    fireEvent.mouseDown(selector);
    fireEvent.click(screen.getByRole("option", { name: "French" }));

    expect(screen.getByText("Translation (French)")).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("hides the registered locale selector in select mode when only one locale exists", () => {
    render(<TranslationComparisonWorkspace schema={schema} targetLocale="ja" localeSelectorMode="select" />);

    expect(screen.queryByRole("combobox", { name: "Target language" })).not.toBeInTheDocument();
  });

  it("renders the same accessible decorative item icon on both sides and supports replacement", () => {
    const renderItemIcon = vi.fn(({ targetProperty }: { readonly targetProperty: string }) => (
      <span data-testid={`custom-icon-${targetProperty}`}>Custom icon</span>
    ));
    render(
      <TranslationComparisonWorkspace
        schema={schema}
        targetLocale="ja"
        renderItemIcon={renderItemIcon}
        i18n={{ locale: "en" }}
      />
    );

    expect(renderItemIcon).toHaveBeenCalledWith(expect.objectContaining({ nodeKind: "form", targetProperty: "title" }));
    expect(
      within(screen.getByTestId("translation-comparison-row-form-title")).getAllByTestId("custom-icon-title")
    ).toHaveLength(2);
    expect(screen.getByTestId("translation-item-icon-form.title")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("translation-item-icon-form.title-target")).toHaveAttribute("aria-hidden", "true");
  });
});
