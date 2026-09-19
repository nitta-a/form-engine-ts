import type { AuthoringAssistantAdapter } from "@form-engine-ts/core";

/** Reference adapter: provider credentials stay behind the host application's HTTP endpoint. */
export function createHttpAuthoringAssistantAdapter(endpoint = "/api/form-assistant"): AuthoringAssistantAdapter {
  return {
    async generate(request, signal) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        ...(signal === undefined ? {} : { signal })
      });
      if (!response.ok) throw new Error(`Authoring provider failed (${response.status}).`);
      return response.json();
    }
  };
}
