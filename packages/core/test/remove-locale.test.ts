import { collectSchemaLocales, type FormSchema, removeLocaleFromSchema } from "../src";

describe("removeLocaleFromSchema", () => {
  it("removes locale content and metadata from every localized node", () => {
    const schema: FormSchema = {
      id: "remove-locale",
      version: 1,
      title: "Survey",
      defaultLocale: "en",
      supportedLocales: ["en", "zh-Hans", "ja"],
      translations: { "zh-Hans": { title: "问卷" }, ja: { title: "アンケート" } },
      translationMetadata: { "zh-Hans": { title: { source: "legacy" } }, ja: { title: { source: "human" } } },
      fields: [
        {
          id: "kind",
          type: "select",
          title: "Kind",
          required: false,
          translations: { "zh-Hans": { title: "类型" } },
          translationMetadata: { "zh-Hans": { title: { source: "legacy" } } },
          options: [
            {
              id: "one",
              label: "One",
              translations: { "zh-Hans": "一", ja: "一つ" },
              translationMetadata: { "zh-Hans": { label: { source: "legacy" } } }
            }
          ]
        }
      ],
      pages: [
        {
          id: "main",
          title: "Main",
          questionIds: ["kind"],
          translations: { "zh-Hans": { title: "主要" } },
          translationMetadata: { "zh-Hans": { title: { source: "legacy" } } }
        }
      ]
    };

    const result = removeLocaleFromSchema(schema, "zh-Hans");
    expect(result).not.toBe(schema);
    expect(result.supportedLocales).toEqual(["en", "ja"]);
    expect(result.translations).toEqual({ ja: { title: "アンケート" } });
    expect(result.translationMetadata).toEqual({ ja: { title: { source: "human" } } });
    expect(result.fields[0]?.translations).toBeUndefined();
    expect(result.fields[0]?.translationMetadata).toBeUndefined();
    const option =
      result.fields[0] !== undefined && "options" in result.fields[0] ? result.fields[0].options[0] : undefined;
    expect(option?.translations).toEqual({ ja: "一つ" });
    expect(option?.translationMetadata).toBeUndefined();
    expect(result.pages?.[0]?.translations).toBeUndefined();
    expect(result.pages?.[0]?.translationMetadata).toBeUndefined();
    expect(collectSchemaLocales(result).allUniqueLocales.has("zh-Hans")).toBe(false);
  });

  it("rejects removing the default locale", () => {
    const schema: FormSchema = {
      id: "default-locale",
      version: 1,
      title: "Survey",
      defaultLocale: "en",
      supportedLocales: ["en"],
      fields: []
    };
    expect(() => removeLocaleFromSchema(schema, "en")).toThrow("Cannot remove defaultLocale: en");
  });
});
