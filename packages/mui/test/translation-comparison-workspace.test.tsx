import type { AsyncTranslationAdapter, FormSchema } from "@form-engine-ts/core";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { TargetLocaleHeaderToolbar, TranslationComparisonWorkspace } from "../src";

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

const sourceOnlySchema: FormSchema = {
  ...schema,
  supportedLocales: ["en"]
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
    expect(screen.getByRole("combobox", { name: "追加する言語を選択" })).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "Français" }));
    fireEvent.click(screen.getByRole("button", { name: "翻訳言語を追加" }));

    expect(onLocaleAdded).toHaveBeenCalledWith("fr");
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ supportedLocales: ["en", "ja", "fr"] }));
  });

  it("renders standard locale action icons and supports replacing the action content", () => {
    const { unmount } = render(
      <TranslationComparisonWorkspace
        schema={schema}
        targetLocale="ja"
        availableLocales={["fr"]}
        i18n={{ locale: "en" }}
      />
    );

    expect(screen.getByTestId("AddIcon")).toBeInTheDocument();
    expect(screen.getByTestId("DeleteOutlineIcon")).toBeInTheDocument();
    unmount();

    const renderLocaleActions = vi.fn(({ add, remove }) => (
      <>
        <button type="button" aria-label={add.label} onClick={add.onClick} disabled={add.disabled}>
          {add.icon}
          Add custom
        </button>
        <button type="button" aria-label={remove.label} onClick={remove.onClick} disabled={remove.disabled}>
          {remove.icon}
          Remove custom
        </button>
      </>
    ));
    render(
      <TranslationComparisonWorkspace
        schema={schema}
        targetLocale="ja"
        availableLocales={["fr"]}
        addIcon={<span data-testid="custom-add-icon" />}
        removeIcon={<span data-testid="custom-remove-icon" />}
        renderLocaleActions={renderLocaleActions}
        i18n={{ locale: "en" }}
      />
    );

    expect(renderLocaleActions).toHaveBeenCalledWith(
      expect.objectContaining({
        add: expect.objectContaining({ action: "add", label: "Add language" }),
        remove: expect.objectContaining({ action: "remove", label: "Remove language" })
      })
    );
    expect(screen.getByTestId("custom-add-icon")).toBeInTheDocument();
    expect(screen.getByTestId("custom-remove-icon")).toBeInTheDocument();
  });

  it("uses the same standard locale icons in TargetLocaleHeaderToolbar", () => {
    render(
      <TargetLocaleHeaderToolbar
        supportedLocales={["en", "ja"]}
        currentLocale="ja"
        availableLocales={["fr"]}
        onSelectLocale={vi.fn()}
        onAddLocale={vi.fn()}
        onRemoveLocale={vi.fn()}
      />
    );

    expect(screen.getByTestId("AddIcon")).toBeInTheDocument();
    expect(screen.getByTestId("DeleteOutlineIcon")).toBeInTheDocument();
  });

  it("keeps the locale removal confirmation flow on the icon-bearing button", () => {
    render(
      <TranslationComparisonWorkspace
        schema={schema}
        targetLocale="ja"
        availableLocales={["fr"]}
        i18n={{ locale: "en" }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove language" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
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

  it("applies configurable comparison layout, input state colors, and status display", () => {
    render(
      <TranslationComparisonWorkspace
        schema={schema}
        targetLocale="ja"
        appearance={{
          input: { borderColor: { default: "#111111", missing: "#cc0000", focus: "#0066cc" }, height: 120 },
          layout: { sourceWidth: "2fr", targetWidth: "3fr", gap: 3, labelPosition: "top", responsive: "columns" },
          status: { labels: { missing: "未入力" }, visible: true, position: "target" }
        }}
        i18n={{ locale: "ja" }}
      />
    );

    expect(screen.getByTestId("translation-status-badge-form.title")).toHaveTextContent("未入力");
    expect(screen.getByText("訳文 (ja) · タイトル")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "訳文 (ja) · タイトル" })).toBeInTheDocument();
  });

  it("can hide the built-in translation status display", () => {
    render(
      <TranslationComparisonWorkspace
        schema={schema}
        targetLocale="ja"
        appearance={{ status: { visible: false } }}
        i18n={{ locale: "ja" }}
      />
    );

    expect(screen.queryByTestId("translation-status-badge-form.title")).not.toBeInTheDocument();
  });

  it("supports layout overrides for titles and questions", () => {
    render(
      <TranslationComparisonWorkspace
        schema={schema}
        targetLocale="ja"
        appearance={{
          layout: {
            labelPosition: "hidden",
            byTarget: {
              title: { labelPosition: "top" },
              question: { labelPosition: "hidden" }
            }
          }
        }}
        i18n={{ locale: "ja" }}
      />
    );

    expect(screen.getByText("訳文 (ja) · タイトル")).toBeInTheDocument();
    expect(screen.queryByText("訳文 (ja) · Name")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "訳文 (ja) · Name" })).toBeInTheDocument();
  });

  it("shows an actionable empty state until a target locale is added", () => {
    const onLocaleAdded = vi.fn();
    render(
      <TranslationComparisonWorkspace
        schema={sourceOnlySchema}
        availableLocales={[{ locale: "ja", label: "Japanese" }]}
        emptyState={{ title: "Begin translation", description: "Choose a language.", action: "Add target" }}
        onLocaleAdded={onLocaleAdded}
        i18n={{ locale: "en" }}
      />
    );

    expect(screen.getByTestId("translation-comparison-empty-state")).toHaveTextContent("Begin translation");
    expect(screen.getByText("Choose a language.")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Translate all" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("translation-source-column-header")).not.toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Select a locale to add" }));
    fireEvent.click(screen.getByRole("option", { name: "Japanese" }));
    fireEvent.click(screen.getByRole("button", { name: "Add target" }));

    expect(onLocaleAdded).toHaveBeenCalledWith("ja");
    expect(screen.queryByTestId("translation-comparison-empty-state")).not.toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByTestId("translation-source-column-header")).toBeInTheDocument();
  });

  it("passes resolved empty-state props and prevents read-only locale mutations", () => {
    const onLocaleAdded = vi.fn();
    const renderEmptyState = vi.fn(({ title, description, action, canAddLocale, readOnly }) => (
      <div data-testid="custom-empty-state">
        {title}|{description}|{action}|{String(canAddLocale)}|{String(readOnly)}
      </div>
    ));
    render(
      <TranslationComparisonWorkspace
        schema={sourceOnlySchema}
        availableLocales={["ja"]}
        readOnly
        onLocaleAdded={onLocaleAdded}
        slots={{ renderEmptyState }}
        i18n={{ locale: "en" }}
      />
    );

    expect(screen.getByTestId("custom-empty-state")).toHaveTextContent(
      "Start translating|No target languages are configured.|Add language|false|true"
    );
    expect(renderEmptyState).toHaveBeenCalledWith(
      expect.objectContaining({ sourceLocale: "en", localeCandidates: [expect.objectContaining({ locale: "ja" })] })
    );
    expect(onLocaleAdded).not.toHaveBeenCalled();
  });

  it("lets a unified locale toolbar replace the existing locale slots", () => {
    const renderTargetLocaleSelector = vi.fn();
    const renderLocaleActions = vi.fn();
    const renderLocaleToolbar = vi.fn((props) => (
      <button type="button" onClick={() => props.onTargetLocaleChange("fr")}>
        {props.sourceLocaleLabel} to {props.targetLocaleLabel}
      </button>
    ));
    render(
      <TranslationComparisonWorkspace
        schema={multiLocaleSchema}
        targetLocale="ja"
        availableLocales={["de"]}
        slots={{ renderLocaleToolbar, renderTargetLocaleSelector, renderLocaleActions }}
        i18n={{ locale: "en" }}
      />
    );

    expect(screen.getByRole("button", { name: "en to ja" })).toBeInTheDocument();
    expect(renderLocaleToolbar).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceLocale: "en",
        targetLocale: "ja",
        targetLocales: ["ja", "fr"],
        localeSelectorMode: "tabs",
        actions: expect.objectContaining({ add: expect.any(Object), remove: expect.any(Object) })
      })
    );
    expect(renderTargetLocaleSelector).not.toHaveBeenCalled();
    expect(renderLocaleActions).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "en to ja" }));
    expect(screen.getByText("Translation (fr)")).toBeInTheDocument();
  });

  it("customizes column headers and applies source and target column appearance", () => {
    const renderColumnHeader = vi.fn(({ side, localeLabel, readOnly }) => (
      <div>{`${side}:${localeLabel}:${String(readOnly)}`}</div>
    ));
    render(
      <TranslationComparisonWorkspace
        schema={schema}
        targetLocale="ja"
        appearance={{
          sourceColumn: { backgroundColor: "#eeeeee", borderColor: "#111111", borderWidth: 2, padding: "12px" },
          targetColumn: { backgroundColor: "#ffffff", borderColor: "#222222", borderWidth: 1, padding: "8px" }
        }}
        slots={{ renderColumnHeader }}
        i18n={{ locale: "en" }}
      />
    );

    expect(screen.getByText("source:en:true")).toBeInTheDocument();
    expect(screen.getByText("target:ja:false")).toBeInTheDocument();
    expect(renderColumnHeader).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("translation-source-column-header")).toHaveStyle({
      backgroundColor: "#eeeeee",
      borderColor: "#111111",
      borderWidth: "2px",
      padding: "12px"
    });
    expect(screen.getByTestId("translation-target-column-form-title")).toHaveStyle({
      backgroundColor: "#ffffff",
      borderColor: "#222222",
      borderWidth: "1px",
      padding: "8px"
    });
  });

  it("provides actionable translation state to a custom header", () => {
    const translationAdapter: AsyncTranslationAdapter = {
      translateText: vi.fn(async (text: string) => `ja:${text}`),
      translateBatch: vi.fn(async (texts: readonly string[]) => texts.map((text) => `ja:${text}`))
    };
    const renderHeader = vi.fn((props) => (
      <div data-testid="custom-header">
        {String(props.hasTargetLocale)}|{String(props.canTranslateAll)}|{String(props.completionPercentage)}|
        {String(props.error)}|{String(props.onRetry)}
      </div>
    ));
    render(
      <TranslationComparisonWorkspace
        schema={schema}
        targetLocale="ja"
        translationAdapter={translationAdapter}
        slots={{ renderHeader }}
      />
    );

    expect(screen.getByTestId("custom-header")).toHaveTextContent("true|true|0|undefined|undefined");
    expect(renderHeader).toHaveBeenCalledWith(
      expect.objectContaining({
        hasTargetLocale: true,
        canTranslateAll: true,
        completionPercentage: 0,
        onTranslateAll: expect.any(Function),
        onCancel: expect.any(Function)
      })
    );
  });
});
