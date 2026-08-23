import {
  escapeCsvCell,
  exportResponsesToCsv,
  type FormSchema,
  type FormSubmission,
  resolveFormTranslation,
  sanitizeSchema,
  validateSchemaStructure
} from "../src";

describe("natural-language schema translation", () => {
  it("translates display text in one stable batch without changing identifiers or metadata", async () => {
    const adapter = {
      translateText: vi.fn(),
      translateBatch: vi.fn(async (texts: readonly string[]) => texts.map((text) => `translated:${text}`))
    };
    const schema: FormSchema = {
      id: "translation",
      version: 1,
      title: "フォーム",
      description: "説明",
      fields: [
        {
          id: "q_one",
          type: "select",
          title: "質問",
          description: "補足",
          translationKey: "question.one",
          required: true,
          options: [{ id: "opt_one", label: "選択肢" }]
        }
      ]
    };

    const result = await resolveFormTranslation(schema, adapter, "en", "ja");
    expect(adapter.translateBatch).toHaveBeenCalledWith(["フォーム", "説明", "質問", "補足", "選択肢"], "en", "ja");
    expect(result).toMatchObject({
      id: "translation",
      title: "translated:フォーム",
      description: "translated:説明",
      fields: [
        {
          id: "q_one",
          title: "translated:質問",
          description: "translated:補足",
          translationKey: "question.one",
          options: [{ id: "opt_one", label: "translated:選択肢" }]
        }
      ]
    });
    expect(schema.title).toBe("フォーム");
  });

  it("propagates adapter failures and rejects incomplete batches", async () => {
    const failed = {
      translateText: vi.fn(),
      translateBatch: vi.fn(async () => {
        throw new Error("offline");
      })
    };
    await expect(resolveFormTranslation(validSchema, failed, "en")).rejects.toThrow("offline");
    await expect(
      resolveFormTranslation(validSchema, { translateText: vi.fn(), translateBatch: vi.fn(async () => []) }, "en")
    ).rejects.toThrow(/returned 0 texts/);
  });
});

const validSchema: FormSchema = {
  id: "structure",
  version: 1,
  title: "title",
  fields: [
    { id: "first", type: "text", title: "first", required: false },
    {
      id: "second",
      type: "select",
      title: "second",
      required: false,
      options: [{ id: "yes", label: "yes" }],
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
          title: "duplicate",
          required: false,
          options: [
            { id: "same", label: "same" },
            { id: "same", label: "same-again" }
          ]
        },
        { id: "duplicate", type: "text", title: "duplicate-again", required: false },
        {
          id: "dangling",
          type: "text",
          title: "dangling",
          required: false,
          displayCondition: { questionId: "missing", operator: "not_empty" }
        },
        {
          id: "self",
          type: "text",
          title: "self",
          required: false,
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
        },
        {
          id: "dangling",
          type: "text",
          title: "dangling",
          required: false,
          displayCondition: { questionId: "missing", operator: "not_empty" }
        },
        { id: "duplicate", type: "text", title: "one", required: false },
        { id: "duplicate", type: "text", title: "two", required: false }
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
      title: "title",
      fields: [{ id: "text", type: "textarea", title: "text", required: false }]
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
