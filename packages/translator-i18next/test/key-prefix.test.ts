import { describe, expect, it, vi } from "vitest";
import { createI18nextTranslationAdapter } from "../src";

describe("i18next keyPrefix", () => {
  it("looks up a key under the configured namespace and prefix", () => {
    const i18n = {
      exists: vi.fn(() => true),
      t: vi.fn(() => "Text")
    };
    const translator = createI18nextTranslationAdapter(i18n, { namespace: "common", keyPrefix: "formEngine" });

    expect(translator.translate("builder.fields.typeText", "en")).toBe("Text");
    expect(i18n.exists).toHaveBeenCalledWith("common:formEngine.builder.fields.typeText", {
      lng: "en",
      defaultValue: undefined
    });
    expect(i18n.t).toHaveBeenCalledWith("common:formEngine.builder.fields.typeText", {
      lng: "en",
      defaultValue: undefined
    });
  });

  it("returns undefined so the caller can use its own fallback catalog", () => {
    const translator = createI18nextTranslationAdapter(
      { exists: () => false, t: (key) => key },
      {
        namespace: "common",
        keyPrefix: "formEngine"
      }
    );

    expect(translator.translate("builder.fields.typeText", "en")).toBeUndefined();
  });
});
