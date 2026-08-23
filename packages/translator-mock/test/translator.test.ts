import { createMockTranslationAdapter, mockTranslator } from "../src";

describe("createMockTranslationAdapter", () => {
  it("serves complete English and Japanese form catalogs", () => {
    expect(mockTranslator.translate("form.title", "en")).toBe("Customer feedback");
    expect(mockTranslator.translate("form.title", "ja")).toBe("お客様アンケート");
  });

  it("interpolates parameters", () => {
    expect(mockTranslator.translate("validation.minLength", "en", { min: 3 })).toContain("3");
  });

  it("falls back to English and then to the unresolved key", () => {
    const translator = createMockTranslationAdapter({ en: { greeting: "Hello" }, ja: {} });
    expect(translator.translate("greeting", "ja")).toBe("Hello");
    expect(translator.translate("missing", "ja")).toBe("missing");
  });
});
