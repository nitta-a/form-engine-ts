import type { AsyncTranslationAdapter } from "@form-engine-ts/core";

export interface GoogleTranslatorOptions {
  readonly apiKey?: string;
  readonly getAccessToken?: () => Promise<string> | string;
  readonly fetchFn?: typeof fetch;
  readonly apiEndpoint?: string;
}

const DEFAULT_ENDPOINT = "https://translation.googleapis.com/language/translate/v2";
const MAX_BATCH_SIZE = 128;
const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  quot: '"',
  apos: "'",
  amp: "&",
  lt: "<",
  gt: ">"
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireNonEmpty(value: string, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string.`);
  }
  return value.trim();
}

function decodeHtmlEntities(text: string): string {
  return text.replace(/&(?:quot|apos|amp|lt|gt|#(?:[xX][0-9a-fA-F]+|[0-9]+));/g, (entity) => {
    if (!entity.startsWith("&#")) return NAMED_ENTITIES[entity.slice(1, -1)] ?? entity;
    const encoded = entity.slice(2, -1);
    const hexadecimal = encoded.startsWith("x") || encoded.startsWith("X");
    const codePoint = Number.parseInt(hexadecimal ? encoded.slice(1) : encoded, hexadecimal ? 16 : 10);
    if (codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) return entity;
    return String.fromCodePoint(codePoint);
  });
}

function redact(value: string, secrets: readonly string[]): string {
  return secrets.reduce((result, secret) => result.replaceAll(secret, "[redacted]"), value);
}

function apiErrorMessage(body: string, secrets: readonly string[]): string | undefined {
  if (body.length === 0) return undefined;
  try {
    const parsed = JSON.parse(body) as unknown;
    if (isRecord(parsed) && isRecord(parsed.error) && typeof parsed.error.message === "string") {
      return redact(parsed.error.message, secrets);
    }
    if (isRecord(parsed) && typeof parsed.message === "string") return redact(parsed.message, secrets);
  } catch {
    return redact(body, secrets);
  }
  return undefined;
}

function parseEndpoint(value: string | undefined): string {
  try {
    return new URL(value ?? DEFAULT_ENDPOINT).toString();
  } catch (cause) {
    throw new TypeError("apiEndpoint must be a valid absolute URL.", { cause });
  }
}

export function createGoogleTranslator(options: GoogleTranslatorOptions): AsyncTranslationAdapter {
  const hasApiKey = options?.apiKey !== undefined;
  const hasTokenProvider = options?.getAccessToken !== undefined;
  if (hasApiKey === hasTokenProvider) {
    throw new TypeError("Provide exactly one of apiKey or getAccessToken.");
  }
  const apiKey = hasApiKey ? requireNonEmpty(options.apiKey as string, "apiKey") : undefined;
  if (hasTokenProvider && typeof options.getAccessToken !== "function") {
    throw new TypeError("getAccessToken must be a function.");
  }
  const getAccessToken = options.getAccessToken;
  const endpoint = parseEndpoint(options.apiEndpoint);
  const fetchImpl = options.fetchFn ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("Fetch is unavailable. Pass fetchFn when creating the Google translator.");
  }

  const translateBatch = async (
    texts: readonly string[],
    targetLocale: string,
    sourceLocale?: string
  ): Promise<readonly string[]> => {
    if (!Array.isArray(texts) || texts.some((text) => typeof text !== "string")) {
      throw new TypeError("texts must be an array of strings.");
    }
    if (texts.length > MAX_BATCH_SIZE) {
      throw new TypeError(`texts must contain no more than ${MAX_BATCH_SIZE} items.`);
    }
    const target = requireNonEmpty(targetLocale, "targetLocale");
    const source = sourceLocale === undefined ? undefined : requireNonEmpty(sourceLocale, "sourceLocale");
    if (texts.length === 0) return [];

    const requestUrl = new URL(endpoint);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const secrets: string[] = [];
    if (apiKey !== undefined) {
      requestUrl.searchParams.set("key", apiKey);
      secrets.push(apiKey);
    } else {
      if (getAccessToken === undefined) throw new Error("Google access token provider is unavailable.");
      let providedToken: string;
      try {
        providedToken = await getAccessToken();
      } catch (cause) {
        throw new Error("Google access token provider failed.", { cause });
      }
      const token = requireNonEmpty(providedToken, "accessToken");
      headers.Authorization = `Bearer ${token}`;
      secrets.push(token);
    }

    let response: Response;
    try {
      response = await fetchImpl(requestUrl.toString(), {
        method: "POST",
        headers,
        body: JSON.stringify({
          q: texts,
          target,
          format: "text",
          ...(source === undefined ? {} : { source })
        })
      });
    } catch (cause) {
      throw new Error("Google Translation request failed before receiving an HTTP response.", { cause });
    }

    let body: string;
    try {
      body = await response.text();
    } catch (cause) {
      throw new Error(`Google Translation response body could not be read (HTTP ${response.status}).`, { cause });
    }
    if (!response.ok) {
      const detail = apiErrorMessage(body, secrets);
      throw new Error(
        `Google Translation request failed with HTTP ${response.status}${detail === undefined ? "." : `: ${detail}`}`
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(body) as unknown;
    } catch (cause) {
      throw new Error(`Google Translation returned invalid JSON (HTTP ${response.status}).`, { cause });
    }
    const translations =
      isRecord(parsed) && isRecord(parsed.data) && Array.isArray(parsed.data.translations)
        ? parsed.data.translations
        : undefined;
    if (translations === undefined) {
      throw new Error("Google Translation response is missing the data.translations array.");
    }
    if (translations.length !== texts.length) {
      throw new Error(`Google Translation returned ${translations.length} translations for ${texts.length} texts.`);
    }
    return translations.map((translation, index) => {
      if (!isRecord(translation) || typeof translation.translatedText !== "string") {
        throw new Error(`Google Translation result at index ${index} is invalid.`);
      }
      return decodeHtmlEntities(translation.translatedText);
    });
  };

  return {
    async translateText(text, targetLocale, sourceLocale) {
      if (typeof text !== "string") throw new TypeError("text must be a string.");
      const translations = await translateBatch([text], targetLocale, sourceLocale);
      const translated = translations[0];
      if (translated === undefined) throw new Error("Google Translation returned no translation.");
      return translated;
    },
    translateBatch
  };
}
