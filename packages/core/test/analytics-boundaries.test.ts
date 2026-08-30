import {
  aggregateResponses,
  calculateChoiceDistribution,
  calculateCrossTabulation,
  calculateNumericSummary,
  type FormSchema,
  type FormSubmission
} from "../src";

const schema: FormSchema = {
  id: "analytics-boundaries",
  version: 1,
  title: "Analytics boundaries",
  fields: [
    {
      id: "choice",
      type: "multi-select",
      title: "Choice",
      required: false,
      minSelections: 1,
      maxSelections: 2,
      options: [
        { id: "a", label: "A" },
        { id: "b", label: "B" }
      ]
    },
    { id: "score", type: "number", title: "Score", required: false, min: 0, max: 10, step: 2 },
    { id: "rating", type: "rating", title: "Rating", required: false, min: 1, max: 5 },
    { id: "approved", type: "checkbox", title: "Approved", required: false }
  ]
};

function submission(id: string, values: FormSubmission["values"]): FormSubmission {
  return {
    id,
    formId: schema.id,
    formVersion: schema.version,
    locale: "en",
    submittedAt: `2026-08-30T00:00:0${id}.000Z`,
    values
  };
}

describe("analytics boundary handling", () => {
  it("deduplicates multi-select distribution values and ignores empty selections", () => {
    expect(
      calculateChoiceDistribution(
        [
          submission("1", { choice: ["a", "a", "b"] }),
          submission("2", { choice: [] }),
          submission("3", { choice: "" })
        ],
        "choice"
      )
    ).toEqual({
      a: { count: 1, percentage: 33.33333333333333 },
      b: { count: 1, percentage: 33.33333333333333 }
    });
  });

  it("excludes non-finite and out-of-range numeric answers from summaries", () => {
    const responses = [
      submission("1", { score: Number.NaN }),
      submission("2", { score: 4 }),
      submission("3", { score: Infinity })
    ];

    expect(calculateNumericSummary(responses, "score")).toEqual({ average: 4, min: 4, max: 4, total: 4 });
    expect(
      aggregateResponses(schema, [
        submission("1", { score: 3, rating: 6, approved: false, choice: ["a", "a"] }),
        submission("2", { score: 4, rating: 5, approved: true, choice: ["a", "b"] })
      ])
    ).toMatchObject({
      questions: expect.arrayContaining([
        expect.objectContaining({ fieldId: "choice", answeredCount: 1 }),
        expect.objectContaining({ fieldId: "score", answeredCount: 1, minimum: 4, maximum: 4, total: 4 }),
        expect.objectContaining({ fieldId: "rating", answeredCount: 1, minimum: 5, maximum: 5, total: 5 }),
        expect.objectContaining({ fieldId: "approved", answeredCount: 2, trueCount: 1, falseCount: 1 })
      ])
    });
  });

  it("skips incomplete cross-tabulation pairs", () => {
    const responses = [
      submission("1", { row: "a", col: "x" }),
      submission("2", { row: "", col: "x" }),
      submission("3", { row: "b", col: undefined }),
      submission("4", { row: 1, col: "x" })
    ];

    expect(calculateCrossTabulation(responses, "row", "col")).toEqual({
      rowQuestionId: "row",
      colQuestionId: "col",
      matrix: { a: { x: 1 } },
      rowTotals: { a: 1 },
      colTotals: { x: 1 },
      grandTotal: 1
    });
  });
});
