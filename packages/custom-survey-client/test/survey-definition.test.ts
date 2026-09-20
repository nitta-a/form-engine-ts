import type { FormSchema } from "@form-engine-ts/core";
import {
  createSurveyTextMetadataCodec,
  formSchemaToSurveyDefinition,
  type SurveyDefinition,
  SurveyDefinitionConversionError,
  surveyDefinitionToFormSchema,
  type TypedSurveyDefinition,
  translateSurveySchema
} from "../src";

const definition: SurveyDefinition = {
  id: "customer-survey",
  version: 3,
  locale: "en-US",
  title: "Customer survey",
  description: "Tell us what you think.",
  completionMessage: "Thank you.",
  metadata: { owner: "maker", flags: ["published"] },
  fields: [
    { id: "name", type: "text", title: "Name", required: true },
    { id: "comment", type: "textarea", title: "Comment", maxLength: 500 },
    { id: "score", type: "number", title: "Score", min: 0, max: 10, step: 0.5 },
    { id: "rating", type: "rating", title: "Rating", min: 1, max: 5 },
    {
      id: "contact",
      type: "single-choice",
      selectionStyle: "radio",
      title: "Contact method",
      options: [
        { id: "email", label: "Email", metadata: { channel: "email" } },
        { id: "phone", label: "Phone" }
      ]
    },
    {
      id: "team",
      type: "select",
      title: "Team",
      options: [{ id: "support", label: "Support" }]
    },
    { id: "consent", type: "checkbox", title: "Agree", required: true },
    {
      id: "channels",
      type: "multi-select",
      title: "Channels",
      minSelections: 1,
      maxSelections: 2,
      options: [{ id: "email", label: "Email" }]
    }
  ]
};

describe("survey definition conversion", () => {
  it("converts all supported definition questions into a FormSchema", () => {
    const schema = surveyDefinitionToFormSchema(definition);

    expect(schema).toEqual({
      id: definition.id,
      version: definition.version,
      title: definition.title,
      description: definition.description,
      completionMessage: definition.completionMessage,
      defaultLocale: definition.locale,
      supportedLocales: [definition.locale],
      metadata: definition.metadata,
      fields: expect.arrayContaining([
        expect.objectContaining({ id: "contact", type: "radio" }),
        expect.objectContaining({ id: "team", type: "select" }),
        expect.objectContaining({ id: "channels", minSelections: 1, maxSelections: 2 })
      ])
    });
    expect(schema.fields).toHaveLength(8);
  });

  it("round-trips typed string questions", () => {
    const typedDefinition: SurveyDefinition = {
      ...definition,
      fields: [
        { id: "date", type: "date", title: "Date", minDate: "2026-01-01", maxDate: "2026-12-31" },
        { id: "time", type: "time", title: "Time", minTime: "09:00", maxTime: "18:00" },
        { id: "email", type: "email", title: "Email" },
        { id: "tel", type: "tel", title: "Phone" },
        { id: "url", type: "url", title: "URL" }
      ]
    };
    const schema = surveyDefinitionToFormSchema(typedDefinition);
    expect(schema.fields.map((field) => field.type)).toEqual(["date", "time", "email", "tel", "url"]);
    expect(formSchemaToSurveyDefinition(schema).fields).toEqual(
      typedDefinition.fields.map((field) => ({ ...field, required: false }))
    );
  });

  it("accepts direct radio and preserves the supported values in reverse conversion", () => {
    const schema = surveyDefinitionToFormSchema({
      ...definition,
      fields: [{ id: "choice", type: "radio", title: "Choice", options: [{ id: "a", label: "A" }] }]
    });
    expect(formSchemaToSurveyDefinition(schema)).toEqual({
      id: definition.id,
      version: definition.version,
      locale: definition.locale,
      title: definition.title,
      description: definition.description,
      completionMessage: definition.completionMessage,
      metadata: definition.metadata,
      fields: [
        {
          id: "choice",
          type: "single-choice",
          selectionStyle: "radio",
          title: "Choice",
          required: false,
          options: [{ id: "a", label: "A" }]
        }
      ]
    });
  });

  it("rejects duplicate or malformed question definitions with a path", () => {
    expect(() =>
      surveyDefinitionToFormSchema({
        ...definition,
        fields: [
          { id: "duplicate", type: "text", title: "First" },
          { id: "duplicate", type: "text", title: "Second" }
        ]
      })
    ).toThrowError(new SurveyDefinitionConversionError("fields[1].id", "Question IDs must be unique."));
  });

  it("preserves schema settings, conditions, translations, choice settings, and node metadata", () => {
    const schema: FormSchema = {
      id: "lossless",
      version: 4,
      defaultLocale: "en",
      supportedLocales: ["en"],
      title: "Lossless",
      translations: { ja: { title: "完全" } },
      translationMetadata: { ja: { title: { provider: "machine" } } },
      metadata: { mode: "quiz", quiz: { showExplanation: "immediate" }, extra: { source: "maker" } },
      pages: [
        {
          id: "page-1",
          title: "Page",
          questionIds: ["choice"],
          displayCondition: { questionId: "choice", operator: "is_not_empty" },
          metadata: { layout: "card" },
          translationMetadata: { ja: { title: { provider: "manual" } } }
        }
      ],
      submissionSettings: {
        showConfirmationBeforeSubmit: true,
        confirmationRenderMode: "dialog",
        metadata: { confirmation: "custom" }
      },
      fields: [
        {
          id: "choice",
          type: "radio",
          title: "Choice",
          description: "Pick one",
          required: true,
          translationKey: "choice.title",
          messages: { required: "Choose one" },
          displayCondition: { questionId: "choice", operator: "is_not_empty" },
          translations: { ja: { title: "選択" } },
          translationMetadata: { ja: { title: { provider: "manual" } } },
          metadata: { quiz: { correctOptionId: "yes" } },
          shuffleOptions: true,
          options: [
            {
              id: "yes",
              label: "Yes",
              textInput: true,
              pinned: true,
              metadata: { weight: 1 },
              translations: { ja: "はい" },
              translationMetadata: { ja: { label: { provider: "manual" } } }
            }
          ]
        }
      ]
    };

    expect(surveyDefinitionToFormSchema(formSchemaToSurveyDefinition(schema))).toEqual(schema);
  });

  it("preserves locale configuration and field placeholders", () => {
    const schema: FormSchema = {
      id: "locales",
      version: 1,
      defaultLocale: "en",
      supportedLocales: ["en", "ja", "fr"],
      title: "Locales",
      fields: [
        { id: "text", type: "text", title: "Text", placeholderKey: "text.placeholder", required: false },
        { id: "number", type: "number", title: "Number", placeholderKey: "number.placeholder", required: false }
      ]
    };

    const definition = formSchemaToSurveyDefinition(schema);
    expect(definition).toEqual(expect.objectContaining({ defaultLocale: "en", supportedLocales: ["en", "ja", "fr"] }));
    expect(surveyDefinitionToFormSchema(definition)).toEqual(schema);
  });

  it("uses a separate codec for typed translation metadata", () => {
    type TranslationMetadata = { readonly provider: string };
    const codec = {
      toEngine: (metadata: TranslationMetadata) => ({ provider: metadata.provider.toUpperCase() }),
      fromEngine: (metadata: Readonly<Record<string, import("@form-engine-ts/core").JsonValue>>) => ({
        provider: String(metadata.provider).toLowerCase()
      })
    };
    const definition: TypedSurveyDefinition<
      Record<string, import("@form-engine-ts/core").JsonValue>,
      TranslationMetadata
    > = {
      id: "translation-metadata",
      version: 1,
      locale: "en",
      title: "Translation metadata",
      translationMetadata: { ja: { title: { provider: "machine" } } },
      fields: [
        {
          id: "question",
          type: "text",
          title: "Question",
          translationMetadata: { ja: { title: { provider: "manual" } } }
        }
      ]
    };

    const schema = surveyDefinitionToFormSchema(definition, { translationMetadataCodec: codec });
    expect(schema.translationMetadata).toEqual({ ja: { title: { provider: "MACHINE" } } });
    expect(schema.fields[0]?.translationMetadata).toEqual({ ja: { title: { provider: "MANUAL" } } });
    expect(formSchemaToSurveyDefinition(schema, { translationMetadataCodec: codec }).translationMetadata).toEqual(
      definition.translationMetadata
    );
  });

  it("uses one typed metadata codec for schema, field, and option metadata", () => {
    type Metadata = { readonly owner: string };
    const codec = {
      toEngine: (metadata: Metadata) => ({ owner: metadata.owner.toUpperCase() }),
      fromEngine: (metadata: Readonly<Record<string, import("@form-engine-ts/core").JsonValue>>) => ({
        owner: String(metadata.owner).toLowerCase()
      })
    };
    const definition: TypedSurveyDefinition<Metadata> = {
      id: "typed",
      version: 1,
      locale: "en",
      title: "Typed",
      metadata: { owner: "maker" },
      fields: [
        {
          id: "choice",
          type: "single-choice",
          selectionStyle: "radio",
          title: "Choice",
          metadata: { owner: "field" },
          options: [{ id: "one", label: "One", metadata: { owner: "option" } }]
        }
      ]
    };
    const schema = surveyDefinitionToFormSchema(definition, { metadataCodec: codec });
    expect(schema.metadata).toEqual({ owner: "MAKER" });
    expect(schema.fields[0]?.metadata).toEqual({ owner: "FIELD" });
    expect(formSchemaToSurveyDefinition(schema, { metadataCodec: codec }).metadata).toEqual({ owner: "maker" });
  });
});

describe("survey text metadata codec", () => {
  it("round-trips canonical, legacy, and unknown metadata", () => {
    const codec = createSurveyTextMetadataCodec({ preserveUnknown: true, sourceTextHash: "auto" });
    const encoded = codec.toEngine({
      value: "顧客アンケート",
      sourceText: "Customer survey",
      sourceLocale: "en",
      metadata: {
        translationSource: "manual",
        translatedAt: "2026-09-02T00:00:00.000Z",
        editedAt: "2026-09-02T01:00:00.000Z",
        provider: { model: "test" }
      }
    });

    expect(encoded.metadata).toEqual(
      expect.objectContaining({
        sourceText: "Customer survey",
        sourceLocale: "en",
        translationSource: "manual",
        isManuallyEdited: true,
        translatedAt: "2026-09-02T00:00:00.000Z",
        editedAt: "2026-09-02T01:00:00.000Z",
        provider: { model: "test" },
        sourceTextHash: expect.any(String)
      })
    );

    expect(codec.fromEngine({ ...encoded, metadata: { ...encoded.metadata, isManual: true } })).toEqual(
      expect.objectContaining({ translationSource: "manual", isManuallyEdited: true, provider: { model: "test" } })
    );
  });

  it("uses a schema locale as the translation helper's source locale and forwards the codec", async () => {
    const codec = createSurveyTextMetadataCodec({ preserveUnknown: true, sourceTextHash: "auto" });
    const controller = new AbortController();
    let receivedSignal: AbortSignal | undefined;
    const translated = await translateSurveySchema({
      schema: {
        id: "survey",
        version: 1,
        title: "Survey",
        defaultLocale: "en",
        fields: [{ id: "q", type: "text", title: "Question", required: false }]
      },
      sourceLocale: "en",
      targetLocale: "ja",
      translationAdapter: {
        translateText: async (text) => `${text}:ja`,
        translateBatch: async (texts, _targetLocale, _sourceLocale, signal) => {
          receivedSignal = signal;
          return texts.map((text) => `${text}:ja`);
        }
      },
      metadataPolicy: { source: "AI", preserveManualEdits: true, updateSourceTextHash: true },
      signal: controller.signal,
      metadataCodec: codec
    });

    expect(translated.schema.fields[0]?.translationMetadata?.ja?.title).toEqual(
      expect.objectContaining({ sourceText: "Question", sourceLocale: "en", sourceTextHash: expect.any(String) })
    );
    expect(receivedSignal).toBe(controller.signal);
  });
});

describe("form schema locale conversion", () => {
  it("uses an explicit fallback locale when the schema has no locale registration", () => {
    const schema: FormSchema = { id: "survey", version: 1, title: "Survey", fields: [] };
    expect(formSchemaToSurveyDefinition(schema, { locale: "ja" }).locale).toBe("ja");
  });
});
