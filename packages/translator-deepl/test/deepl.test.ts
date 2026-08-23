import { createDeeplTranslator } from "../src";

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

describe("createDeeplTranslator", () => {
  it("sends a single translation to the Free endpoint without an omitted source language", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ translations: [{ text: "こんにちは" }] })
    );
    const translator = createDeeplTranslator({ apiKey: "secret", fetchFn: fetchMock as unknown as typeof fetch });

    await expect(translator.translateText("Hello", "JA")).resolves.toBe("こんにちは");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api-free.deepl.com/v2/translate");
    expect(init).toMatchObject({
      method: "POST",
      headers: { Authorization: "DeepL-Auth-Key secret", "Content-Type": "application/json" }
    });
    expect(JSON.parse(String(init?.body))).toEqual({ text: ["Hello"], target_lang: "JA" });
  });

  it("uses the Pro endpoint and preserves batch order and source language", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ translations: [{ text: "Hallo" }, { text: "Welt" }] })
    );
    const translator = createDeeplTranslator({
      apiKey: "secret",
      apiType: "pro",
      fetchFn: fetchMock as unknown as typeof fetch
    });

    await expect(translator.translateBatch(["Hello", "world"], "DE", "EN")).resolves.toEqual(["Hallo", "Welt"]);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api.deepl.com/v2/translate");
    expect(JSON.parse(String(init?.body))).toEqual({ text: ["Hello", "world"], target_lang: "DE", source_lang: "EN" });
  });

  it("returns an empty batch without making a request", async () => {
    const fetchMock = vi.fn();
    const translator = createDeeplTranslator({ apiKey: "secret", fetchFn: fetchMock as unknown as typeof fetch });
    await expect(translator.translateBatch([], "JA")).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects invalid factory and call inputs", async () => {
    expect(() => createDeeplTranslator({ apiKey: " " })).toThrow(TypeError);
    expect(() => createDeeplTranslator({ apiKey: "secret", apiType: "other" as "free" })).toThrow(TypeError);
    const translator = createDeeplTranslator({ apiKey: "secret", fetchFn: vi.fn() as unknown as typeof fetch });
    await expect(translator.translateText("text", " ")).rejects.toThrow(TypeError);
    await expect(translator.translateBatch([1] as unknown as string[], "JA")).rejects.toThrow(TypeError);
  });

  it.each([403, 429, 500])("reports HTTP %i with the API message and no retry", async (status) => {
    const fetchMock = vi.fn(async () => jsonResponse({ message: "request rejected" }, status));
    const translator = createDeeplTranslator({ apiKey: "secret", fetchFn: fetchMock as unknown as typeof fetch });
    await expect(translator.translateText("Hello", "JA")).rejects.toThrow(
      `DeepL request failed with HTTP ${status}: request rejected`
    );
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("redacts the API key from HTTP errors", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ message: "key secret is invalid" }, 403));
    const translator = createDeeplTranslator({ apiKey: "secret", fetchFn: fetchMock as unknown as typeof fetch });
    const error = await translator.translateText("Hello", "JA").catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("[redacted]");
    expect((error as Error).message).not.toContain("secret");
  });

  it("wraps network failures without request details", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("offline");
    });
    const translator = createDeeplTranslator({ apiKey: "secret", fetchFn: fetchMock as unknown as typeof fetch });
    await expect(translator.translateText("Hello", "JA")).rejects.toThrow(
      "DeepL request failed before receiving an HTTP response."
    );
  });

  it("rejects malformed success responses", async () => {
    const invalidJson = createDeeplTranslator({
      apiKey: "secret",
      fetchFn: vi.fn(async () => new Response("not-json")) as unknown as typeof fetch
    });
    await expect(invalidJson.translateText("Hello", "JA")).rejects.toThrow(/invalid JSON/);

    const missing = createDeeplTranslator({
      apiKey: "secret",
      fetchFn: vi.fn(async () => jsonResponse({ result: [] })) as unknown as typeof fetch
    });
    await expect(missing.translateText("Hello", "JA")).rejects.toThrow(/translations array/);

    const wrongCount = createDeeplTranslator({
      apiKey: "secret",
      fetchFn: vi.fn(async () => jsonResponse({ translations: [] })) as unknown as typeof fetch
    });
    await expect(wrongCount.translateText("Hello", "JA")).rejects.toThrow(/0 translations for 1 texts/);

    const invalidItem = createDeeplTranslator({
      apiKey: "secret",
      fetchFn: vi.fn(async () => jsonResponse({ translations: [{}] })) as unknown as typeof fetch
    });
    await expect(invalidItem.translateText("Hello", "JA")).rejects.toThrow(/index 0 is invalid/);
  });
});
