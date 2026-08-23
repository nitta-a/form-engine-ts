import { createGoogleTranslator } from "../src";

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

function translations(...values: string[]): Response {
  return jsonResponse({ data: { translations: values.map((translatedText) => ({ translatedText })) } });
}

describe("createGoogleTranslator", () => {
  it("uses API Key authentication with the default endpoint", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => translations("こんにちは"));
    const translator = createGoogleTranslator({ apiKey: "api-secret", fetchFn: fetchMock as unknown as typeof fetch });

    await expect(translator.translateText("Hello", "ja")).resolves.toBe("こんにちは");
    const [input, init] = fetchMock.mock.calls[0] ?? [];
    const url = new URL(String(input));
    expect(`${url.origin}${url.pathname}`).toBe("https://translation.googleapis.com/language/translate/v2");
    expect(url.searchParams.get("key")).toBe("api-secret");
    expect(init?.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(String(init?.body))).toEqual({ q: ["Hello"], target: "ja", format: "text" });
  });

  it("preserves custom endpoint parameters and sends a source language", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => translations("Hallo", "Welt"));
    const translator = createGoogleTranslator({
      apiKey: "api-secret",
      apiEndpoint: "https://example.test/translate?quotaUser=user",
      fetchFn: fetchMock as unknown as typeof fetch
    });

    await expect(translator.translateBatch(["Hello", "world"], "de", "en")).resolves.toEqual(["Hallo", "Welt"]);
    const [input, init] = fetchMock.mock.calls[0] ?? [];
    const url = new URL(String(input));
    expect(url.origin + url.pathname).toBe("https://example.test/translate");
    expect(Object.fromEntries(url.searchParams)).toEqual({ quotaUser: "user", key: "api-secret" });
    expect(JSON.parse(String(init?.body))).toEqual({
      q: ["Hello", "world"],
      target: "de",
      format: "text",
      source: "en"
    });
  });

  it("uses a synchronous Bearer token without adding an API Key", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => translations("Bonjour"));
    const translator = createGoogleTranslator({
      getAccessToken: () => "sync-token",
      fetchFn: fetchMock as unknown as typeof fetch
    });
    await expect(translator.translateText("Hello", "fr")).resolves.toBe("Bonjour");
    const [input, init] = fetchMock.mock.calls[0] ?? [];
    expect(new URL(String(input)).searchParams.has("key")).toBe(false);
    expect(init?.headers).toEqual({ "Content-Type": "application/json", Authorization: "Bearer sync-token" });
  });

  it("gets a fresh asynchronous Bearer token for every non-empty request", async () => {
    const tokens = ["first-token", "second-token"];
    const getAccessToken = vi.fn(async () => tokens.shift() ?? "unexpected");
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => translations("translated"));
    const translator = createGoogleTranslator({
      getAccessToken,
      fetchFn: fetchMock as unknown as typeof fetch
    });
    await translator.translateText("one", "ja");
    await translator.translateText("two", "ja");
    expect(getAccessToken).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([, init]) => init?.headers)).toEqual([
      { "Content-Type": "application/json", Authorization: "Bearer first-token" },
      { "Content-Type": "application/json", Authorization: "Bearer second-token" }
    ]);
  });

  it("returns an empty batch without resolving credentials or fetching", async () => {
    const getAccessToken = vi.fn(() => "token");
    const fetchMock = vi.fn();
    const translator = createGoogleTranslator({
      getAccessToken,
      fetchFn: fetchMock as unknown as typeof fetch
    });
    await expect(translator.translateBatch([], "ja")).resolves.toEqual([]);
    expect(getAccessToken).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("decodes supported named and numeric HTML entities exactly once", async () => {
    const encoded = "&quot;Hi&#39;&apos;&amp;&lt;&gt;&#65;&#x1F600;&unknown;&#xD800;&amp;quot;";
    const translator = createGoogleTranslator({
      apiKey: "key",
      fetchFn: vi.fn(async () => translations(encoded)) as unknown as typeof fetch
    });
    await expect(translator.translateText("text", "en")).resolves.toBe("\"Hi''&<>A😀&unknown;&#xD800;&quot;");
  });

  it("accepts 128 texts and rejects larger batches before authentication", async () => {
    const values = Array.from({ length: 128 }, (_, index) => `text-${index}`);
    const getAccessToken = vi.fn(() => "token");
    const fetchMock = vi.fn(async () => translations(...values));
    const translator = createGoogleTranslator({
      getAccessToken,
      fetchFn: fetchMock as unknown as typeof fetch
    });
    await expect(translator.translateBatch(values, "ja")).resolves.toEqual(values);
    await expect(translator.translateBatch([...values, "overflow"], "ja")).rejects.toThrow(/no more than 128/);
    expect(getAccessToken).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("rejects invalid credentials, endpoint, tokens, and translation inputs", async () => {
    expect(() => createGoogleTranslator({})).toThrow(/exactly one/);
    expect(() => createGoogleTranslator({ apiKey: "key", getAccessToken: () => "token" })).toThrow(/exactly one/);
    expect(() => createGoogleTranslator({ apiKey: " " })).toThrow(TypeError);
    expect(() => createGoogleTranslator({ apiKey: "key", apiEndpoint: "not a URL" })).toThrow(/valid absolute URL/);

    const emptyToken = createGoogleTranslator({
      getAccessToken: () => " ",
      fetchFn: vi.fn() as unknown as typeof fetch
    });
    await expect(emptyToken.translateText("text", "ja")).rejects.toThrow(TypeError);
    const failedToken = createGoogleTranslator({
      getAccessToken: () => {
        throw new Error("credential store unavailable");
      },
      fetchFn: vi.fn() as unknown as typeof fetch
    });
    await expect(failedToken.translateText("text", "ja")).rejects.toThrow(/token provider failed/);

    const translator = createGoogleTranslator({ apiKey: "key", fetchFn: vi.fn() as unknown as typeof fetch });
    await expect(translator.translateText(1 as unknown as string, "ja")).rejects.toThrow(TypeError);
    await expect(translator.translateBatch([1] as unknown as string[], "ja")).rejects.toThrow(TypeError);
    await expect(translator.translateText("text", " ")).rejects.toThrow(TypeError);
    await expect(translator.translateText("text", "ja", " ")).rejects.toThrow(TypeError);
  });

  it.each([400, 403, 500])("reports Google JSON errors for HTTP %i without retrying", async (status) => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: { message: "request rejected" } }, status));
    const translator = createGoogleTranslator({ apiKey: "key", fetchFn: fetchMock as unknown as typeof fetch });
    await expect(translator.translateText("text", "ja")).rejects.toThrow(
      `Google Translation request failed with HTTP ${status}: request rejected`
    );
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("reports plain-text errors and redacts both credential types", async () => {
    const apiKeyTranslator = createGoogleTranslator({
      apiKey: "api-secret",
      fetchFn: vi.fn(async () => new Response("api-secret was rejected", { status: 403 })) as unknown as typeof fetch
    });
    const apiError = await apiKeyTranslator.translateText("text", "ja").catch((cause: unknown) => cause);
    expect((apiError as Error).message).toContain("[redacted]");
    expect((apiError as Error).message).not.toContain("api-secret");

    const tokenTranslator = createGoogleTranslator({
      getAccessToken: () => "bearer-secret",
      fetchFn: vi.fn(async () =>
        jsonResponse({ error: { message: "bearer-secret was rejected" } }, 403)
      ) as unknown as typeof fetch
    });
    const tokenError = await tokenTranslator.translateText("text", "ja").catch((cause: unknown) => cause);
    expect((tokenError as Error).message).toContain("[redacted]");
    expect((tokenError as Error).message).not.toContain("bearer-secret");
  });

  it("wraps network and response body read failures", async () => {
    const network = createGoogleTranslator({
      apiKey: "key",
      fetchFn: vi.fn(async () => {
        throw new Error("offline");
      }) as unknown as typeof fetch
    });
    await expect(network.translateText("text", "ja")).rejects.toThrow(/before receiving an HTTP response/);

    const unreadable = createGoogleTranslator({
      apiKey: "key",
      fetchFn: vi.fn(
        async () =>
          ({ ok: true, status: 200, text: async () => Promise.reject(new Error("stream failed")) }) as Response
      ) as unknown as typeof fetch
    });
    await expect(unreadable.translateText("text", "ja")).rejects.toThrow(/body could not be read/);
  });

  it("rejects malformed successful responses", async () => {
    const invalidJson = createGoogleTranslator({
      apiKey: "key",
      fetchFn: vi.fn(async () => new Response("not-json")) as unknown as typeof fetch
    });
    await expect(invalidJson.translateText("text", "ja")).rejects.toThrow(/invalid JSON/);

    const missing = createGoogleTranslator({
      apiKey: "key",
      fetchFn: vi.fn(async () => jsonResponse({ data: {} })) as unknown as typeof fetch
    });
    await expect(missing.translateText("text", "ja")).rejects.toThrow(/data\.translations/);

    const wrongCount = createGoogleTranslator({
      apiKey: "key",
      fetchFn: vi.fn(async () => translations()) as unknown as typeof fetch
    });
    await expect(wrongCount.translateText("text", "ja")).rejects.toThrow(/0 translations for 1 texts/);

    const invalidItem = createGoogleTranslator({
      apiKey: "key",
      fetchFn: vi.fn(async () => jsonResponse({ data: { translations: [{}] } })) as unknown as typeof fetch
    });
    await expect(invalidItem.translateText("text", "ja")).rejects.toThrow(/index 0 is invalid/);
  });
});
