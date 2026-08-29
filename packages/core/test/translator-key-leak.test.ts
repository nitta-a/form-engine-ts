import { createFormEngineTranslator, JA_COMPARISON_MESSAGES } from "../src";

describe("translation key exposure protection", () => {
  it("includes the comparison workspace messages in the Japanese catalog", () => {
    expect(JA_COMPARISON_MESSAGES["workspace.comparison.title"]).toBe("翻訳比較ワークスペース");
  });

  it("does not return an unresolved key from a fallback resolver", () => {
    const translate = createFormEngineTranslator({ fallbackTextResolver: (key) => key });

    expect(translate("form.title")).toBe("");
    expect(translate("builder.unknown")).toBe("");

    const leakingResolver = createFormEngineTranslator({ fallbackTextResolver: () => "fields.q1.title" });
    expect(leakingResolver("builder.unknown")).toBe("");
  });
});
