import {
  buildAuthoringContext,
  computeAuthoringSchemaHash,
  createInitialSchemaByMode,
  type FormSchema,
  parseAuthoringSuggestion,
  previewAuthoringSuggestion
} from "@form-engine-ts/core";
import { describe, expect, it } from "vitest";
import { mockAuthoringAssistantAdapter } from "./mockAuthoringAssistantAdapter";
import { previewCreationPolicy } from "./previewPolicy";

const schema: FormSchema = {
  ...createInitialSchemaByMode("survey", { id: "preview-authoring", title: "Survey", locale: "en" }),
  fields: [
    {
      id: "q1",
      type: "radio",
      title: "Choice",
      required: false,
      options: [{ id: "o1", label: "One" }]
    }
  ]
};

function generate(request: Parameters<NonNullable<typeof mockAuthoringAssistantAdapter.generate>>[0]) {
  if (mockAuthoringAssistantAdapter.generate === undefined) throw new Error("Mock adapter is missing generate().");
  return mockAuthoringAssistantAdapter.generate(request);
}

const context = {
  schemaHash: computeAuthoringSchemaHash(schema),
  fields: schema.fields.map((field) => ({
    id: field.id,
    type: field.type,
    title: field.title,
    required: field.required
  }))
};

describe("preview authoring mock", () => {
  it("covers form, field, option, and mixed-invalid intents", async () => {
    const form = await generate({ intent: "generate_form", context });
    expect(form.operations.map((operation) => operation.type)).toEqual([
      "updateForm",
      "addField",
      "addField",
      "addField"
    ]);

    const field = await generate({
      intent: "rewrite_field",
      target: { kind: "field", fieldId: "q1" },
      context
    });
    expect(field.operations[0]).toMatchObject({ type: "updateField", fieldId: "q1" });

    const options = await generate({
      intent: "generate_options",
      target: { kind: "field", fieldId: "q1" },
      context
    });
    expect(options.operations).toHaveLength(2);

    const mixed = await generate({ intent: "add_questions", prompt: "invalid", context });
    expect(mixed.operations.map((operation) => operation.operationId)).toEqual(["valid-title", "invalid-field"]);
  });

  it("generates a policy-valid draft for the preview schema", async () => {
    const request = { intent: "generate_form" as const, context: { creationBrief: { purpose: "Learn" } } };
    const suggestion = parseAuthoringSuggestion(
      await generate({
        ...request,
        context: buildAuthoringContext({ schema, request, policy: previewCreationPolicy })
      })
    );
    const preview = previewAuthoringSuggestion(schema, suggestion, { policy: previewCreationPolicy });
    expect(preview.valid, preview.issues.map((issue) => issue.message).join(" ")).toBe(true);
  });
});
