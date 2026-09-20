import type { CreationAssistantAdapter } from "@form-engine-ts/core";

export function createHttpCreationAssistantAdapter(
  endpoint = "/api/form-assistant/conversation"
): CreationAssistantAdapter {
  return {
    respond: async (request, signal) => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
        ...(signal === undefined ? {} : { signal })
      });
      if (!response.ok) throw new Error(`Creation provider failed (${response.status}).`);
      return response.json();
    }
  };
}
