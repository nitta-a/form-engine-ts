import {
  aggregateResponses,
  calculateProgress,
  exportResponsesToCsv,
  type FormSchema,
  validateAnswers,
  validateContentModeConstraints,
  validateFormSchema
} from "../src";

const schema: FormSchema = {
  id: "radio-text",
  version: 1,
  title: "Radio text",
  fields: [
    {
      id: "choice",
      type: "radio",
      title: "Choice",
      required: true,
      options: [
        { id: "yes", label: "Yes" },
        { id: "other", label: "Other", textInput: true }
      ]
    },
    {
      id: "follow-up",
      type: "text",
      title: "Follow-up",
      required: false,
      displayCondition: { questionId: "choice", operator: "equals", value: "other" }
    }
  ]
};

describe("radio option text input", () => {
  it("validates survey radio configuration and compound answers", () => {
    expect(validateFormSchema(schema).valid).toBe(true);
    expect(validateAnswers(schema, { choice: { optionId: "other", text: "Something else" } }).valid).toBe(true);
    expect(validateAnswers(schema, { choice: "other" }).valid).toBe(true);
    expect(validateAnswers(schema, { choice: { optionId: "yes", text: "Not allowed" } }).valid).toBe(false);
    expect(validateAnswers(schema, { choice: { optionId: "missing", text: "Nope" } }).valid).toBe(false);
  });

  it("uses optionId for conditions, progress, and choice analytics", () => {
    const values = { choice: { optionId: "other", text: "Something else" } } as const;
    expect(calculateProgress(schema, values).answeredVisibleQuestions).toBe(1);
    expect(validateAnswers(schema, { ...values, "follow-up": "shown" }).valid).toBe(true);
    const submission = {
      id: "response-1",
      formId: schema.id,
      formVersion: schema.version,
      locale: "en",
      submittedAt: "2026-09-19T00:00:00.000Z",
      values
    };
    expect(aggregateResponses(schema, [submission]).questions[0]).toMatchObject({
      options: [
        { id: "yes", count: 0 },
        { id: "other", count: 1 }
      ]
    });
    expect(exportResponsesToCsv(schema, [submission], { withBom: false })).toContain(
      '"{""optionId"":""other"",""text"":""Something else""}"'
    );
  });

  it("rejects text input outside survey radio fields", () => {
    const selectSchema = {
      ...schema,
      fields: [{ ...schema.fields[0], type: "select" as const }]
    };
    expect(validateFormSchema(selectSchema).valid).toBe(false);
    const validSelectSchema: FormSchema = {
      ...schema,
      fields: [
        {
          id: "choice",
          type: "select",
          title: "Choice",
          required: true,
          options: [{ id: "other", label: "Other" }]
        }
      ]
    };
    expect(validateAnswers(validSelectSchema, { choice: { optionId: "other", text: "No" } }).valid).toBe(false);
    const quizSchema = { ...schema, metadata: { mode: "quiz" as const } };
    expect(validateContentModeConstraints(quizSchema).valid).toBe(false);
  });
});
