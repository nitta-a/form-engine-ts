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
import { createSchemaFromTemplate, getFormTemplates } from "../src/templates";

describe("content modes", () => {
  it("provides localized templates and creates independent schemas", () => {
    const english = getFormTemplates({ locale: "en" });
    const japanese = getFormTemplates({ locale: "ja-JP" });
    expect(english).toHaveLength(4);
    expect(japanese.map((template) => template.name)).toEqual([
      "満足度調査",
      "意見改善提案",
      "人気投票",
      "理解度チェック"
    ]);
    expect(getFormTemplates({ mode: "poll", locale: "fr" })).toHaveLength(1);
    const template = english.find((candidate) => candidate.id === "popular-choice-poll");
    if (template === undefined) throw new Error("Missing poll template");
    const first = createSchemaFromTemplate({ template, id: "poll-1", title: "Lunch" });
    const second = createSchemaFromTemplate({ template, id: "poll-2", title: "Dinner" });
    expect(first).toMatchObject({ id: "poll-1", title: "Lunch", version: 1, defaultLocale: "en" });
    expect(first.fields).toHaveLength(1);
    expect(first.metadata).toEqual({ mode: "poll", poll: { resultVisibility: "after_submit" } });
    expect(first.fields).not.toBe(second.fields);
    const firstField = first.fields[0];
    const secondField = second.fields[0];
    if (
      firstField === undefined ||
      secondField === undefined ||
      !("options" in firstField) ||
      !("options" in secondField)
    )
      throw new Error("Missing poll options");
    expect(firstField.options).not.toBe(secondField.options);
    expect(firstField.options).toEqual(secondField.options);
    expect(firstField.options).toHaveLength(3);
  });

  it("creates valid quiz and survey templates without contact fields", () => {
    for (const locale of ["en", "ja-JP"]) {
      for (const template of getFormTemplates({ locale })) {
        const schema = createSchemaFromTemplate({
          template,
          id: `form-${locale}-${template.id}`,
          title: template.name
        });
        expect(validateFormSchema(schema).valid).toBe(true);
        expect(schema.defaultLocale).toBe(locale);
        expect(schema.fields.some((field) => /email|name|phone|contact/i.test(field.id))).toBe(false);
        if (template.mode === "poll") {
          expect(schema.fields).toHaveLength(1);
          const pollField = schema.fields[0];
          if (pollField === undefined || !("options" in pollField)) throw new Error("Missing poll field");
          expect(pollField.type).toBe("radio");
          expect(pollField.options).toHaveLength(3);
        }
      }
    }
    for (const locale of ["en", "ja-JP"]) {
      const quiz = getFormTemplates({ mode: "quiz", locale })[0];
      if (quiz === undefined) throw new Error("Missing quiz template");
      expect(quiz.schema.fields).toHaveLength(3);
      expect(quiz.schema.fields.every((field) => field.metadata?.quiz !== undefined)).toBe(true);
    }
  });

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
    expect(validateContentModeConstraints(invalid).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "QUIZ_INVALID_CORRECT_OPTION" })])
    );
  });
  it("validates mode-specific constraints in the base validator", () => {
    const poll = createInitialSchemaByMode("poll", { title: "Poll", locale: "en" });
    expect(validateContentMode({ ...poll, fields: [] })).toHaveLength(1);
    expect(getContentModeDiagnostics({ ...poll, fields: [] })).toEqual([
      { path: "fields", code: "poll_field_count", message: "Question count is outside the configured limits." }
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
