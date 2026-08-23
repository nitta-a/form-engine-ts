import {
  escapeCsvCell,
  exportResponsesToCsv,
  type FormSchema,
  type FormSubmission,
  sanitizeSchema,
  validateSchemaStructure
} from "../src";

const validSchema: FormSchema = {
  id: "structure",
  version: 1,
  titleKey: "title",
  fields: [
    { id: "first", type: "text", labelKey: "first" },
    {
      id: "second",
      type: "select",
      labelKey: "second",
      options: [{ value: "yes", labelKey: "yes" }],
      displayCondition: { questionId: "first", operator: "not_empty" }
    }
  ]
};

describe("schema structure validation and sanitization", () => {
  it("returns no issues for a structurally valid schema", () => {
    expect(validateSchemaStructure(validSchema)).toEqual([]);
  });

  it("reports duplicate IDs and invalid condition references in stable order", () => {
    const invalid = {
      ...validSchema,
      fields: [
        {
          id: "duplicate",
          type: "select",
          labelKey: "duplicate",
          options: [
            { value: "same", labelKey: "same" },
            { value: "same", labelKey: "same-again" }
          ]
        },
        { id: "duplicate", type: "text", labelKey: "duplicate-again" },
        {
          id: "dangling",
          type: "text",
          labelKey: "dangling",
          displayCondition: { questionId: "missing", operator: "not_empty" }
        },
        {
          id: "self",
          type: "text",
          labelKey: "self",
          displayCondition: { questionId: "self", operator: "not_empty" }
        }
      ]
    } as FormSchema;
    expect(validateSchemaStructure(invalid).map((issue) => issue.type)).toEqual([
      "duplicate_choice_id",
      "duplicate_question_id",
      "dangling_condition_reference",
      "self_condition_reference"
    ]);
  });

  it("reports every cycle member and removes unsafe conditions without mutating duplicates", () => {
    const invalid = {
      ...validSchema,
      fields: [
        { id: "a", type: "text", labelKey: "a", displayCondition: { questionId: "b", operator: "not_empty" } },
        { id: "b", type: "text", labelKey: "b", displayCondition: { questionId: "a", operator: "not_empty" } },
        {
          id: "dangling",
          type: "text",
          labelKey: "dangling",
          displayCondition: { questionId: "missing", operator: "not_empty" }
        },
        { id: "duplicate", type: "text", labelKey: "one" },
        { id: "duplicate", type: "text", labelKey: "two" }
      ]
    } as FormSchema;
    expect(validateSchemaStructure(invalid).filter((issue) => issue.type === "cyclic_condition_reference")).toEqual([
      expect.objectContaining({ questionId: "a" }),
      expect.objectContaining({ questionId: "b" })
    ]);
    const sanitized = sanitizeSchema(invalid);
    expect(sanitized).not.toBe(invalid);
    expect(sanitized.fields.slice(0, 3).every((field) => field.displayCondition === undefined)).toBe(true);
    expect(sanitized.fields.filter((field) => field.id === "duplicate")).toHaveLength(2);
    expect(invalid.fields[0]?.displayCondition).toBeDefined();
  });
});

describe("RFC 4180 CSV escaping", () => {
  it.each([
    [null, ""],
    [undefined, ""],
    [0, "0"],
    ["plain", "plain"],
    ["one,two", '"one,two"'],
    ['He said "Hello"', '"He said ""Hello"""'],
    ["line one\nline two", '"line one\nline two"'],
    ["line one\r\nline two", '"line one\r\nline two"'],
    ["line one\rline two", '"line one\rline two"'],
    ['comma, quote " and\nline', '"comma, quote "" and\nline"']
  ])("escapes %#", (value, expected) => {
    expect(escapeCsvCell(value)).toBe(expected);
  });

  it("uses the exported escape function for response cells", () => {
    const schema: FormSchema = {
      id: "csv",
      version: 1,
      titleKey: "title",
      fields: [{ id: "text", type: "textarea", labelKey: "text" }]
    };
    const response: FormSubmission = {
      id: "one",
      formId: "csv",
      formVersion: 1,
      locale: "en",
      submittedAt: "2025-01-01T00:00:00.000Z",
      values: { text: 'He said "Hello", then\r\nleft.' }
    };
    expect(exportResponsesToCsv(schema, [response])).toContain('"He said ""Hello"", then\r\nleft."');
  });
});
