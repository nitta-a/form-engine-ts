import {
  collectSchemaLocales,
  type FormPolicy,
  type FormSchema,
  populateSchemaTranslations,
  sanitizeSchema,
  validateFormSchema
} from "../src";

const schema: FormSchema = {
  id: "locale-policy",
  version: 1,
  title: "Locale policy",
  defaultLocale: "en",
  supportedLocales: ["en", "ja", "zh"],
  fields: [{ id: "name", type: "text", title: "Name", required: false }]
};

function issueCodes(policy: FormPolicy): readonly string[] {
  const result = validateFormSchema(schema, { policy });
  if (result.valid) return [];
  return result.issues.map((item) => item.code);
}

describe("v2.2 locale policy", () => {
  it("rejects unsupported default and registered locales", () => {
    expect(issueCodes({ allowedLocales: ["en", "ja"] })).toContain("disallowed_locale");
    const invalidDefault = validateFormSchema(
      { ...schema, defaultLocale: "zh" },
      { policy: { allowedLocales: ["en"] } }
    );
    expect(invalidDefault.valid).toBe(false);
    if (!invalidDefault.valid) {
      expect(invalidDefault.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "defaultLocale", code: "disallowed_locale" }),
          expect.objectContaining({ path: "supportedLocales[1]", code: "disallowed_locale" })
        ])
      );
    }
  });

  it("counts unique default and supported locales against maxLocales", () => {
    expect(issueCodes({ maxLocales: 2 })).toContain("max_locales_exceeded");
    const withinLimit = validateFormSchema(
      { ...schema, supportedLocales: ["en", "ja"] },
      { policy: { maxLocales: 2 } }
    );
    expect(withinLimit.valid).toBe(true);
  });

  it("reports contradictory required and allowed locale policies", () => {
    expect(issueCodes({ allowedLocales: ["en", "ja"], requiredLocales: ["zh"] })).toContain(
      "required_locale_not_allowed"
    );
  });

  it("collects locales from every translation and translation-metadata surface", () => {
    const collected = collectSchemaLocales({
      ...schema,
      translations: { fr: { title: "Formulaire" } },
      translationMetadata: { de: { title: { source: "human" } } },
      fields: [
        {
          id: "choice",
          type: "select",
          title: "Choice",
          required: false,
          translations: { it: { title: "Scelta" } },
          options: [
            {
              id: "yes",
              label: "Yes",
              translations: { es: "Sí" },
              translationMetadata: { zh: { label: { source: "human" } } }
            }
          ]
        }
      ],
      pages: [
        {
          id: "page",
          title: "Page",
          questionIds: ["choice"],
          translations: { ko: { title: "페이지" } },
          translationMetadata: { pt: { title: { source: "human" } } }
        }
      ]
    });
    expect([...collected.translationLocales]).toEqual(["fr", "de", "it", "es", "zh", "ko", "pt"]);
    expect(collected.allUniqueLocales).toEqual(new Set(["en", "ja", "zh", "fr", "de", "it", "es", "ko", "pt"]));
  });

  it("reports unregistered and disallowed nested translation locales and counts them for maxLocales", () => {
    const nested: FormSchema = {
      ...schema,
      supportedLocales: ["en", "ja"],
      fields: [
        {
          id: "choice",
          type: "select",
          title: "Choice",
          required: false,
          translations: { fr: { title: "Choix" } },
          options: [
            {
              id: "yes",
              label: "Yes",
              translationMetadata: { zh: { label: { source: "human" } } }
            }
          ]
        }
      ],
      pages: [
        {
          id: "main",
          title: "Main",
          questionIds: ["choice"],
          translations: { ja: { title: "メイン" }, fr: { title: "Principal" } },
          translationMetadata: { zh: { title: { stale: true } } }
        }
      ]
    };
    const result = validateFormSchema(nested, { policy: { allowedLocales: ["en", "ja"], maxLocales: 2 } });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "fields[0].translations.fr",
          code: "unregistered_translation_locale"
        }),
        expect.objectContaining({
          path: "fields[0].options[0].translationMetadata.zh",
          code: "disallowed_locale"
        }),
        expect.objectContaining({ code: "max_locales_exceeded" })
      ])
    );
  });

  it("purges unregistered locale content from every node during sanitization", () => {
    const dirty: FormSchema = {
      ...schema,
      supportedLocales: ["en", "ja"],
      translations: { ja: { title: "フォーム" }, fr: { title: "Formulaire" } },
      translationMetadata: { fr: { title: { stale: true } } },
      fields: [
        {
          id: "choice",
          type: "select",
          title: "Choice",
          required: false,
          translations: { fr: { title: "Choix" } },
          options: [
            {
              id: "yes",
              label: "Yes",
              translations: { ja: "はい", fr: "Oui" },
              translationMetadata: { zh: { label: { stale: true } } }
            }
          ]
        }
      ],
      pages: [
        {
          id: "main",
          title: "Main",
          questionIds: ["choice"],
          translations: { ja: { title: "メイン" }, fr: { title: "Principal" } },
          translationMetadata: { zh: { title: { stale: true } } }
        }
      ]
    };
    const sanitized = sanitizeSchema(dirty);
    expect(sanitized.translations).toEqual({ ja: { title: "フォーム" } });
    expect(sanitized.translationMetadata).toBeUndefined();
    expect(sanitized.fields[0]?.translations).toBeUndefined();
    const field = sanitized.fields[0];
    expect(field !== undefined && "options" in field ? field.options[0]?.translations : undefined).toEqual({
      ja: "はい"
    });
    expect(
      field !== undefined && "options" in field ? field.options[0]?.translationMetadata : undefined
    ).toBeUndefined();
    expect(sanitized.pages?.[0]?.translations).toEqual({ ja: { title: "メイン" } });
    expect(sanitized.pages?.[0]?.translationMetadata).toBeUndefined();
  });

  it("guards translation targets against locale policy before calling the adapter", async () => {
    const adapter = { translateText: vi.fn(), translateBatch: vi.fn() };
    await expect(
      populateSchemaTranslations(schema, ["fr"], adapter, { policy: { allowedLocales: ["en", "ja", "zh"] } })
    ).rejects.toThrow(/not allowed/);
    await expect(populateSchemaTranslations(schema, ["fr"], adapter, { policy: { maxLocales: 3 } })).rejects.toThrow(
      /At most 3 locales/
    );
    expect(adapter.translateBatch).not.toHaveBeenCalled();
  });
});
