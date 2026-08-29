import { createFormEngineTranslator } from "../src";

describe("FormEngine translator fallback", () => {
  it("uses custom messages before the official catalog", () => {
    const translate = createFormEngineTranslator({ messages: { "builder.formTitle": "カスタムタイトル" } });

    expect(translate("builder.formTitle")).toBe("カスタムタイトル");
  });

  it("falls back to English and never exposes an unresolved key", () => {
    const translate = createFormEngineTranslator({ locale: "fr", fallbackLocale: "en" });

    expect(translate("builder.formTitle")).toBe("Form title");
    expect(translate("builder.nonExistentKey")).toBe("");
  });

  it("supports both catalog placeholder styles", () => {
    const translate = createFormEngineTranslator({
      messages: { "builder.formTitle": "{count}/{{total}}" }
    });

    expect(translate("builder.formTitle", { count: 1, total: 2 })).toBe("1/2");
  });

  it("reports fallback and unresolved keys", () => {
    const events: { key: string; reason: string; resolvedValue: string }[] = [];
    const translate = createFormEngineTranslator({
      locale: "ja",
      fallbackLocale: "en",
      messages: { "builder.formTitle": "" },
      onMissingKey: (event) => events.push(event),
      strict: true
    });

    expect(translate("builder.formTitle")).toBe("Form title");
    expect(translate("builder.missingKey")).toBe("");
    expect(events).toMatchObject([
      { key: "builder.formTitle", reason: "missing_in_current_locale", resolvedValue: "Form title" },
      { key: "builder.missingKey", reason: "missing_in_all_catalogs", resolvedValue: "" }
    ]);
  });
});
