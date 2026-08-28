import {
  computeSourceTextHash,
  type FormSchema,
  isManualTranslationMetadata,
  migrateSchemaTranslationMetadata,
  populateSchemaTranslations
} from "../src";

const schema: FormSchema = {
  id: "translation-compatibility",
  version: 1,
  title: "Survey",
  defaultLocale: "en",
  supportedLocales: ["en", "ja"],
  fields: [
    {
      id: "name",
      type: "text",
      title: "Name",
      required: false,
      translations: { ja: { title: "手動の名前" } },
      translationMetadata: { ja: { title: { translationSource: "MANUAL", isManuallyEdited: true } } }
    },
    {
      id: "kind",
      type: "select",
      title: "Kind",
      required: false,
      options: [{ id: "one", label: "One" }]
    }
  ],
  pages: [{ id: "main", title: "Main", questionIds: ["name", "kind"] }]
};

describe("translation compatibility", () => {
  it("recognizes legacy manual metadata and protects it during population", async () => {
    expect(isManualTranslationMetadata({ translationSource: "MANUAL" })).toBe(true);
    expect(isManualTranslationMetadata({ isManuallyEdited: true })).toBe(true);
    const adapter = {
      translateText: vi.fn(),
      translateBatch: vi.fn(async (texts: readonly string[]) => texts.map((text) => `translated:${text}`))
    };

    const result = await populateSchemaTranslations(schema, ["ja"], adapter, {
      preserveManualTranslations: true,
      overwrite: "all"
    });

    expect(result.schema.fields[0]?.translations?.ja?.title).toBe("手動の名前");
    expect(result.report.skippedReasons?.["fields.name.title"]).toBe("manual");
    expect(result.report.skippedSlots).toEqual(expect.arrayContaining([expect.objectContaining({ nodeId: "name" })]));
  });

  it("migrates legacy metadata for form, field, option, page, and completion text", () => {
    const legacy: FormSchema = {
      ...schema,
      completionMessage: "Done",
      translationMetadata: { ja: { title: { translationSource: "AUTOMATIC" }, completionMessage: { isManual: true } } },
      fields: [
        {
          id: "kind",
          type: "select",
          title: "Kind",
          required: false,
          translationMetadata: { ja: { title: { isManuallyEdited: true } } },
          options: [
            {
              id: "one",
              label: "One",
              translationMetadata: { ja: { label: { translationSource: "MANUAL" } } }
            }
          ]
        }
      ],
      pages: [{ id: "main", title: "Main", questionIds: ["kind"], translationMetadata: { ja: { title: {} } } }]
    };

    const migrated = migrateSchemaTranslationMetadata(legacy);
    expect(migrated.translationMetadata?.ja?.title).toEqual({
      sourceLocale: "en",
      sourceTextHash: computeSourceTextHash("Survey"),
      translationSource: "automatic"
    });
    expect(migrated.translationMetadata?.ja?.completionMessage?.translationSource).toBe("manual");
    expect(migrated.fields[0]?.translationMetadata?.ja?.title?.translationSource).toBe("manual");
    const migratedChoice = migrated.fields[0];
    expect(
      migratedChoice !== undefined && "options" in migratedChoice
        ? migratedChoice.options[0]?.translationMetadata?.ja?.label
        : undefined
    ).toEqual({
      sourceLocale: "en",
      sourceTextHash: computeSourceTextHash("One"),
      translationSource: "manual"
    });
    expect(migrated.pages?.[0]?.translationMetadata?.ja?.title).toEqual({
      sourceLocale: "en",
      sourceTextHash: computeSourceTextHash("Main"),
      translationSource: "automatic"
    });
  });
});
