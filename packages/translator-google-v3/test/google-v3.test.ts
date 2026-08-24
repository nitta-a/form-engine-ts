import { createGoogleV3Translator } from "../src";

function response(status: number, body: unknown): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
}

describe("createGoogleV3Translator", () => {
  it("chunks requests and preserves translated result order", async () => {
    const fetchFn = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { contents: string[] };
      return response(200, { translations: body.contents.map((text) => ({ translatedText: `ja:${text}` })) });
    });
    const translator = createGoogleV3Translator({
      projectId: "project",
      getAccessToken: () => "token",
      maxBatchSize: 2,
      fetchFn
    });
    await expect(translator.translateBatch(["a", "b", "c", "d", "e"], "ja", "en")).resolves.toEqual([
      "ja:a",
      "ja:b",
      "ja:c",
      "ja:d",
      "ja:e"
    ]);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("sends project, location, glossary, and labels to Translation Advanced", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () =>
      response(200, { glossaryTranslations: [{ translatedText: "用語" }] })
    );
    const translator = createGoogleV3Translator({
      projectId: "project id",
      location: "us-central1",
      getAccessToken: () => "secret",
      glossaryConfig: { glossary: "projects/p/locations/us-central1/glossaries/terms", ignoreCase: true },
      labels: { application: "survey" },
      fetchFn
    });
    await expect(translator.translateText("term", "ja", "en")).resolves.toBe("用語");
    expect(fetchFn.mock.calls[0]?.[0]).toBe(
      "https://translation.googleapis.com/v3/projects/project%20id/locations/us-central1:translateText"
    );
    expect(fetchFn.mock.calls[0]?.[1]).toMatchObject({
      headers: { Authorization: "Bearer secret", "Content-Type": "application/json" }
    });
    expect(JSON.parse(String(fetchFn.mock.calls[0]?.[1]?.body))).toEqual({
      contents: ["term"],
      mimeType: "text/plain",
      targetLanguageCode: "ja",
      sourceLanguageCode: "en",
      glossaryConfig: { glossary: "projects/p/locations/us-central1/glossaries/terms", ignoreCase: true },
      labels: { application: "survey" }
    });
  });

  it("retries 429 and 5xx responses with exponential backoff", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(429, "busy"))
      .mockResolvedValueOnce(response(503, "offline"))
      .mockResolvedValueOnce(response(200, { translations: [{ translatedText: "ok" }] }));
    const sleep = vi.fn(async () => undefined);
    const translator = createGoogleV3Translator({
      projectId: "project",
      getAccessToken: () => "token",
      fetchFn,
      retryBaseDelayMs: 10,
      maxRetries: 2,
      sleep
    });
    await expect(translator.translateText("text", "ja")).resolves.toBe("ok");
    expect(sleep.mock.calls).toEqual([[10], [20]]);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("does not retry non-retryable failures and redacts access tokens", async () => {
    const fetchFn = vi.fn(async () => response(400, "invalid token-value"));
    const translator = createGoogleV3Translator({
      projectId: "project",
      getAccessToken: () => "token-value",
      fetchFn
    });
    await expect(translator.translateText("text", "ja")).rejects.toThrow("invalid [redacted]");
    expect(fetchFn).toHaveBeenCalledOnce();
  });
});
