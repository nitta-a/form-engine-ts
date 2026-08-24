import type { AsyncTranslationAdapter } from "@form-engine-ts/core";

export interface GoogleV3GlossaryConfig {
  readonly glossary: string;
  readonly ignoreCase?: boolean;
}

export interface GoogleV3TranslatorOptions {
  readonly projectId: string;
  readonly location?: string;
  readonly getAccessToken: () => Promise<string> | string;
  readonly glossaryConfig?: GoogleV3GlossaryConfig;
  readonly labels?: Readonly<Record<string, string>>;
  readonly fetchFn?: typeof fetch;
  readonly apiEndpoint?: string;
  readonly maxBatchSize?: number;
  readonly maxRetries?: number;
  readonly retryBaseDelayMs?: number;
  readonly sleep?: (milliseconds: number) => Promise<void>;
}

const DEFAULT_ENDPOINT = "https://translation.googleapis.com/v3";
const DEFAULT_BATCH_SIZE = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireNonEmpty(value: string, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0)
    throw new TypeError(`${name} must be a non-empty string.`);
  return value.trim();
}

function nonNegativeInteger(value: number | undefined, fallback: number, name: string): number {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved < 0) throw new TypeError(`${name} must be a non-negative integer.`);
  return resolved;
}

function positiveInteger(value: number | undefined, fallback: number, name: string): number {
  const resolved = nonNegativeInteger(value, fallback, name);
  if (resolved < 1) throw new TypeError(`${name} must be greater than zero.`);
  return resolved;
}

function endpoint(value: string | undefined): string {
  try {
    return new URL(value ?? DEFAULT_ENDPOINT).toString().replace(/\/$/, "");
  } catch (cause) {
    throw new TypeError("apiEndpoint must be a valid absolute URL.", { cause });
  }
}

function parseTranslations(body: string, expected: number, useGlossary: boolean): readonly string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body) as unknown;
  } catch (cause) {
    throw new Error("Google Translation Advanced returned invalid JSON.", { cause });
  }
  const preferredKey = useGlossary ? "glossaryTranslations" : "translations";
  const fallbackKey = useGlossary ? "translations" : "glossaryTranslations";
  const values = isRecord(parsed)
    ? Array.isArray(parsed[preferredKey])
      ? parsed[preferredKey]
      : parsed[fallbackKey]
    : undefined;
  if (!Array.isArray(values)) throw new Error("Google Translation Advanced response is missing translations.");
  if (values.length !== expected) {
    throw new Error(`Google Translation Advanced returned ${values.length} translations for ${expected} texts.`);
  }
  return values.map((value, index) => {
    if (!isRecord(value) || typeof value.translatedText !== "string") {
      throw new Error(`Google Translation Advanced result at index ${index} is invalid.`);
    }
    return value.translatedText;
  });
}

function validateLabels(
  labels: Readonly<Record<string, string>> | undefined
): Readonly<Record<string, string>> | undefined {
  if (labels === undefined) return undefined;
  for (const [key, value] of Object.entries(labels)) {
    requireNonEmpty(key, "label key");
    requireNonEmpty(value, `label ${key}`);
  }
  return { ...labels };
}

export function createGoogleV3Translator(options: GoogleV3TranslatorOptions): AsyncTranslationAdapter {
  const projectId = requireNonEmpty(options?.projectId, "projectId");
  const location = requireNonEmpty(options.location ?? "global", "location");
  if (typeof options.getAccessToken !== "function") throw new TypeError("getAccessToken must be a function.");
  const apiEndpoint = endpoint(options.apiEndpoint);
  const fetchImpl = options.fetchFn ?? globalThis.fetch;
  if (typeof fetchImpl !== "function")
    throw new Error("Fetch is unavailable. Pass fetchFn when creating the translator.");
  const batchSize = positiveInteger(options.maxBatchSize, DEFAULT_BATCH_SIZE, "maxBatchSize");
  const maxRetries = nonNegativeInteger(options.maxRetries, 3, "maxRetries");
  const retryBaseDelayMs = nonNegativeInteger(options.retryBaseDelayMs, 250, "retryBaseDelayMs");
  const sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const labels = validateLabels(options.labels);
  const glossaryConfig =
    options.glossaryConfig === undefined
      ? undefined
      : {
          glossary: requireNonEmpty(options.glossaryConfig.glossary, "glossaryConfig.glossary"),
          ...(options.glossaryConfig.ignoreCase === undefined ? {} : { ignoreCase: options.glossaryConfig.ignoreCase })
        };
  const requestUrl = `${apiEndpoint}/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(location)}:translateText`;

  const translateChunk = async (
    texts: readonly string[],
    targetLocale: string,
    sourceLocale: string | undefined
  ): Promise<readonly string[]> => {
    const token = requireNonEmpty(await options.getAccessToken(), "accessToken");
    const body = JSON.stringify({
      contents: texts,
      mimeType: "text/plain",
      targetLanguageCode: targetLocale,
      ...(sourceLocale === undefined ? {} : { sourceLanguageCode: sourceLocale }),
      ...(glossaryConfig === undefined ? {} : { glossaryConfig }),
      ...(labels === undefined ? {} : { labels })
    });
    for (let attempt = 0; ; attempt += 1) {
      let response: Response;
      try {
        response = await fetchImpl(requestUrl, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body
        });
      } catch (cause) {
        throw new Error("Google Translation Advanced request failed before receiving an HTTP response.", { cause });
      }
      if (response.ok) return parseTranslations(await response.text(), texts.length, glossaryConfig !== undefined);
      const retryable = response.status === 429 || (response.status >= 500 && response.status <= 599);
      if (retryable && attempt < maxRetries) {
        await sleep(retryBaseDelayMs * 2 ** attempt);
        continue;
      }
      const detail = (await response.text()).replaceAll(token, "[redacted]");
      throw new Error(
        `Google Translation Advanced request failed with HTTP ${response.status}${detail.length === 0 ? "." : `: ${detail}`}`
      );
    }
  };

  const translateBatch = async (
    texts: readonly string[],
    targetLocale: string,
    sourceLocale?: string
  ): Promise<readonly string[]> => {
    if (!Array.isArray(texts) || texts.some((text) => typeof text !== "string")) {
      throw new TypeError("texts must be an array of strings.");
    }
    const target = requireNonEmpty(targetLocale, "targetLocale");
    const source = sourceLocale === undefined ? undefined : requireNonEmpty(sourceLocale, "sourceLocale");
    const translated: string[] = [];
    for (let index = 0; index < texts.length; index += batchSize) {
      translated.push(...(await translateChunk(texts.slice(index, index + batchSize), target, source)));
    }
    return translated;
  };

  return {
    async translateText(text, targetLocale, sourceLocale) {
      if (typeof text !== "string") throw new TypeError("text must be a string.");
      const translated = await translateBatch([text], targetLocale, sourceLocale);
      const value = translated[0];
      if (value === undefined) throw new Error("Google Translation Advanced returned no translation.");
      return value;
    },
    translateBatch
  };
}
