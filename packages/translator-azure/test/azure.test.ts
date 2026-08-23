import { createAzureTranslator } from "../src";

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

function translations(...values: string[]): Response {
  return jsonResponse(values.map((text) => ({ translations: [{ text, to: "ja" }] })));
}

describe("createAzureTranslator", () => {
  it("uses the default endpoint and subscription key without a region", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => translations("こんにちは"));
    const translator = createAzureTranslator({
      apiKey: "azure-secret",
      fetchFn: fetchMock as unknown as typeof fetch
    });

    await expect(translator.translateText("Hello", "ja")).resolves.toBe("こんにちは");
    const [input, init] = fetchMock.mock.calls[0] ?? [];
    const url = new URL(String(input));
    expect(`${url.origin}${url.pathname}`).toBe("https://api.cognitive.microsofttranslator.com/translate");
    expect(Object.fromEntries(url.searchParams)).toEqual({ "api-version": "3.0", to: "ja" });
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({
      "Content-Type": "application/json; charset=UTF-8",
      "Ocp-Apim-Subscription-Key": "azure-secret"
    });
    expect(JSON.parse(String(init?.body))).toEqual([{ Text: "Hello" }]);
  });

  it("preserves custom endpoint parameters and sends region and source", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => translations("Hallo", "Welt"));
    const translator = createAzureTranslator({
      apiKey: "azure-secret",
      region: "japaneast",
      endpoint:
        "https://resource.cognitiveservices.azure.com/translator/text/v3.0/translate?category=custom&from=stale",
      fetchFn: fetchMock as unknown as typeof fetch
    });

    await expect(translator.translateBatch(["Hello", "world"], "de", "en")).resolves.toEqual(["Hallo", "Welt"]);
    const [input, init] = fetchMock.mock.calls[0] ?? [];
    const url = new URL(String(input));
    expect(`${url.origin}${url.pathname}`).toBe(
      "https://resource.cognitiveservices.azure.com/translator/text/v3.0/translate"
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      category: "custom",
      from: "en",
      "api-version": "3.0",
      to: "de"
    });
    expect(init?.headers).toEqual({
      "Content-Type": "application/json; charset=UTF-8",
      "Ocp-Apim-Subscription-Key": "azure-secret",
      "Ocp-Apim-Subscription-Region": "japaneast"
    });
    expect(JSON.parse(String(init?.body))).toEqual([{ Text: "Hello" }, { Text: "world" }]);
  });

  it("removes a stale source query when sourceLocale is omitted", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => translations("こんにちは"));
    const translator = createAzureTranslator({
      apiKey: "key",
      endpoint: "https://example.test/translate?from=stale&client=value",
      fetchFn: fetchMock as unknown as typeof fetch
    });
    await translator.translateText("Hello", "ja");
    const [input] = fetchMock.mock.calls[0] ?? [];
    const url = new URL(String(input));
    expect(url.searchParams.has("from")).toBe(false);
    expect(url.searchParams.get("client")).toBe("value");
  });

  it("returns an empty batch without fetching", async () => {
    const fetchMock = vi.fn();
    const translator = createAzureTranslator({ apiKey: "key", fetchFn: fetchMock as unknown as typeof fetch });
    await expect(translator.translateBatch([], "ja")).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts 1,000 texts and rejects larger batches before fetching", async () => {
    const values = Array.from({ length: 1_000 }, (_, index) => `text-${index}`);
    const fetchMock = vi.fn(async () => translations(...values));
    const translator = createAzureTranslator({ apiKey: "key", fetchFn: fetchMock as unknown as typeof fetch });
    await expect(translator.translateBatch(values, "ja")).resolves.toEqual(values);
    await expect(translator.translateBatch([...values, "overflow"], "ja")).rejects.toThrow(/no more than 1000/);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("enforces individual and aggregate character limits using UTF-16 code units", async () => {
    const fetchMock = vi.fn(async () => translations("ok"));
    const translator = createAzureTranslator({ apiKey: "key", fetchFn: fetchMock as unknown as typeof fetch });

    await expect(translator.translateText("😀".repeat(25_000), "ja")).resolves.toBe("ok");
    await expect(translator.translateText("a".repeat(50_001), "ja")).rejects.toThrow(/index 0/);
    await expect(translator.translateText("😀".repeat(25_001), "ja")).rejects.toThrow(/index 0/);
    await expect(translator.translateBatch(["a".repeat(25_000), "b".repeat(25_001)], "ja")).rejects.toThrow(/in total/);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("accepts empty text values", async () => {
    const translator = createAzureTranslator({
      apiKey: "key",
      fetchFn: vi.fn(async () => translations("")) as unknown as typeof fetch
    });
    await expect(translator.translateText("", "ja")).resolves.toBe("");
  });

  it("rejects invalid configuration and translation inputs", async () => {
    expect(() => createAzureTranslator(undefined as unknown as { apiKey: string })).toThrow(TypeError);
    expect(() => createAzureTranslator({ apiKey: " " })).toThrow(TypeError);
    expect(() => createAzureTranslator({ apiKey: "key", region: " " })).toThrow(TypeError);
    expect(() => createAzureTranslator({ apiKey: "key", endpoint: "not a URL" })).toThrow(/valid absolute URL/);

    const translator = createAzureTranslator({ apiKey: "key", fetchFn: vi.fn() as unknown as typeof fetch });
    await expect(translator.translateText(1 as unknown as string, "ja")).rejects.toThrow(TypeError);
    await expect(translator.translateBatch([1] as unknown as string[], "ja")).rejects.toThrow(TypeError);
    await expect(translator.translateText("text", " ")).rejects.toThrow(TypeError);
    await expect(translator.translateText("text", "ja", " ")).rejects.toThrow(TypeError);
  });

  it("reports an unavailable global fetch", () => {
    const originalFetch = globalThis.fetch;
    vi.stubGlobal("fetch", undefined);
    try {
      expect(() => createAzureTranslator({ apiKey: "key" })).toThrow(/Fetch is unavailable/);
    } finally {
      vi.stubGlobal("fetch", originalFetch);
    }
  });

  it.each([401, 403, 429, 500])("reports Azure JSON errors for HTTP %i without retrying", async (status) => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ error: { code: "RequestRejected", message: "request rejected" } }, status)
    );
    const translator = createAzureTranslator({ apiKey: "key", fetchFn: fetchMock as unknown as typeof fetch });
    await expect(translator.translateText("text", "ja")).rejects.toThrow(
      `Azure Translator request failed with HTTP ${status}: RequestRejected: request rejected`
    );
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("reports plain-text errors and redacts the API key", async () => {
    const translator = createAzureTranslator({
      apiKey: "azure-secret",
      fetchFn: vi.fn(async () => new Response("azure-secret was rejected", { status: 403 })) as unknown as typeof fetch
    });
    const error = await translator.translateText("text", "ja").catch((cause: unknown) => cause);
    expect((error as Error).message).toContain("[redacted]");
    expect((error as Error).message).not.toContain("azure-secret");
  });

  it("redacts the API key in structured Azure errors", async () => {
    const translator = createAzureTranslator({
      apiKey: "azure-secret",
      fetchFn: vi.fn(async () =>
        jsonResponse({ error: { code: 401000, message: "azure-secret is invalid" } }, 401)
      ) as unknown as typeof fetch
    });
    const error = await translator.translateText("text", "ja").catch((cause: unknown) => cause);
    expect((error as Error).message).toContain("401000: [redacted] is invalid");
    expect((error as Error).message).not.toContain("azure-secret");
  });

  it("wraps network and response body read failures", async () => {
    const network = createAzureTranslator({
      apiKey: "azure-secret",
      fetchFn: vi.fn(async () => {
        throw new Error("azure-secret is offline");
      }) as unknown as typeof fetch
    });
    const networkError = await network.translateText("text", "ja").then(
      () => {
        throw new Error("Expected the Azure request to fail.");
      },
      (cause: unknown) => cause as Error
    );
    expect(networkError.message).toMatch(/before receiving an HTTP response/);
    expect((networkError.cause as Error).message).toBe("[redacted] is offline");

    const unreadable = createAzureTranslator({
      apiKey: "key",
      fetchFn: vi.fn(
        async () =>
          ({ ok: true, status: 200, text: async () => Promise.reject(new Error("stream failed")) }) as Response
      ) as unknown as typeof fetch
    });
    await expect(unreadable.translateText("text", "ja")).rejects.toThrow(/body could not be read/);
  });

  it("rejects malformed successful responses", async () => {
    const invalidJson = createAzureTranslator({
      apiKey: "key",
      fetchFn: vi.fn(async () => new Response("not-json")) as unknown as typeof fetch
    });
    await expect(invalidJson.translateText("text", "ja")).rejects.toThrow(/invalid JSON/);

    const nonArray = createAzureTranslator({
      apiKey: "key",
      fetchFn: vi.fn(async () => jsonResponse({ translations: [] })) as unknown as typeof fetch
    });
    await expect(nonArray.translateText("text", "ja")).rejects.toThrow(/must be an array/);

    const wrongCount = createAzureTranslator({
      apiKey: "key",
      fetchFn: vi.fn(async () => jsonResponse([])) as unknown as typeof fetch
    });
    await expect(wrongCount.translateText("text", "ja")).rejects.toThrow(/0 results for 1 texts/);

    const missingTranslations = createAzureTranslator({
      apiKey: "key",
      fetchFn: vi.fn(async () => jsonResponse([{}])) as unknown as typeof fetch
    });
    await expect(missingTranslations.translateText("text", "ja")).rejects.toThrow(/translations array/);

    const invalidTranslation = createAzureTranslator({
      apiKey: "key",
      fetchFn: vi.fn(async () => jsonResponse([{ translations: [{}] }])) as unknown as typeof fetch
    });
    await expect(invalidTranslation.translateText("text", "ja")).rejects.toThrow(/index 0 is invalid/);
  });
});
