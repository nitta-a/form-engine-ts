import { collectTranslationSlots, type FormSchema, normalizeLocale, sanitizeSchema } from "../src";

describe("locale normalization", () => {
  it("returns canonical BCP 47 tags and rejects malformed values", () => {
    expect(normalizeLocale(" EN-us ")).toBe("en-US");
    expect(normalizeLocale("ja_JP")).toBe("ja-JP");
    expect(normalizeLocale("zh_hans")).toBe("zh-Hans");
    expect(normalizeLocale("en-u")).toBeNull();
  });

  it("canonicalizes registered locales and locale-keyed content during sanitization", () => {
    const schema: FormSchema = {
      id: "locale-normalization",
      version: 1,
      title: "Survey",
      defaultLocale: "EN-us",
      supportedLocales: ["en_US", "JA"],
      translations: { "en-US": { title: "Survey" }, ja: { title: "アンケート" } },
      fields: [{ id: "name", type: "text", title: "Name", required: false }]
    };

    const sanitized = sanitizeSchema(schema);

    expect(sanitized.defaultLocale).toBe("en-US");
    expect(sanitized.supportedLocales).toEqual(["en-US", "ja"]);
    expect(sanitized.translations).toEqual({ "en-US": { title: "Survey" }, ja: { title: "アンケート" } });
  });

  it("uses the unified JSON path convention for translation slots", () => {
    const schema: FormSchema = {
      id: "translation-paths",
      version: 1,
      title: "Survey",
      completionMessage: "Done",
      defaultLocale: "en",
      supportedLocales: ["en", "ja"],
      fields: [
        {
          id: "q1",
          type: "select",
          title: "Question",
          required: false,
          options: [{ id: "opt1", label: "Option" }]
        }
      ]
    };

    expect(collectTranslationSlots(schema, "ja").map((slot) => slot.path)).toEqual([
      "form.title",
      "form.completionMessage",
      "fields.q1.title",
      "fields.q1.options.opt1.label"
    ]);
  });
});
