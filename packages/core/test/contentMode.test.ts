import { describe, expect, it } from "vitest";
import {
  canShowPollResults,
  contentMetadataToJson,
  createInitialSchemaByMode,
  evaluateQuiz,
  getContentModeDiagnostics,
  getContentModePolicy,
  getFormContentMode,
  validateContentMode
} from "../src/contentMode";
import { validateFormSchema } from "../src/schema";

describe("content modes", () => {
  it("creates deterministic presets and preserves legacy survey behavior", () => {
    expect(getFormContentMode(undefined)).toBe("survey");
    for (const mode of ["survey", "poll", "quiz"] as const) {
      const schema = createInitialSchemaByMode(mode, { title: "Example", locale: "ja" });
      expect(schema).toEqual(createInitialSchemaByMode(mode, { title: "Example", locale: "ja" }));
      expect(validateFormSchema(schema).valid).toBe(mode !== "survey");
      expect(schema.fields).toHaveLength(mode === "survey" ? 0 : 1);
      if (mode !== "survey")
        expect(schema.fields[0]).toMatchObject({ type: "radio", options: [{ id: "option-1" }, { id: "option-2" }] });
    }
  });
  it("never loosens host policy", () => {
    expect(getContentModePolicy("poll", { maxFields: 0, allowedFieldTypes: ["text"] })).toMatchObject({
      maxFields: 0,
      allowedFieldTypes: []
    });
    expect(getContentModePolicy("quiz", { maxFields: 2 })).toEqual({ maxFields: 2, allowedFieldTypes: ["radio"] });
  });
  it("requires a valid correct option and scores visible answers", () => {
    const initial = createInitialSchemaByMode("quiz", { title: "Quiz", locale: "en" });
    expect(validateContentMode(initial)).toContainEqual({ path: "question-1", message: "Select a correct option." });
    const field = initial.fields[0];
    if (!field) throw new Error("Missing preset");
    const schema = {
      ...initial,
      metadata: contentMetadataToJson({ mode: "quiz", quiz: { passingScore: 2 } }),
      fields: [
        {
          ...field,
          metadata: contentMetadataToJson({ quiz: { correctOptionId: "option-2", points: 2, explanation: "Why" } })
        }
      ]
    };
    expect(evaluateQuiz(schema, { "question-1": "option-2" })).toMatchObject({ score: 2, total: 2, passed: true });
    expect(evaluateQuiz(schema, {})).toMatchObject({ score: 0, passed: false });
    const noThreshold = { ...schema, metadata: contentMetadataToJson({ mode: "quiz", quiz: {} }) };
    expect(evaluateQuiz(noThreshold, { "question-1": "option-2" })).not.toHaveProperty("passed");
    const hidden = {
      ...schema,
      fields: [
        {
          ...field,
          metadata: contentMetadataToJson({ quiz: { correctOptionId: "option-2", points: 2 } }),
          displayCondition: { questionId: "other", operator: "equals" as const, value: "yes" }
        }
      ]
    };
    expect(evaluateQuiz(hidden, {})).toMatchObject({ score: 0, total: 0, questions: [] });
    const invalid = {
      ...schema,
      fields: [{ ...field, metadata: contentMetadataToJson({ quiz: { correctOptionId: "deleted" } }) }]
    };
    expect(() => evaluateQuiz(invalid, {})).toThrow("Invalid quiz");
  });
  it("validates count and score boundaries without changing the base validator", () => {
    const poll = createInitialSchemaByMode("poll", { title: "Poll", locale: "en" });
    expect(validateContentMode({ ...poll, fields: [] })).toHaveLength(1);
    expect(getContentModeDiagnostics({ ...poll, fields: [] })).toEqual([
      { path: "fields", code: "poll_field_count", message: "Polls require exactly one question." }
    ]);
    const quiz = createInitialSchemaByMode("quiz", { title: "Quiz", locale: "en" });
    expect(
      validateContentMode({ ...quiz, metadata: { mode: "quiz", quiz: { passingScore: -1 } } }).some(
        (issue) => issue.path === "metadata.quiz.passingScore"
      )
    ).toBe(true);
  });
  it("copies unknown JSON metadata and rejects lossy values", () => {
    const value = { mode: "survey", custom: { x: [1, "two"] } };
    const copy = contentMetadataToJson(value);
    value.custom.x.push(3);
    expect(copy).toEqual({ mode: "survey", custom: { x: [1, "two"] } });
    for (const invalid of [{ x: undefined }, { x: Number.NaN }, { x: new Date() }])
      expect(() => contentMetadataToJson(invalid)).toThrow();
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(() => contentMetadataToJson(cycle)).toThrow();
  });
  it("applies all publication policies with authorization taking precedence", () => {
    for (const resultVisibility of ["always", "after_submit", "closed_only", "private"] as const) {
      for (const submitted of [false, true])
        for (const closed of [false, true]) {
          const context = { submitted, closed, canViewResults: true };
          expect(canShowPollResults({ resultVisibility }, context)).toBe(
            resultVisibility === "always" ||
              (resultVisibility === "after_submit" && submitted) ||
              (resultVisibility === "closed_only" && closed)
          );
          expect(canShowPollResults({ resultVisibility }, { ...context, canViewResults: false })).toBe(false);
        }
    }
  });
});
