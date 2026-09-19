import { describe, expect, it } from "vitest";
import {
  type AuthoringOperation,
  type AuthoringSuggestion,
  applyAuthoringSuggestion,
  computeAuthoringSchemaHash,
  createInitialSchemaByMode,
  type FormField,
  previewAuthoringSuggestion,
  validateAuthoringSuggestion
} from "../src";

const base = {
  ...createInitialSchemaByMode("survey", { id: "authoring", title: "Survey", locale: "en" }),
  fields: [{ id: "q1", type: "text" as const, title: "Question", required: false }]
};
const suggestion = (operations: AuthoringSuggestion["operations"]): AuthoringSuggestion => ({
  id: "suggestion-1",
  summary: "Add questions",
  baseSchemaHash: computeAuthoringSchemaHash(base),
  operations
});

describe("authoring suggestions", () => {
  it("previews and applies fields/options with generated IDs", () => {
    const value = suggestion([
      {
        operationId: "add-rating",
        type: "addField",
        field: { type: "radio", title: "How was it?", options: [{ label: "Good" }, { label: "Bad" }] }
      }
    ]);
    const before = structuredClone(base);
    const preview = previewAuthoringSuggestion(base, value);
    expect(preview.valid).toBe(true);
    expect(preview.schema.fields.at(-1)).toMatchObject({ title: "How was it?" });
    const lastField = preview.schema.fields.at(-1);
    expect(lastField === undefined ? false : "options" in lastField).toBe(true);
    if (lastField !== undefined && "options" in lastField)
      expect(lastField.options.map((option) => option.id)).toEqual(["option-1", "option-2"]);
    const result = applyAuthoringSuggestion(base, value, undefined, {
      idFactory: (kind, ids) => `${kind}-${ids.size + 1}`
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.schema.fields.at(-1)?.id).toBe("field-2");
    expect(base).toEqual(before);
  });

  it("adds and patches options without replacing the containing field", () => {
    const choice = {
      ...base,
      fields: [
        {
          id: "choice",
          type: "radio" as const,
          title: "Choice",
          required: false,
          options: [{ id: "option-1", label: "One", pinned: true }]
        }
      ]
    };
    const value: AuthoringSuggestion = {
      ...suggestion([
        { operationId: "add", type: "addOption", fieldId: "choice", option: { label: "Two" } },
        {
          operationId: "update",
          type: "updateOption",
          fieldId: "choice",
          optionId: "option-1",
          patch: { label: "Updated" }
        }
      ]),
      baseSchemaHash: computeAuthoringSchemaHash(choice)
    };
    const result = applyAuthoringSuggestion(choice, value);
    expect(result.success).toBe(true);
    if (result.success) {
      const field = result.schema.fields[0];
      expect(field).toMatchObject({ title: "Choice" });
      expect(field !== undefined && "options" in field ? field.options : []).toEqual([
        { id: "option-1", label: "Updated", pinned: true },
        { id: "option-2", label: "Two" }
      ]);
    }
  });

  it("patches fields without dropping extension data", () => {
    const field: FormField = {
      ...(base.fields[0] as FormField),
      metadata: { owner: "test" },
      translations: { ja: { title: "旧" } },
      translationMetadata: { ja: { title: { reviewed: true } } },
      displayRule: { action: "show" as const, condition: { logic: "all" as const, conditions: [] } }
    };
    const schema = { ...base, supportedLocales: ["en", "ja"], fields: [field] };
    const value: AuthoringSuggestion = {
      ...suggestion([{ operationId: "rewrite", type: "updateField", fieldId: field.id, patch: { title: "New" } }]),
      baseSchemaHash: computeAuthoringSchemaHash(schema)
    };
    const result = applyAuthoringSuggestion(schema, value);
    expect(result.success).toBe(true);
    if (result.success)
      expect(result.schema.fields[0]).toMatchObject({
        title: "New",
        metadata: field.metadata,
        translations: field.translations,
        translationMetadata: field.translationMetadata,
        displayRule: field.displayRule
      });
  });

  it("rejects policy violations, missing nodes, partial operations and stale schemas", () => {
    const invalid = suggestion([
      { operationId: "bad", type: "addField", field: { type: "rating", title: "too long" } }
    ]);
    expect(validateAuthoringSuggestion(invalid, base, { allowedFieldTypes: ["text"], maxTextLength: 3 }).valid).toBe(
      false
    );
    const missing: AuthoringSuggestion = {
      ...invalid,
      operations: [{ operationId: "missing", type: "updateField", fieldId: "nope", patch: { title: "x" } }]
    };
    expect(applyAuthoringSuggestion(base, missing).success).toBe(false);
    const two = suggestion([
      { operationId: "one", type: "updateForm", patch: { title: "One" } },
      { operationId: "two", type: "updateForm", patch: { description: "Two" } }
    ]);
    const partial = applyAuthoringSuggestion(base, two, ["two"]);
    expect(partial.success).toBe(true);
    const stale = applyAuthoringSuggestion({ ...base, title: "changed" }, two);
    expect(stale).toMatchObject({ success: false, error: { code: "stale_schema" } });
  });

  it("enforces field, option, and text policy limits", () => {
    const addField = suggestion([{ operationId: "field", type: "addField", field: { type: "text", title: "New" } }]);
    expect(validateAuthoringSuggestion(addField, base, { maxFields: 1 }).valid).toBe(false);
    const addOptions = suggestion([
      {
        operationId: "choice",
        type: "addField",
        field: { type: "radio", title: "Pick", options: [{ label: "One" }, { label: "Two" }] }
      }
    ]);
    expect(validateAuthoringSuggestion(addOptions, base, { maxOptionsPerField: 1 }).valid).toBe(false);
    const addText = suggestion([{ operationId: "text", type: "addField", field: { type: "text", title: "1234" } }]);
    expect(validateAuthoringSuggestion(addText, base, { maxTextLength: 3 }).valid).toBe(false);
  });

  it("previews only selected operations and exposes before/after values", () => {
    const value = suggestion([
      { operationId: "one", type: "updateField", fieldId: "q1", patch: { title: "Updated" } },
      { operationId: "two", type: "updateForm", patch: { title: "Form" } }
    ]);
    const preview = previewAuthoringSuggestion(base, value, ["one"]);
    expect(preview.valid).toBe(true);
    expect(preview.operations.map((operation) => operation.operationId)).toEqual(["one"]);
    const operationPreviews = preview.operationPreviews ?? [];
    expect(operationPreviews).toHaveLength(2);
    expect(operationPreviews[0]).toMatchObject({
      operationId: "one",
      before: { kind: "field", field: { title: "Question" } },
      after: { kind: "field", field: { title: "Updated" } }
    });
  });

  it("allows a valid selected operation when another operation exceeds a cumulative limit", () => {
    const value = suggestion([
      { operationId: "one", type: "addField", field: { type: "text", title: "One" } },
      { operationId: "two", type: "addField", field: { type: "text", title: "Two" } }
    ]);
    const preview = previewAuthoringSuggestion(base, value, ["one"], { maxFields: 2 });
    expect(preview.valid).toBe(true);
    expect(preview.schema.fields).toHaveLength(2);
    expect((preview.operationPreviews ?? []).find((item) => item.operationId === "two")?.valid).toBe(true);
  });

  it("preserves page membership and rejects runtime-only protected properties", () => {
    const paged = { ...base, pages: [{ id: "page-1", title: "Page", questionIds: ["q1"] }] };
    const add = suggestion([
      { operationId: "page-add", type: "addField", pageId: "page-1", field: { type: "text", title: "Paged" } }
    ]);
    const pagedSuggestion: AuthoringSuggestion = { ...add, baseSchemaHash: computeAuthoringSchemaHash(paged) };
    const applied = applyAuthoringSuggestion(paged, pagedSuggestion);
    expect(applied.success).toBe(true);
    if (applied.success) expect(applied.schema.pages?.[0]?.questionIds).toHaveLength(2);

    const unsafe = {
      ...suggestion([
        {
          operationId: "unsafe",
          type: "updateField",
          fieldId: "q1",
          patch: { title: "safe", metadata: { owner: "ai" } }
        } as unknown as AuthoringOperation
      ]),
      baseSchemaHash: computeAuthoringSchemaHash(base)
    } as unknown as AuthoringSuggestion;
    expect(applyAuthoringSuggestion(base, unsafe)).toMatchObject({
      success: false,
      error: { code: "validation_failed" }
    });
    const unknown = {
      ...suggestion([
        { operationId: "unknown", type: "updateForm", patch: {}, extra: true } as unknown as AuthoringOperation
      ])
    } as unknown as AuthoringSuggestion;
    expect(validateAuthoringSuggestion(unknown, base).valid).toBe(false);
    const unsupported = {
      ...suggestion([{ operationId: "remove", type: "removeField" } as unknown as AuthoringOperation])
    } as unknown as AuthoringSuggestion;
    expect(validateAuthoringSuggestion(unsupported, base).valid).toBe(false);
  });
});
