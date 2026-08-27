import { describe, expect, it, vi } from "vitest";
import { createI18nextTranslationAdapter, createI18nextTranslator } from "../src";

describe("i18next translation adapter", () => {
  it("passes locale, namespace, and interpolation parameters to i18next", () => {
    const i18n = {
      exists: vi.fn(() => true),
      t: vi.fn(() => "こんにちは、Ada")
    };
    const translator = createI18nextTranslator({ i18n, namespace: "form" });

    expect(translator.translate("greeting", "ja", { name: "Ada" })).toBe("こんにちは、Ada");
    expect(i18n.t).toHaveBeenCalledWith("greeting", { name: "Ada", lng: "ja", ns: "form" });
    expect(i18n.exists).toHaveBeenCalledWith("greeting", { name: "Ada", lng: "ja", ns: "form" });
  });

  it("returns undefined for unresolved keys", () => {
    const translator = createI18nextTranslationAdapter({
      exists: () => false,
      t: (key) => key
    });

    expect(translator.translate("builder.missing", "en")).toBeUndefined();
  });

  it("supports i18next instances without exists by detecting the default key result", () => {
    const translator = createI18nextTranslationAdapter({ t: (key) => `app:${key}` });
    expect(translator.translate("builder.missing", "en")).toBeUndefined();
  });
});
