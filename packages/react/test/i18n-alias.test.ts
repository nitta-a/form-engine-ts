import type { TranslationAdapter } from "@form-engine-ts/core";
import { isTranslationUnresolved, resolveTranslation } from "../src";

describe("translation fallback resolution", () => {
  it("treats namespace-qualified keys as unresolved and falls back to an alias catalog", () => {
    const adapter: TranslationAdapter = {
      translate: (key) => `formEngine.${key}`
    };

    expect(isTranslationUnresolved("formEngine.builder.fields.typeTextarea", "builder.fields.typeTextarea")).toBe(true);
    expect(
      resolveTranslation("builder.fields.typeTextarea", ["builder.fieldType.textarea"], adapter, {
        "builder.fieldType.textarea": "長文テキスト"
      })
    ).toBe("長文テキスト");
  });

  it("falls back when an adapter returns undefined or null", () => {
    const adapter: TranslationAdapter = {
      translate: (key) => (key === "canonical" ? undefined : null)
    };

    expect(resolveTranslation("canonical", ["legacy"], adapter, { legacy: "Legacy {{value}}" }, { value: 2 })).toBe(
      "Legacy 2"
    );
    expect(isTranslationUnresolved(null, "canonical")).toBe(true);
  });
});
