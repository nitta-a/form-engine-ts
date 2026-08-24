import {
  type AsyncTranslationAdapter,
  type FormSchema,
  populateSchemaTranslations,
  resolveLocalizedSchema,
  sanitizeSchema,
  validateFormSchema
} from "../src";

const schema: FormSchema = {
  id: "metadata-form",
  version: 2,
  title: "Survey",
  description: "Description",
  completionMessage: "Thank you",
  defaultLocale: "en",
  supportedLocales: ["en", "ja"],
  metadata: { owner: "ARGS", flags: [true, 2] },
  translationMetadata: { ja: { title: { provider: "human" } } },
  translations: { ja: { title: "既存タイトル", completionMessage: "ありがとうございました" } },
  fields: [
    {
      id: "choice",
      type: "select",
      title: "Choice",
      required: true,
      metadata: { externalId: "args-choice" },
      options: [{ id: "yes", label: "Yes", metadata: { score: 1 } }]
    }
  ],
  pages: [{ id: "main", title: "Main", questionIds: ["choice"], metadata: { group: "primary" } }]
};

const adapter: AsyncTranslationAdapter = {
  async translateText(text, locale) {
    return `${locale}:${text}`;
  },
  async translateBatch(texts, locale) {
    return texts.map((text) => `${locale}:${text}`);
  }
};

describe("v2 extensible schema", () => {
  it("validates JSON metadata and preserves it through sanitization and localization", () => {
    expect(validateFormSchema(schema)).toMatchObject({ valid: true });
    const sanitized = sanitizeSchema(schema);
    const localized = resolveLocalizedSchema(sanitized, "ja");
    expect(localized.title).toBe("既存タイトル");
    expect(localized.completionMessage).toBe("ありがとうございました");
    expect(localized.metadata).toEqual(schema.metadata);
    expect(localized.translationMetadata).toEqual(schema.translationMetadata);
    expect(localized.fields[0]?.metadata).toEqual({ externalId: "args-choice" });
    const field = localized.fields[0];
    expect(field !== undefined && "options" in field ? field.options[0]?.metadata : undefined).toEqual({ score: 1 });
    expect(localized.pages?.[0]?.metadata).toEqual({ group: "primary" });
  });

  it("rejects non-JSON metadata", () => {
    const result = validateFormSchema({ ...schema, metadata: { bad: Number.NaN } });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.issues).toContainEqual(expect.objectContaining({ code: "invalid_metadata" }));
    const nonPlain = validateFormSchema({ ...schema, metadata: new Date("2026-01-01T00:00:00.000Z") });
    expect(nonPlain.valid).toBe(false);
  });
});

describe("translation overwrite policy and report", () => {
  it("defaults to missing-only, reports slots, and creates per-slot metadata", async () => {
    const result = await populateSchemaTranslations(schema, ["ja"], adapter, {
      createMetadata: (slot) => ({ origin: "machine", property: slot.property })
    });
    expect(result.schema.translations?.ja?.title).toBe("既存タイトル");
    expect(result.schema.translations?.ja?.description).toBe("ja:Description");
    expect(result.schema.translations?.ja?.completionMessage).toBe("ありがとうございました");
    expect(result.report.skippedSlots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "form", property: "title", existingText: "既存タイトル" }),
        expect.objectContaining({ kind: "form", property: "completionMessage" })
      ])
    );
    expect(result.report.updatedSlots).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "field", nodeId: "choice", property: "title" })])
    );
    expect(result.schema.fields[0]?.translationMetadata?.ja?.title).toEqual({
      origin: "machine",
      property: "title"
    });
    expect(schema.fields[0]?.translations).toBeUndefined();
  });

  it("supports overwrite-all and a slot predicate", async () => {
    const overwritten = await populateSchemaTranslations(schema, ["ja"], adapter, { overwrite: "all" });
    expect(overwritten.schema.translations?.ja?.title).toBe("ja:Survey");
    const selective = await populateSchemaTranslations(schema, ["ja"], adapter, {
      overwrite: "all",
      shouldOverwrite: (slot) => slot.property === "completionMessage"
    });
    expect(selective.schema.translations?.ja?.title).toBe("既存タイトル");
    expect(selective.schema.translations?.ja?.completionMessage).toBe("ja:Thank you");
  });

  it("rejects response-count mismatches without mutating the source schema", async () => {
    const mismatched: AsyncTranslationAdapter = {
      ...adapter,
      async translateBatch() {
        return [];
      }
    };
    await expect(populateSchemaTranslations(schema, ["fr"], mismatched)).rejects.toThrow(/returned 0 texts/);
    expect(schema.translations?.fr).toBeUndefined();
  });
});
