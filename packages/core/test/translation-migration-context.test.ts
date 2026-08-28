import {
  computeSourceTextHash,
  type FormSchema,
  migrateSchemaTranslationMetadata,
  type TranslationMetadataMigrator
} from "../src";

const schema: FormSchema = {
  id: "translation-migration-context",
  version: 1,
  title: "Survey",
  description: "Description",
  completionMessage: "Done",
  defaultLocale: "en",
  supportedLocales: ["en", "ja"],
  translationMetadata: {
    ja: {
      title: { source: "legacy" },
      description: { source: "legacy" },
      completionMessage: { source: "legacy" }
    }
  },
  fields: [
    {
      id: "question-1",
      type: "select",
      title: "Question",
      description: "Question description",
      required: false,
      translationMetadata: {
        ja: {
          title: { source: "legacy" },
          description: { source: "legacy" }
        }
      },
      options: [
        {
          id: "option-1",
          label: "Option",
          translationMetadata: { ja: { label: { source: "legacy" } } }
        }
      ]
    }
  ],
  pages: [
    {
      id: "page-1",
      title: "Page",
      questionIds: ["question-1"],
      translationMetadata: { ja: { title: { source: "legacy" } } }
    }
  ]
};

describe("translation metadata migration context", () => {
  it("provides locale, path, property, node, and parent context", () => {
    const contexts: Array<Parameters<TranslationMetadataMigrator>[2]> = [];
    const migrator: TranslationMetadataMigrator = vi.fn((_oldMeta, sourceText, context) => {
      contexts.push(context);
      return {
        sourceLocale: context.defaultLocale,
        sourceTextHash: computeSourceTextHash(sourceText),
        translationSource: "automatic" as const
      };
    });

    migrateSchemaTranslationMetadata(schema, { migrator });

    expect(contexts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          locale: "ja",
          defaultLocale: "en",
          path: "title",
          property: "title",
          nodeKind: "form"
        }),
        expect.objectContaining({
          locale: "ja",
          defaultLocale: "en",
          path: "description",
          property: "description",
          nodeKind: "form"
        }),
        expect.objectContaining({
          locale: "ja",
          defaultLocale: "en",
          path: "completionMessage",
          property: "completionMessage",
          nodeKind: "form"
        }),
        expect.objectContaining({
          locale: "ja",
          defaultLocale: "en",
          path: "fields.question-1.title",
          property: "title",
          nodeKind: "field",
          nodeId: "question-1"
        }),
        expect.objectContaining({
          locale: "ja",
          defaultLocale: "en",
          path: "fields.question-1.description",
          property: "description",
          nodeKind: "field",
          nodeId: "question-1"
        }),
        expect.objectContaining({
          locale: "ja",
          defaultLocale: "en",
          path: "fields.question-1.options.option-1.label",
          property: "label",
          nodeKind: "option",
          nodeId: "option-1",
          parentId: "question-1"
        }),
        expect.objectContaining({
          locale: "ja",
          defaultLocale: "en",
          path: "pages.page-1.title",
          property: "title",
          nodeKind: "page",
          nodeId: "page-1"
        })
      ])
    );
  });
});
