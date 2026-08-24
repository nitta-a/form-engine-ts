import {
  type FormPolicy,
  type FormSchema,
  populateSchemaTranslations,
  transformFieldType,
  validateFormSchema
} from "../src";

const policy: FormPolicy = {
  maxFields: 20,
  maxOptionsPerField: 10,
  maxTextLength: 500,
  requiredLocales: ["ja", "en", "fr", "de"]
};

describe("v2.1 Core authoring APIs", () => {
  it("preserves authoring and extension data while removing incompatible type properties", () => {
    const original = {
      id: "choice",
      type: "select",
      title: "Question",
      description: "Description",
      translationKey: "question.choice",
      required: true,
      displayCondition: { questionId: "prior", operator: "equals", value: true } as const,
      translations: { ja: { title: "質問", description: "説明" } },
      metadata: { argsId: "a-1" },
      translationMetadata: { ja: { title: { isManual: true } } },
      options: [{ id: "yes", label: "Yes" }]
    } as const;

    const textarea = transformFieldType(original, "textarea");
    expect(textarea).toMatchObject({
      id: "choice",
      type: "textarea",
      title: "Question",
      description: "Description",
      translationKey: "question.choice",
      required: true,
      translations: original.translations,
      metadata: original.metadata,
      translationMetadata: original.translationMetadata
    });
    expect("options" in textarea).toBe(false);

    const number = transformFieldType(textarea, "number");
    expect(number.translations).toBe(original.translations);
    expect(number.metadata).toBe(original.metadata);
    expect(number.translationMetadata).toBe(original.translationMetadata);
    expect(number.displayCondition).toEqual(original.displayCondition);
  });

  it("exposes existing translation metadata independently to overwrite decisions", async () => {
    const schema: FormSchema = {
      id: "translation-metadata",
      version: 1,
      title: "Title",
      defaultLocale: "en",
      supportedLocales: ["en", "ja"],
      metadata: { owner: "ARGS" },
      translations: { ja: { title: "手修正" } },
      translationMetadata: { ja: { title: { isManual: true } } },
      fields: [
        {
          id: "name",
          type: "text",
          title: "Name",
          required: false,
          translations: { ja: { title: "名前" } },
          translationMetadata: { ja: { title: { reviewed: false } } }
        }
      ]
    };
    const seen = vi.fn();
    const createMetadata = vi.fn(
      (slot: { readonly existingTranslationMetadata?: Readonly<Record<string, unknown>> }) => ({
        replacedReviewedTranslation: slot.existingTranslationMetadata?.reviewed === false
      })
    );
    const result = await populateSchemaTranslations(
      schema,
      ["ja"],
      {
        translateText: vi.fn(),
        translateBatch: vi.fn(async (texts: readonly string[]) => texts)
      },
      {
        overwrite: "all",
        shouldOverwrite: (slot) => {
          seen(slot);
          return slot.existingTranslationMetadata?.isManual !== true;
        },
        createMetadata
      }
    );
    expect(seen).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeMetadata: { owner: "ARGS" },
        metadata: { owner: "ARGS" },
        existingTranslationMetadata: { isManual: true }
      })
    );
    expect(result.schema.translations?.ja?.title).toBe("手修正");
    expect(result.report.skippedSlots).toContainEqual(expect.objectContaining({ property: "title" }));
    expect(createMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "field",
        existingTranslationMetadata: { reviewed: false }
      }),
      "Name"
    );
    expect(result.schema.fields[0]?.translationMetadata?.ja?.title).toEqual({ replacedReviewedTranslation: true });
  });

  it("validates the complete source-text locale surface and every policy limit", () => {
    const schema: FormSchema = {
      id: "policy",
      version: 1,
      title: "Form",
      description: "Form description",
      completionMessage: "Complete",
      defaultLocale: "en",
      supportedLocales: ["en", "ja", "fr"],
      translations: { ja: { title: "フォーム" } },
      fields: [
        {
          id: "choice",
          type: "select",
          title: "Choice",
          description: "Choose",
          required: false,
          translations: { ja: { title: "選択" } },
          options: [{ id: "one", label: "One" }]
        }
      ],
      pages: [{ id: "page", title: "Page", description: "Page description", questionIds: ["choice"] }]
    };
    const result = validateFormSchema(schema, { policy });
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("Expected policy issues");
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "supportedLocales", code: "required_locale_missing" }),
        expect.objectContaining({ path: "translations.ja.description", code: "required_translation_missing" }),
        expect.objectContaining({ path: "translations.ja.completionMessage", code: "required_translation_missing" }),
        expect.objectContaining({
          path: "fields[0].translations.ja.description",
          code: "required_translation_missing"
        }),
        expect.objectContaining({ path: "fields[0].options[0].translations.ja", code: "required_translation_missing" }),
        expect.objectContaining({ path: "pages[0].translations.ja.title", code: "required_translation_missing" }),
        expect.objectContaining({ path: "pages[0].translations.ja.description", code: "required_translation_missing" })
      ])
    );

    const bytes = validateFormSchema(schema, { policy: { maxSchemaBytes: 1 } });
    expect(bytes.valid).toBe(false);
    if (!bytes.valid)
      expect(bytes.issues).toContainEqual(expect.objectContaining({ code: "max_schema_bytes_exceeded" }));

    const limits = validateFormSchema(schema, {
      policy: { maxFields: 0, maxOptionsPerField: 0, maxTextLength: 3, allowedFieldTypes: ["text"] }
    });
    expect(limits.valid).toBe(false);
    if (!limits.valid) {
      expect(limits.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "max_fields_exceeded" }),
          expect.objectContaining({ code: "max_options_exceeded" }),
          expect.objectContaining({ code: "max_text_length_exceeded" }),
          expect.objectContaining({ code: "disallowed_field_type" })
        ])
      );
    }

    const structuralAndPolicy = validateFormSchema(
      { ...schema, fields: [...schema.fields, schema.fields[0]] },
      { policy: { maxFields: 1 } }
    );
    expect(structuralAndPolicy.valid).toBe(false);
    if (!structuralAndPolicy.valid) {
      expect(structuralAndPolicy.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "duplicate_field" }),
          expect.objectContaining({ code: "max_fields_exceeded" })
        ])
      );
    }
  });
});
