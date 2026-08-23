import type { AsyncTranslationAdapter } from "@form-engine/core";

export interface AzureTranslatorOptions {
  readonly apiKey: string;
  readonly region?: string;
  readonly endpoint?: string;
  readonly fetchFn?: typeof fetch;
}

const DEFAULT_ENDPOINT = "https://api.cognitive.microsofttranslator.com/translate";
const MAX_BATCH_SIZE = 1_000;
const MAX_CHARACTER_COUNT = 50_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireNonEmpty(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string.`);
  }
  return value.trim();
}

function parseEndpoint(value: string | undefined): string {
  try {
    return new URL(value ?? DEFAULT_ENDPOINT).toString();
  } catch (cause) {
    throw new TypeError("endpoint must be a valid absolute URL.", { cause });
  }
}

function redact(value: string, apiKey: string): string {
  return value.replaceAll(apiKey, "[redacted]");
}

function redactCause(cause: unknown, apiKey: string): unknown {
  if (cause instanceof Error) return new Error(redact(cause.message, apiKey));
  if (typeof cause === "string") return redact(cause, apiKey);
  return cause;
}

function apiErrorDetail(body: string, apiKey: string): string | undefined {
  if (body.length === 0) return undefined;
  try {
    const parsed = JSON.parse(body) as unknown;
    if (isRecord(parsed) && isRecord(parsed.error)) {
      const code =
        typeof parsed.error.code === "string" || typeof parsed.error.code === "number"
          ? String(parsed.error.code)
          : undefined;
      const message = typeof parsed.error.message === "string" ? parsed.error.message : undefined;
      if (code !== undefined && message !== undefined) return redact(`${code}: ${message}`, apiKey);
      if (message !== undefined) return redact(message, apiKey);
      if (code !== undefined) return `Azure error code ${code}`;
    }
    if (isRecord(parsed) && typeof parsed.message === "string") return redact(parsed.message, apiKey);
  } catch {
    return redact(body, apiKey);
  }
  return undefined;
}

function validateTexts(texts: readonly string[]): void {
  if (!Array.isArray(texts) || texts.some((text) => typeof text !== "string")) {
    throw new TypeError("texts must be an array of strings.");
  }
  if (texts.length > MAX_BATCH_SIZE) {
    throw new TypeError(`texts must contain no more than ${MAX_BATCH_SIZE} items.`);
  }

  let totalCharacters = 0;
  for (const [index, text] of texts.entries()) {
    if (text.length > MAX_CHARACTER_COUNT) {
      throw new TypeError(`text at index ${index} must contain no more than ${MAX_CHARACTER_COUNT} characters.`);
    }
    totalCharacters += text.length;
  }
  if (totalCharacters > MAX_CHARACTER_COUNT) {
    throw new TypeError(`texts must contain no more than ${MAX_CHARACTER_COUNT} characters in total.`);
  }
}

export function createAzureTranslator(options: AzureTranslatorOptions): AsyncTranslationAdapter {
  const apiKey = requireNonEmpty(options?.apiKey, "apiKey");
  const region = options?.region === undefined ? undefined : requireNonEmpty(options.region, "region");
  const endpoint = parseEndpoint(options?.endpoint);
  const fetchImpl = options?.fetchFn ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("Fetch is unavailable. Pass fetchFn when creating the Azure translator.");
  }

  const translateBatch = async (
    texts: readonly string[],
    targetLocale: string,
    sourceLocale?: string
  ): Promise<readonly string[]> => {
    validateTexts(texts);
    const target = requireNonEmpty(targetLocale, "targetLocale");
    const source = sourceLocale === undefined ? undefined : requireNonEmpty(sourceLocale, "sourceLocale");
    if (texts.length === 0) return [];

    const requestUrl = new URL(endpoint);
    requestUrl.searchParams.set("api-version", "3.0");
    requestUrl.searchParams.set("to", target);
    if (source === undefined) requestUrl.searchParams.delete("from");
    else requestUrl.searchParams.set("from", source);

    const headers: Record<string, string> = {
      "Content-Type": "application/json; charset=UTF-8",
      "Ocp-Apim-Subscription-Key": apiKey
    };
    if (region !== undefined) headers["Ocp-Apim-Subscription-Region"] = region;

    let response: Response;
    try {
      response = await fetchImpl(requestUrl.toString(), {
        method: "POST",
        headers,
        body: JSON.stringify(texts.map((text) => ({ Text: text })))
      });
    } catch (cause) {
      throw new Error("Azure Translator request failed before receiving an HTTP response.", {
        cause: redactCause(cause, apiKey)
      });
    }

    let body: string;
    try {
      body = await response.text();
    } catch (cause) {
      throw new Error(`Azure Translator response body could not be read (HTTP ${response.status}).`, {
        cause: redactCause(cause, apiKey)
      });
    }

    if (!response.ok) {
      const detail = apiErrorDetail(body, apiKey);
      throw new Error(
        `Azure Translator request failed with HTTP ${response.status}${detail === undefined ? "." : `: ${detail}`}`
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(body) as unknown;
    } catch (cause) {
      throw new Error(`Azure Translator returned invalid JSON (HTTP ${response.status}).`, { cause });
    }
    if (!Array.isArray(parsed)) {
      throw new Error("Azure Translator response must be an array.");
    }
    if (parsed.length !== texts.length) {
      throw new Error(`Azure Translator returned ${parsed.length} results for ${texts.length} texts.`);
    }

    return parsed.map((item, index) => {
      if (!isRecord(item) || !Array.isArray(item.translations)) {
        throw new Error(`Azure Translator result at index ${index} is missing the translations array.`);
      }
      const translation = item.translations[0];
      if (!isRecord(translation) || typeof translation.text !== "string") {
        throw new Error(`Azure Translator translation at index ${index} is invalid.`);
      }
      return translation.text;
    });
  };

  return {
    async translateText(text, targetLocale, sourceLocale) {
      if (typeof text !== "string") throw new TypeError("text must be a string.");
      const translations = await translateBatch([text], targetLocale, sourceLocale);
      const translated = translations[0];
      if (translated === undefined) throw new Error("Azure Translator returned no translation.");
      return translated;
    },
    translateBatch
  };
}
