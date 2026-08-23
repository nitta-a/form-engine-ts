import {
  aggregateResponses,
  calculateChoiceDistribution,
  calculateFieldVisibility,
  calculateNumericSummary,
  createSubmission,
  exportResponsesToCsv,
  type FormSchema,
  type FormSubmission,
  isQuestionVisible,
  selectVisibleAnswers,
  validateAnswers,
  validateFormSchema
} from "../src";

const conditionalSchema = {
  id: "conditional",
  version: 1,
  title: "title",
  fields: [
    {
      id: "choice",
      type: "select",
      title: "choice",
      required: false,
      options: [
        { id: "yes", label: "yes" },
        { id: "no", label: "no" }
      ]
    },
    {
      id: "details",
      type: "text",
      title: "details",
      required: true,
      displayCondition: { questionId: "choice", operator: "equals", value: "yes" }
    },
    {
      id: "nested",
      type: "text",
      title: "nested",
      required: true,
      displayCondition: { questionId: "details", operator: "not_empty" }
    },
    { id: "rating", type: "rating", title: "rating", required: false, min: 1, max: 5 }
  ]
} as const satisfies FormSchema;

function response(id: string, values: FormSubmission["values"]): FormSubmission {
  return {
    id,
    formId: "conditional",
    formVersion: 1,
    locale: "en",
    values,
    submittedAt: `2025-01-0${id}T00:00:00.000Z`
  };
}

describe("conditional visibility", () => {
  it.each([
    ["equals", "yes", true],
    ["not_equals", "no", true],
    ["contains", ["yes"], true],
    ["not_empty", "anything", true],
    ["not_equals", "", false]
  ] as const)("evaluates %s", (operator, answer, expected) => {
    const field = {
      ...conditionalSchema.fields[1],
      displayCondition: {
        questionId: "choice",
        operator,
        ...(operator === "not_empty" ? {} : { value: "yes" })
      }
    };
    expect(isQuestionVisible(field, { choice: answer })).toBe(expected);
  });

  it("normalizes Japanese-compatible strings for conditions while preserving primitive types", () => {
    const field = conditionalSchema.fields[1];
    expect(
      isQuestionVisible(
        { ...field, displayCondition: { questionId: "choice", operator: "equals", value: "abc123" } },
        { choice: "  ＡＢＣ１２３  " }
      )
    ).toBe(true);
    expect(
      isQuestionVisible(
        { ...field, displayCondition: { questionId: "choice", operator: "contains", value: "カタカナ" } },
        { choice: "  ｶﾀｶﾅ入力  " }
      )
    ).toBe(true);
    expect(
      isQuestionVisible(
        { ...field, displayCondition: { questionId: "choice", operator: "contains", value: "ABC" } },
        { choice: ["ａｂｃ", "other"] }
      )
    ).toBe(true);
    expect(
      isQuestionVisible(
        { ...field, displayCondition: { questionId: "choice", operator: "not_equals", value: "ABC" } },
        { choice: "ａｂｃ" }
      )
    ).toBe(false);
    expect(
      isQuestionVisible(
        { ...field, displayCondition: { questionId: "choice", operator: "equals", value: 1 } },
        { choice: "1" }
      )
    ).toBe(false);
  });

  it("resolves chains, skips hidden validation, and strips hidden answers", () => {
    const values = { choice: "no", details: "retained", nested: "stale" };
    expect(calculateFieldVisibility(conditionalSchema, values)).toMatchObject({ details: false, nested: false });
    expect(validateAnswers(conditionalSchema, values)).toEqual({ valid: true, issues: [] });
    expect(selectVisibleAnswers(conditionalSchema, values)).toEqual({ choice: "no" });
  });

  it("rejects unknown, self, and cyclic condition sources", () => {
    const unknown = {
      ...conditionalSchema,
      fields: [{ ...conditionalSchema.fields[1], displayCondition: { questionId: "x", operator: "not_empty" } }]
    };
    expect(validateFormSchema(unknown).issues.some((issue) => issue.code === "unknown_condition_source")).toBe(true);
    const self = {
      ...conditionalSchema,
      fields: [{ ...conditionalSchema.fields[1], displayCondition: { questionId: "details", operator: "not_empty" } }]
    };
    expect(validateFormSchema(self).issues.some((issue) => issue.code === "self_condition")).toBe(true);
    const cyclic: FormSchema = {
      ...conditionalSchema,
      fields: [
        {
          id: "a",
          type: "text",
          title: "a",
          required: false,
          displayCondition: { questionId: "b", operator: "not_empty" }
        },
        {
          id: "b",
          type: "text",
          title: "b",
          required: false,
          displayCondition: { questionId: "a", operator: "not_empty" }
        }
      ]
    };
    expect(validateFormSchema(cyclic).issues.some((issue) => issue.code === "condition_cycle")).toBe(true);
  });
});

describe("phase two analytics and export", () => {
  const responses = [
    response("1", { choice: "yes", details: 'A, "quote"', nested: "one", rating: 2 }),
    response("2", { choice: "no", rating: 4 })
  ];

  it("calculates choice distribution and numeric summaries", () => {
    expect(calculateChoiceDistribution(responses, "choice")).toEqual({
      yes: { count: 1, percentage: 50 },
      no: { count: 1, percentage: 50 }
    });
    expect(calculateNumericSummary(responses, "rating")).toEqual({ average: 3, min: 2, max: 4, total: 6 });
    expect(calculateNumericSummary([], "rating")).toEqual({ average: null, min: null, max: null, total: 0 });
  });

  it("aggregates leniently against the current schema", () => {
    const analytics = aggregateResponses(conditionalSchema, [...responses, response("3", { removed: "old" })]);
    expect(analytics.submissionCount).toBe(3);
    expect(analytics.questions.find((item) => item.fieldId === "rating")).toMatchObject({
      kind: "rating",
      answeredCount: 2,
      total: 6
    });
  });

  it("exports Excel-compatible RFC 4180 CSV and rejects mismatches", () => {
    const csv = exportResponsesToCsv(conditionalSchema, responses);
    expect(csv.startsWith("\uFEFFsubmissionId,submittedAt,locale,choice,details,nested,rating\r\n")).toBe(true);
    expect(csv).toContain('"A, ""quote"""');
    expect(exportResponsesToCsv(conditionalSchema, responses, {}).startsWith("\uFEFF")).toBe(true);
    expect(exportResponsesToCsv(conditionalSchema, responses, { withBom: true }).startsWith("\uFEFF")).toBe(true);
    expect(exportResponsesToCsv(conditionalSchema, responses, { withBom: false }).startsWith("\uFEFF")).toBe(false);
    const first = responses[0];
    if (first === undefined) throw new Error("Expected a response");
    expect(() => exportResponsesToCsv(conditionalSchema, [{ ...first, formVersion: 2 }])).toThrow(/does not match/);
  });

  it("requires caller-provided timestamps and excludes hidden values from submissions", () => {
    const submission = createSubmission(
      conditionalSchema,
      { choice: "no", details: "retained" },
      { id: "new", locale: "en", submittedAt: "2025-01-01T00:00:00.000Z" }
    );
    expect(submission.values).toEqual({ choice: "no" });
  });
});
