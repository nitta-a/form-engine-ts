import type { AsyncTranslationAdapter } from "@form-engine-ts/core";

export interface GoogleV3GlossaryConfig {
  /** Glossary ID or fully qualified glossary resource name. */
  readonly glossary: string;
  /** Whether glossary matching should ignore case. */
  readonly ignoreCase?: boolean;
}

export type GlossaryResolver = (context: {
  readonly sourceLocale: string;
  readonly targetLocale: string;
}) => string | GoogleV3GlossaryConfig | undefined;

export interface GoogleV3TranslationAdapter extends AsyncTranslationAdapter {
  /** Returns the glossary resource used for a locale pair, for cache-key isolation. */
  getCacheVariant(targetLocale: string, sourceLocale?: string): string | undefined;
}

export interface GoogleV3TranslatorOptions {
  readonly projectId: string;
  readonly location?: string;
  readonly getAccessToken?: () => Promise<string> | string;
  readonly apiKey?: string;
  readonly glossaryConfig?: GoogleV3GlossaryConfig | string;
  readonly glossaryResolver?: GlossaryResolver;
  readonly labels?: Readonly<Record<string, string>>;
  readonly fetchFn?: typeof fetch;
  readonly fetchImpl?: typeof fetch;
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
  readonly cacheHitCount: number;
  readonly cacheMissCount: number;
  readonly evictionCount: number;
  readonly glossary?: string;
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

function parseTranslations(body: string, expected: number): readonly string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body) as unknown;
  } catch (cause) {
    throw new Error("Google Translation Advanced returned invalid JSON.", { cause });
  }
  const glossaryTranslations =
    isRecord(parsed) && Array.isArray(parsed.glossaryTranslations) ? parsed.glossaryTranslations : [];
  const translations = isRecord(parsed) && Array.isArray(parsed.translations) ? parsed.translations : [];
  if (glossaryTranslations.length === 0 && translations.length === 0) {
    throw new Error("Google Translation Advanced response is missing translations.");
  }
  return Array.from({ length: expected }, (_, index) => {
    const glossaryValue = glossaryTranslations[index];
    if (isRecord(glossaryValue) && typeof glossaryValue.translatedText === "string") {
      return glossaryValue.translatedText;
    }
    const value = translations[index];
    if (isRecord(value) && typeof value.translatedText === "string") return value.translatedText;
    throw new Error(`Google Translation Advanced result at index ${index} is invalid.`);
  });
}

function normalizeGlossary(
  value: string | GoogleV3GlossaryConfig,
  projectId: string,
  location: string,
  name: string
): GoogleV3GlossaryConfig & { readonly glossary: string } {
  const config = typeof value === "string" ? { glossary: value } : value;
  const glossary = requireNonEmpty(config.glossary, `${name}.glossary`);
  if (config.ignoreCase !== undefined && typeof config.ignoreCase !== "boolean") {
    throw new TypeError(`${name}.ignoreCase must be a boolean.`);
  }
  return {
    glossary: glossary.startsWith("projects/")
      ? glossary
      : `projects/${projectId}/locations/${location}/glossaries/${glossary}`,
    ...(config.ignoreCase === undefined ? {} : { ignoreCase: config.ignoreCase })
  };
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
  const apiEndpoint = endpoint(options.apiEndpoint);
  const fetchImpl = options.fetchFn ?? options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function")
    throw new Error("Fetch is unavailable. Pass fetchFn when creating the translator.");
  if (typeof options.getAccessToken !== "function" && options.apiKey === undefined) {
    throw new TypeError("getAccessToken or apiKey must be provided.");
  }
  const apiKey = options.apiKey === undefined ? undefined : requireNonEmpty(options.apiKey, "apiKey");
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
  if (options.glossaryResolver !== undefined && typeof options.glossaryResolver !== "function") {
    throw new TypeError("glossaryResolver must be a function.");
  }
  const staticGlossaryConfig =
    options.glossaryConfig === undefined
      ? undefined
      : normalizeGlossary(options.glossaryConfig, projectId, location, "glossaryConfig");
  const baseRequestUrl = `${apiEndpoint}/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(location)}:translateText`;
  const requestUrl = apiKey === undefined ? baseRequestUrl : `${baseRequestUrl}?key=${encodeURIComponent(apiKey)}`;

  const resolveGlossary = (
    sourceLocale: string | undefined,
    targetLocale: string
  ): GoogleV3GlossaryConfig | undefined => {
    if (options.glossaryResolver !== undefined) {
      const resolved = options.glossaryResolver({ sourceLocale: sourceLocale ?? "auto", targetLocale });
      return resolved === undefined
        ? undefined
        : normalizeGlossary(resolved, projectId, location, "glossaryResolver result");
    }
    return staticGlossaryConfig;
  };

  const getCacheVariant = (targetLocale: string, sourceLocale?: string): string | undefined => {
    const target = requireNonEmpty(targetLocale, "targetLocale");
    const source = sourceLocale === undefined ? undefined : requireNonEmpty(sourceLocale, "sourceLocale");
    return resolveGlossary(source, target)?.glossary;
  };

  const translateChunk = async (
    texts: readonly string[],
    targetLocale: string,
    sourceLocale: string | undefined,
    glossaryConfig: GoogleV3GlossaryConfig | undefined
  ): Promise<{ readonly translations: readonly string[]; readonly retryAttempts: number }> => {
    const token =
      options.getAccessToken === undefined ? undefined : requireNonEmpty(await options.getAccessToken(), "accessToken");
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
          headers: {
            ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }),
            "Content-Type": "application/json"
          },
          body
        });
      } catch (cause) {
        if (attempt >= maxRetries) {
          throw new Error("Google Translation Advanced request failed before receiving an HTTP response.", { cause });
        }
      }
      if (response?.ok === true) {
        return {
          translations: parseTranslations(await response.text(), texts.length),
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
      const responseText = await response.text();
      const detail = token === undefined ? responseText : responseText.replaceAll(token, "[redacted]");
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
    const glossary = resolveGlossary(source, target);
    const nonEmptyEntries = texts.flatMap((text, index) => (text.trim().length === 0 ? [] : [{ text, index }]));
    const nonEmptyTexts = nonEmptyEntries.map((entry) => entry.text);
    const chunks = splitTranslationBatch(nonEmptyTexts, batchLimits);
    const startedAt = now();
    const translated: string[] = [];
    let retryAttempts = 0;
    for (const chunk of chunks) {
      const result = await translateChunk(chunk, target, source, glossary);
      translated.push(...result.translations);
      retryAttempts += result.retryAttempts;
    }
    const restored = Array.from({ length: texts.length }, () => "");
    for (const [translatedIndex, entry] of nonEmptyEntries.entries()) {
      const value = translated[translatedIndex];
      if (value === undefined) throw new Error("Google Translation Advanced returned an incomplete translation batch.");
      restored[entry.index] = value;
    }
    options.onBatchReport?.({
      totalChunks: chunks.length,
      totalCharacters: nonEmptyTexts.reduce((total, text) => total + [...text].length, 0),
      retryAttempts,
      durationMs: Math.max(0, now() - startedAt),
      cacheHitCount: 0,
      cacheMissCount: nonEmptyTexts.length,
      evictionCount: 0,
      ...(glossary === undefined ? {} : { glossary: glossary.glossary })
    });
    return restored;
  };

  const translator: GoogleV3TranslationAdapter = {
    getCacheVariant,
    async translateText(text, targetLocale, sourceLocale) {
      if (typeof text !== "string") throw new TypeError("text must be a string.");
      const translated = await translateBatch([text], targetLocale, sourceLocale);
      const value = translated[0];
      if (value === undefined) throw new Error("Google Translation Advanced returned no translation.");
      return value;
    },
    translateBatch
  };
  return translator;
}
