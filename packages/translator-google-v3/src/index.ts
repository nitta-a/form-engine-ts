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
  readonly batchLimits?: BatchSplitLimits;
  readonly retry?: RetryConfig;
  readonly maxBatchSize?: number;
  readonly maxRetries?: number;
  readonly retryBaseDelayMs?: number;
  readonly maxRetryDelayMs?: number;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly random?: () => number;
  readonly now?: () => number;
  readonly onBatchReport?: (report: TranslationBatchReport) => void;
}

export interface BatchSplitLimits {
  readonly maxItems?: number;
  /** UTF-8 bytes across all text items in a request. */
  readonly maxCharacters?: number;
}

export interface RetryConfig {
  readonly maxRetries?: number;
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
}

export interface TranslationBatchReport {
  readonly totalChunks: number;
  readonly totalCharacters: number;
  readonly retryAttempts: number;
  readonly durationMs: number;
}

const DEFAULT_ENDPOINT = "https://translation.googleapis.com/v3";
const DEFAULT_MAX_ITEMS = 250;
const DEFAULT_MAX_CHARACTERS = 25_000;
const HARD_MAX_ITEMS = 1024;
const HARD_MAX_CHARACTERS = 30_000;

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

export function splitTranslationBatch(texts: readonly string[], limits: BatchSplitLimits = {}): string[][] {
  if (!Array.isArray(texts) || texts.some((text) => typeof text !== "string")) {
    throw new TypeError("texts must be an array of strings.");
  }
  const maxItems = positiveInteger(limits.maxItems, DEFAULT_MAX_ITEMS, "maxItems");
  const maxCharacters = positiveInteger(limits.maxCharacters, DEFAULT_MAX_CHARACTERS, "maxCharacters");
  if (maxItems > HARD_MAX_ITEMS) throw new TypeError(`maxItems cannot exceed ${HARD_MAX_ITEMS}.`);
  if (maxCharacters > HARD_MAX_CHARACTERS) {
    throw new TypeError(`maxCharacters cannot exceed ${HARD_MAX_CHARACTERS}.`);
  }
  const encoder = new TextEncoder();
  const chunks: string[][] = [];
  let chunk: string[] = [];
  let chunkBytes = 0;
  for (const text of texts) {
    const textBytes = encoder.encode(text).length;
    if (textBytes > maxCharacters) {
      throw new TypeError(`A text item uses ${textBytes} UTF-8 bytes; maxCharacters is ${maxCharacters}.`);
    }
    if (chunk.length > 0 && (chunk.length >= maxItems || chunkBytes + textBytes > maxCharacters)) {
      chunks.push(chunk);
      chunk = [];
      chunkBytes = 0;
    }
    chunk.push(text);
    chunkBytes += textBytes;
  }
  if (chunk.length > 0) chunks.push(chunk);
  return chunks;
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

function retryAfterMilliseconds(value: string | null, now: () => number): number | undefined {
  if (value === null) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - now()) : undefined;
}

export function createGoogleV3Translator(options: GoogleV3TranslatorOptions): AsyncTranslationAdapter {
  const projectId = requireNonEmpty(options?.projectId, "projectId");
  const location = requireNonEmpty(options.location ?? "global", "location");
  if (typeof options.getAccessToken !== "function") throw new TypeError("getAccessToken must be a function.");
  const apiEndpoint = endpoint(options.apiEndpoint);
  const fetchImpl = options.fetchFn ?? globalThis.fetch;
  if (typeof fetchImpl !== "function")
    throw new Error("Fetch is unavailable. Pass fetchFn when creating the translator.");
  const batchLimits: BatchSplitLimits = {
    maxItems: options.batchLimits?.maxItems ?? options.maxBatchSize ?? DEFAULT_MAX_ITEMS,
    maxCharacters: options.batchLimits?.maxCharacters ?? DEFAULT_MAX_CHARACTERS
  };
  const maxRetries = nonNegativeInteger(options.retry?.maxRetries ?? options.maxRetries, 4, "maxRetries");
  const retryBaseDelayMs = nonNegativeInteger(
    options.retry?.baseDelayMs ?? options.retryBaseDelayMs,
    500,
    "baseDelayMs"
  );
  const maxRetryDelayMs = nonNegativeInteger(
    options.retry?.maxDelayMs ?? options.maxRetryDelayMs,
    10_000,
    "maxDelayMs"
  );
  const sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const random = options.random ?? Math.random;
  const now = options.now ?? Date.now;
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
  ): Promise<{ readonly translations: readonly string[]; readonly retryAttempts: number }> => {
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
      let response: Response | undefined;
      try {
        response = await fetchImpl(requestUrl, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body
        });
      } catch (cause) {
        if (attempt >= maxRetries) {
          throw new Error("Google Translation Advanced request failed before receiving an HTTP response.", { cause });
        }
      }
      if (response?.ok === true) {
        return {
          translations: parseTranslations(await response.text(), texts.length, glossaryConfig !== undefined),
          retryAttempts: attempt
        };
      }
      const retryable =
        response === undefined || response.status === 429 || (response.status >= 500 && response.status <= 599);
      if (retryable && attempt < maxRetries) {
        const retryAfter =
          response === undefined ? undefined : retryAfterMilliseconds(response.headers.get("retry-after"), now);
        if (response !== undefined) await response.text();
        const exponentialCap = Math.min(maxRetryDelayMs, retryBaseDelayMs * 2 ** attempt);
        const jitter = Math.floor(random() * exponentialCap);
        await sleep(Math.max(retryAfter ?? 0, jitter));
        continue;
      }
      if (response === undefined) throw new Error("Google Translation Advanced request failed.");
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
    const chunks = splitTranslationBatch(texts, batchLimits);
    const startedAt = now();
    const translated: string[] = [];
    let retryAttempts = 0;
    for (const chunk of chunks) {
      const result = await translateChunk(chunk, target, source);
      translated.push(...result.translations);
      retryAttempts += result.retryAttempts;
    }
    options.onBatchReport?.({
      totalChunks: chunks.length,
      totalCharacters: texts.reduce((total, text) => total + [...text].length, 0),
      retryAttempts,
      durationMs: Math.max(0, now() - startedAt)
    });
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
