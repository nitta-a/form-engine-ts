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
