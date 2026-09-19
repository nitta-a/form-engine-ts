# Azure OpenAI Authoring reference

This example keeps Azure credentials and provider calls on the server. It uses the Core JSON Schema for structured
output and parses the provider payload before returning an `AuthoringSuggestion` to the browser.

```ts
import {
  AUTHORING_SUGGESTION_JSON_SCHEMA,
  parseAuthoringSuggestion,
  type AuthoringRequest
} from "@form-engine-ts/core";

export async function POST(request: Request): Promise<Response> {
  const authoringRequest = (await request.json()) as AuthoringRequest;
  const endpoint = `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${process.env.AZURE_OPENAI_API_VERSION}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": process.env.AZURE_OPENAI_API_KEY ?? ""
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: "Return only safe FormSchema operations." },
        { role: "user", content: JSON.stringify(authoringRequest) }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "authoring_suggestion",
          strict: true,
          schema: AUTHORING_SUGGESTION_JSON_SCHEMA
        }
      }
    })
  });
  if (!response.ok) return Response.json({ error: "Provider request failed." }, { status: 502 });
  const payload = (await response.json()) as {
    choices?: readonly [{ message?: { parsed?: unknown; content?: string } }];
  };
  const content = payload.choices?.[0]?.message?.parsed ?? payload.choices?.[0]?.message?.content;
  if (typeof content !== "string" && (content === undefined || typeof content !== "object"))
    return Response.json({ error: "Provider returned no suggestion." }, { status: 502 });
  try {
    const suggestion = parseAuthoringSuggestion(typeof content === "string" ? JSON.parse(content) : content);
    return Response.json(suggestion);
  } catch {
    return Response.json({ error: "Provider returned an invalid suggestion." }, { status: 502 });
  }
}
```

The client can use the preview app's `createHttpAuthoringAssistantAdapter()` or an equivalent `fetch` adapter. The
server must still apply Core policy/schema validation before persistence; this endpoint never receives submission answers.
