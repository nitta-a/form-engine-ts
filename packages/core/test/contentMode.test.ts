import { describe, expect, it } from "vitest";
import {
  canShowPollResults,
  contentMetadataToJson,
  createInitialSchemaByMode,
  evaluateQuiz,
  evaluateQuizLocally,
  getContentModeDiagnostics,
  getContentModePolicy,
  getFormContentMode,
  validateContentMode,
  validateContentModeConstraints
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
    expect(validateContentMode(initial)).toEqual([]);
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
    expect(evaluateQuizLocally(schema, { "question-1": "option-2" })).toMatchObject({
      totalScore: 2,
      maxPossibleScore: 2,
      isPassed: true,
      questions: [{ questionId: "question-1", isCorrect: true, correctOptionId: "option-2" }]
    });
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
    expect(validateContentModeConstraints(invalid).issues).toEqual([
      expect.objectContaining({ code: "QUIZ_INVALID_CORRECT_OPTION" })
    ]);
  });
  it("validates mode-specific constraints in the base validator", () => {
    const poll = createInitialSchemaByMode("poll", { title: "Poll", locale: "en" });
    expect(validateContentMode({ ...poll, fields: [] })).toHaveLength(1);
    expect(getContentModeDiagnostics({ ...poll, fields: [] })).toEqual([
      { path: "fields", code: "poll_field_count", message: "Polls require exactly one question." }
    ]);
    expect(validateFormSchema({ ...poll, fields: [] }).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "POLL_SINGLE_FIELD_REQUIRED" })])
    );
    const pollField = poll.fields[0];
    if (pollField === undefined || !("options" in pollField)) throw new Error("Missing poll field");
    const invalidPoll = {
      ...poll,
      fields: [{ ...pollField, type: "text" as const }]
    };
    expect(validateContentModeConstraints(invalidPoll).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "POLL_INVALID_FIELD_TYPE" })])
    );
    const firstOption = pollField.options[0];
    if (firstOption === undefined) throw new Error("Missing poll option");
    const shortPoll = {
      ...poll,
      fields: [{ ...pollField, options: [firstOption] }]
    };
    expect(validateContentModeConstraints(shortPoll).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "POLL_MIN_OPTIONS_REQUIRED" })])
    );
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
