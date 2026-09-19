import {
  type AuthoringAssistantAdapter,
  type AuthoringSuggestion,
  computeAuthoringSchemaHash
} from "@form-engine-ts/core";

/** Deterministic provider used by the preview app; real AI stays in the host app. */
export const mockAuthoringAssistantAdapter: AuthoringAssistantAdapter = {
  async generate(request, signal): Promise<AuthoringSuggestion> {
    if (signal?.aborted) throw new DOMException("The request was cancelled.", "AbortError");
    if (request.schema === undefined) throw new Error("Mock authoring requires request.schema.");
    const prompt = request.prompt?.toLowerCase() ?? "";
    const targetFieldId = request.target?.kind === "field" ? request.target.fieldId : request.schema.fields[0]?.id;
    const invalid = prompt.includes("invalid") || prompt.includes("policy");
    if (request.intent === "generate_form")
      return {
        id: "mock-generate-form",
        summary: "Generate a satisfaction survey",
        rationale: "The mock provider returns a multi-operation form draft.",
        baseSchemaHash: computeAuthoringSchemaHash(request.schema),
        operations: [
          { operationId: "form-title", type: "updateForm", patch: { title: "Satisfaction survey" } },
          { operationId: "rating", type: "addField", field: { type: "rating", title: "Overall satisfaction" } },
          {
            operationId: "reason",
            type: "addField",
            field: { type: "radio", title: "What stood out?", options: [{ label: "Service" }, { label: "Value" }] }
          },
          { operationId: "feedback", type: "addField", field: { type: "textarea", title: "Additional feedback" } }
        ]
      };
    if (request.intent === "rewrite_field") {
      const rewriteOperation: AuthoringSuggestion["operations"][number] =
        targetFieldId === undefined
          ? {
              operationId: "missing-field",
              type: "updateField",
              fieldId: "missing",
              patch: { title: "Improved question" }
            }
          : {
              operationId: "rewrite-field",
              type: "updateField",
              fieldId: targetFieldId,
              patch: { title: "How satisfied were you overall?" }
            };
      return {
        id: "mock-rewrite-field",
        summary: "Improve the selected question",
        baseSchemaHash: computeAuthoringSchemaHash(request.schema),
        operations: [rewriteOperation]
      };
    }
    if (request.intent === "generate_options" && targetFieldId !== undefined)
      return {
        id: "mock-generate-options",
        summary: "Generate answer options",
        baseSchemaHash: computeAuthoringSchemaHash(request.schema),
        operations: [
          { operationId: "option-service", type: "addOption", fieldId: targetFieldId, option: { label: "Service" } },
          { operationId: "option-value", type: "addOption", fieldId: targetFieldId, option: { label: "Value" } }
        ]
      };
    if (invalid)
      return {
        id: "mock-invalid-mix",
        summary: "Mixed valid and invalid operations",
        baseSchemaHash: computeAuthoringSchemaHash(request.schema),
        operations: [
          { operationId: "valid-title", type: "updateForm", patch: { title: "Valid change" } },
          { operationId: "invalid-field", type: "updateField", fieldId: "missing", patch: { title: "Invalid change" } }
        ]
      };
    const radio = prompt.includes("満足") || prompt.includes("satisfaction") || prompt.includes("選択");
    return {
      id: "mock-authoring-suggestion",
      summary: radio ? "Add a satisfaction question" : "Add an open feedback question",
      rationale: "This preview uses a fixed provider-agnostic adapter.",
      baseSchemaHash: computeAuthoringSchemaHash(request.schema),
      operations: [
        radio
          ? {
              operationId: "mock-satisfaction",
              type: "addField",
              field: {
                type: "radio",
                title: "How satisfied were you?",
                required: true,
                options: [{ label: "Very satisfied" }, { label: "Satisfied" }, { label: "Needs improvement" }]
              }
            }
          : {
              operationId: "mock-feedback",
              type: "addField",
              field: { type: "textarea", title: "What could we improve?" }
            }
      ]
    };
  }
};
