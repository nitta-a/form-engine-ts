import {
  computeSourceTextHash,
  type FormSchema,
  getTranslationStatus,
  isDisplayConditionGroupSatisfied,
  isQuestionVisible,
  populateSchemaTranslations,
  validateFormSchema,
  validateSchemaStructure
} from "../src";

const schema: FormSchema = {
  id: "v30",
  version: 1,
  title: "Survey",
  defaultLocale: "en",
  supportedLocales: ["en", "ja"],
  fields: [
    {
      id: "kind",
      type: "select",
      title: "Kind",
      required: false,
      options: [
        { id: "a", label: "A" },
        { id: "b", label: "B" }
      ]
    },
    {
      id: "details",
      type: "text",
      title: "Details",
      required: false,
      displayRule: {
        action: "show",
        condition: {
          logic: "any",
          conditions: [
            { fieldId: "kind", operator: "equals", value: "a" },
            { fieldId: "kind", operator: "equals", value: "b" }
          ]
        }
      }
    }
  ]
};

describe("v3.0 compound conditions and translation lifecycle", () => {
  it("evaluates compound any conditions and validates display rules", () => {
    const details = schema.fields.find((field) => field.id === "details");
    expect(details).toBeDefined();
    if (details === undefined || details.displayRule === undefined) throw new Error("Expected display rule fixture");
    expect(isDisplayConditionGroupSatisfied(details.displayRule.condition, { kind: "b" })).toBe(true);
    expect(isQuestionVisible(details, { kind: "other" })).toBe(false);
    expect(validateFormSchema(schema).valid).toBe(true);
  });

  it("reports display-rule cycles with a cycle path", () => {
    const cyclic: FormSchema = {
      ...schema,
      fields: schema.fields.map((field) =>
        field.id === "kind"
          ? {
              ...field,
              displayRule: {
                action: "show",
                condition: { logic: "all", conditions: [{ fieldId: "details", operator: "is_not_empty" }] }
              }
            }
          : field
      )
    };
    const issues = validateSchemaStructure(cyclic);
    expect(issues.some((issue) => issue.type === "cyclic_condition_reference" && issue.cycle !== undefined)).toBe(true);
  });

  it("marks stale translations and repopulates them through a sync adapter", async () => {
    const stale: FormSchema = {
      ...schema,
      translations: { ja: { title: "古いタイトル" } },
      translationMetadata: {
        ja: {
          title: {
            sourceLocale: "en",
            sourceTextHash: computeSourceTextHash("Old title"),
            translationSource: "automatic"
          }
        }
      }
    };
    expect(getTranslationStatus("New title", "古いタイトル", stale.translationMetadata?.ja?.title)).toBe("stale");
    const populated = await populateSchemaTranslations(stale, ["ja"], {
      translate: () => "新しいタイトル"
    });
    expect(populated.schema.translations?.ja?.title).toBe("新しいタイトル");
    expect(populated.report.staleSlots?.some((slot) => slot.property === "title")).toBe(true);
  });
});
