import {
  aggregateResponses,
  createSubmission,
  type FormSchema,
  type FormValues,
  validateAnswers,
  validateFormSchema
} from "../src";

const schema = {
  id: "survey",
  version: 1,
  titleKey: "survey.title",
  fields: [
    { id: "text", type: "text", labelKey: "text", required: true, minLength: 2, maxLength: 4, pattern: "^[A-Z]+$" },
    { id: "notes", type: "textarea", labelKey: "notes", maxLength: 10 },
    { id: "number", type: "number", labelKey: "number", required: true, min: 2, max: 10, step: 2 },
    {
      id: "select",
      type: "select",
      labelKey: "select",
      required: true,
      options: [
        { value: "a", labelKey: "a" },
        { value: "b", labelKey: "b" }
      ]
    },
    {
      id: "multi",
      type: "multi-select",
      labelKey: "multi",
      required: true,
      minSelections: 2,
      maxSelections: 2,
      options: [
        { value: "x", labelKey: "x" },
        { value: "y", labelKey: "y" },
        { value: "z", labelKey: "z" }
      ]
    },
    { id: "check", type: "checkbox", labelKey: "check", required: true },
    {
      id: "radio",
      type: "radio",
      labelKey: "radio",
      options: [
        { value: "yes", labelKey: "yes" },
        { value: "no", labelKey: "no" }
      ]
    }
  ]
} as const satisfies FormSchema;

const validValues: FormValues = {
  text: "AB",
  notes: "Fine",
  number: 4,
  select: "a",
  multi: ["x", "y"],
  check: true,
  radio: "yes"
};

describe("schema validation", () => {
  it("accepts the full field surface", () => {
    expect(validateFormSchema(schema)).toMatchObject({ valid: true });
  });

  it.each([
    [{ ...schema, fields: [...schema.fields, schema.fields[0]] }, "duplicate_field"],
    [{ ...schema, fields: [{ id: "bad", type: "text", labelKey: "bad", pattern: "[" }] }, "invalid_pattern"],
    [{ ...schema, fields: [{ id: "bad", type: "number", labelKey: "bad", min: 5, max: 1 }] }, "contradictory_bounds"],
    [
      {
        ...schema,
        fields: [
          {
            id: "bad",
            type: "select",
            labelKey: "bad",
            options: [
              { value: "x", labelKey: "x" },
              { value: "x", labelKey: "x2" }
            ]
          }
        ]
      },
      "duplicate_option"
    ],
    [
      {
        ...schema,
        fields: [
          {
            id: "bad",
            type: "multi-select",
            labelKey: "bad",
            minSelections: 2,
            maxSelections: 1,
            options: [
              { value: "x", labelKey: "x" },
              { value: "y", labelKey: "y" }
            ]
          }
        ]
      },
      "contradictory_bounds"
    ]
  ])("rejects malformed schema rules", (candidate, code) => {
    const result = validateFormSchema(candidate);
    expect(result.valid).toBe(false);
    expect(result.issues.some((item) => item.code === code)).toBe(true);
  });
});

describe("answer validation", () => {
  it("accepts valid boundary-aware answers", () => {
    expect(validateAnswers(schema, validValues)).toEqual({ valid: true, issues: [] });
  });

  it.each([
    [{ ...validValues, text: " " }, "text", "required"],
    [{ ...validValues, text: "A" }, "text", "min_length"],
    [{ ...validValues, text: "ABCDE" }, "text", "max_length"],
    [{ ...validValues, text: "Ab" }, "text", "pattern"],
    [{ ...validValues, number: 1 }, "number", "min"],
    [{ ...validValues, number: 12 }, "number", "max"],
    [{ ...validValues, number: 3 }, "number", "step"],
    [{ ...validValues, select: "other" }, "select", "invalid_option"],
    [{ ...validValues, multi: [] }, "multi", "required"],
    [{ ...validValues, multi: ["x"] }, "multi", "min_selections"],
    [{ ...validValues, multi: ["x", "y", "z"] }, "multi", "max_selections"],
    [{ ...validValues, multi: ["x", "x"] }, "multi", "invalid_option"],
    [{ ...validValues, check: false }, "check", "required"],
    [{ ...validValues, extra: "value" }, "extra", "unknown_field"]
  ])("reports rule failures", (values, fieldId, code) => {
    const result = validateAnswers(schema, values);
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ fieldId, code }));
  });
});

describe("submissions and analytics", () => {
  it("creates an immutable, timestamped defensive submission", () => {
    const mutable = { ...validValues, multi: ["x", "y"] };
    const submission = createSubmission(schema, mutable, {
      id: "one",
      locale: "en",
      submittedAt: "2025-01-01T00:00:00.000Z"
    });
    mutable.multi.push("z");
    expect(submission).toMatchObject({
      id: "one",
      formId: "survey",
      formVersion: 1,
      locale: "en",
      submittedAt: "2025-01-01T00:00:00.000Z"
    });
    expect(submission.values.multi).toEqual(["x", "y"]);
    expect(Object.isFrozen(submission)).toBe(true);
  });

  it("refuses invalid submissions", () => {
    expect(() =>
      createSubmission(schema, {}, { id: "bad", locale: "en", submittedAt: "2025-01-01T00:00:00.000Z" })
    ).toThrow(/Invalid form answers/);
  });

  it("returns empty aggregates and mixed response statistics without text contents", () => {
    expect(aggregateResponses(schema, [])).toMatchObject({ submissionCount: 0 });
    const first = createSubmission(schema, validValues, { id: "one", locale: "en", submittedAt: "2025-01-01" });
    const second = createSubmission(
      schema,
      { ...validValues, text: "CD", notes: undefined, number: 8, select: "b", multi: ["x", "y"], check: true },
      { id: "two", locale: "ja", submittedAt: "2025-01-02" }
    );
    const result = aggregateResponses(schema, [first, second]);
    expect(result.submissionCount).toBe(2);
    expect(result.questions.find((item) => item.fieldId === "text")).toEqual({
      fieldId: "text",
      kind: "text",
      answeredCount: 2,
      unansweredCount: 0
    });
    expect(result.questions.find((item) => item.fieldId === "number")).toMatchObject({
      minimum: 4,
      maximum: 8,
      average: 6
    });
    expect(result.questions.find((item) => item.fieldId === "select")).toMatchObject({
      options: [
        { value: "a", count: 1, percentageOfSubmissions: 50 },
        { value: "b", count: 1, percentageOfSubmissions: 50 }
      ]
    });
    expect(JSON.stringify(result)).not.toContain("Fine");
  });

  it("rejects mismatched and invalid persisted submissions", () => {
    const valid = createSubmission(schema, validValues, {
      id: "one",
      locale: "en",
      submittedAt: "2025-01-01T00:00:00.000Z"
    });
    expect(() => aggregateResponses(schema, [{ ...valid, formVersion: 2 }])).toThrow(/does not match/);
    expect(aggregateResponses(schema, [{ ...valid, values: {} }]).submissionCount).toBe(1);
  });
});
