import type { AsyncTranslationAdapter } from "@form-engine-ts/core";

export interface DeeplTranslatorOptions {
  readonly apiKey: string;
  readonly apiType?: "free" | "pro";
  readonly fetchFn?: typeof fetch;
}

const DEEPL_ENDPOINTS = {
  free: "https://api-free.deepl.com/v2/translate",
  pro: "https://api.deepl.com/v2/translate"
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireNonEmpty(value: string, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string.`);
  }
  return value.trim();
}

function redact(value: string, apiKey: string): string {
  return value.replaceAll(apiKey, "[redacted]");
}

function errorMessage(body: string, apiKey: string): string | undefined {
  if (body.length === 0) return undefined;
  try {
    const parsed = JSON.parse(body) as unknown;
    if (isRecord(parsed) && typeof parsed.message === "string") return redact(parsed.message, apiKey);
  } catch {
    return redact(body, apiKey);
  }
  return undefined;
}

export function createDeeplTranslator(options: DeeplTranslatorOptions): AsyncTranslationAdapter {
  const apiKey = requireNonEmpty(options.apiKey, "apiKey");
  const apiType = options.apiType ?? "free";
  if (apiType !== "free" && apiType !== "pro") throw new TypeError('apiType must be either "free" or "pro".');
  const fetchImpl = options.fetchFn ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("Fetch is unavailable. Pass fetchFn when creating the DeepL translator.");
  }
  const endpoint = DEEPL_ENDPOINTS[apiType];

  const translateBatch = async (
    texts: readonly string[],
    targetLocale: string,
    sourceLocale?: string
  ): Promise<readonly string[]> => {
    if (!Array.isArray(texts) || texts.some((text) => typeof text !== "string")) {
      throw new TypeError("texts must be an array of strings.");
    }
    const targetLang = requireNonEmpty(targetLocale, "targetLocale");
    const sourceLang = sourceLocale === undefined ? undefined : requireNonEmpty(sourceLocale, "sourceLocale");
    if (texts.length === 0) return [];

    let response: Response;
    try {
      response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          Authorization: `DeepL-Auth-Key ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: texts,
          target_lang: targetLang,
          ...(sourceLang === undefined ? {} : { source_lang: sourceLang })
        })
      });
    } catch (cause) {
      throw new Error("DeepL request failed before receiving an HTTP response.", { cause });
    }

    let body: string;
    try {
      body = await response.text();
    } catch (cause) {
      throw new Error(`DeepL response body could not be read (HTTP ${response.status}).`, { cause });
    }

    if (!response.ok) {
      const detail = errorMessage(body, apiKey);
      throw new Error(`DeepL request failed with HTTP ${response.status}${detail === undefined ? "." : `: ${detail}`}`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(body) as unknown;
    } catch (cause) {
      throw new Error(`DeepL returned invalid JSON (HTTP ${response.status}).`, { cause });
    }
    if (!isRecord(parsed) || !Array.isArray(parsed.translations)) {
      throw new Error("DeepL response is missing the translations array.");
    }
    if (parsed.translations.length !== texts.length) {
      throw new Error(`DeepL returned ${parsed.translations.length} translations for ${texts.length} texts.`);
    }
    return parsed.translations.map((translation, index) => {
      if (!isRecord(translation) || typeof translation.text !== "string") {
        throw new Error(`DeepL translation at index ${index} is invalid.`);
      }
      return translation.text;
    });
  };

  return {
    async translateText(text, targetLocale, sourceLocale) {
      if (typeof text !== "string") throw new TypeError("text must be a string.");
      const translations = await translateBatch([text], targetLocale, sourceLocale);
      const translated = translations[0];
      if (translated === undefined) throw new Error("DeepL returned no translation.");
      return translated;
    },
    translateBatch
  };
}
