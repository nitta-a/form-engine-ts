import { contentMetadataToJson, createInitialSchemaByMode } from "@form-engine-ts/core";
import { describe, expect, it } from "vitest";
import { formSchemaToSurveyDefinition, surveyDefinitionToFormSchema } from "../src/surveyDefinition";

describe("content mode definition conversion", () => {
  it("preserves quiz and unknown metadata through both directions", () => {
    const preset = createInitialSchemaByMode("quiz", { title: "Quiz", locale: "en" });
    const schema = {
      ...preset,
      metadata: contentMetadataToJson({ ...preset.metadata, custom: { keep: true } }),
      fields: preset.fields.map((field) => ({
        ...field,
        metadata: contentMetadataToJson({
          custom: [1, 2],
          quiz: { correctOptionId: "option-1", explanation: "Because", points: 2 }
        })
      }))
    };
    expect(surveyDefinitionToFormSchema(formSchemaToSurveyDefinition(schema))).toEqual(schema);
  });
});
