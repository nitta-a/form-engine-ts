import { createGoogleV3Translator, splitTranslationBatch } from "../src";

function response(status: number, body: unknown, headers?: HeadersInit): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    ...(headers === undefined ? {} : { headers })
  });
}

describe("splitTranslationBatch", () => {
  it("splits by both item count and UTF-8 byte limits", () => {
    expect(splitTranslationBatch(["a", "b", "c"], { maxItems: 2, maxCharacters: 10 })).toEqual([["a", "b"], ["c"]]);
    expect(splitTranslationBatch(["あ", "い", "う"], { maxItems: 10, maxCharacters: 6 })).toEqual([
      ["あ", "い"],
      ["う"]
    ]);
  });

  it("rejects limits beyond Google request boundaries and oversized individual items", () => {
    expect(() => splitTranslationBatch(["a"], { maxItems: 1025 })).toThrow(/1024/);
    expect(() => splitTranslationBatch(["a"], { maxCharacters: 30_001 })).toThrow(/30000/);
    expect(() => splitTranslationBatch(["too-large"], { maxCharacters: 2 })).toThrow(/UTF-8 bytes/);
  });
});

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

  it("splits text arrays above 30,000 UTF-8 bytes into safe requests", async () => {
    const requestSizes: number[] = [];
    const fetchFn = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { contents: string[] };
      requestSizes.push(body.contents.reduce((total, text) => total + new TextEncoder().encode(text).length, 0));
      return response(200, { translations: body.contents.map((text) => ({ translatedText: text })) });
    });
    const translator = createGoogleV3Translator({
      projectId: "project",
      getAccessToken: () => "token",
      fetchFn
    });
    const texts = ["a".repeat(10_000), "b".repeat(10_000), "c".repeat(10_000), "d".repeat(10_000)];
    await expect(translator.translateBatch(texts, "ja")).resolves.toEqual(texts);
    expect(requestSizes).toEqual([20_000, 20_000]);
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
      random: () => 1,
      sleep
    });
    await expect(translator.translateText("text", "ja")).resolves.toBe("ok");
    expect(sleep.mock.calls).toEqual([[10], [20]]);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("honors Retry-After while applying full-jitter exponential retry", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(429, "busy", { "Retry-After": "2" }))
      .mockResolvedValueOnce(response(200, { translations: [{ translatedText: "ok" }] }));
    const sleep = vi.fn(async () => undefined);
    const translator = createGoogleV3Translator({
      projectId: "project",
      getAccessToken: () => "token",
      fetchFn,
      retry: { maxRetries: 1, baseDelayMs: 500, maxDelayMs: 10_000 },
      random: () => 0.5,
      sleep
    });
    await expect(translator.translateText("text", "ja")).resolves.toBe("ok");
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("retries temporary network errors", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce(response(200, { translations: [{ translatedText: "ok" }] }));
    const sleep = vi.fn(async () => undefined);
    const translator = createGoogleV3Translator({
      projectId: "project",
      getAccessToken: () => "token",
      fetchFn,
      retry: { maxRetries: 1, baseDelayMs: 10 },
      random: () => 0.5,
      sleep
    });
    await expect(translator.translateText("text", "ja")).resolves.toBe("ok");
    expect(sleep).toHaveBeenCalledWith(5);
  });

  it("reports chunking, characters, retries, and total latency", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(429, "busy"))
      .mockResolvedValueOnce(response(200, { translations: [{ translatedText: "ja:a" }, { translatedText: "ja:bc" }] }))
      .mockResolvedValueOnce(response(200, { translations: [{ translatedText: "ja:d" }] }));
    const onBatchReport = vi.fn();
    const now = vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(135);
    const translator = createGoogleV3Translator({
      projectId: "project",
      getAccessToken: () => "token",
      fetchFn,
      batchLimits: { maxItems: 2 },
      retry: { maxRetries: 1, baseDelayMs: 0 },
      random: () => 0,
      sleep: async () => undefined,
      now,
      onBatchReport
    });
    await expect(translator.translateBatch(["a", "bc", "d"], "ja")).resolves.toEqual(["ja:a", "ja:bc", "ja:d"]);
    expect(onBatchReport).toHaveBeenCalledOnce();
    expect(onBatchReport).toHaveBeenCalledWith({
      totalChunks: 2,
      totalCharacters: 4,
      retryAttempts: 1,
      durationMs: 35
    });
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
