import type {
  FormResponse,
  FormSubmission,
  JsonValue,
  PagedSubmissionStorageAdapter,
  SubmissionFilter,
  SubmissionPageQueryOptions
} from "./types";

export interface PaginationIteratorOptions {
  readonly pageSize?: number;
  readonly maxItems?: number;
  readonly signal?: AbortSignal;
}

export interface SubmissionCursorPayload {
  readonly kind: "submission";
  readonly formId: string;
  readonly submittedAt: string;
  readonly id: string;
}

export interface TextAnswerCursorPayload {
  readonly kind: "text_answer";
  readonly formId: string;
  readonly fieldId: string;
  readonly submittedAt: string;
  readonly submissionId: string;
}

export type StorageCursor = string;

export interface StorageFilterCriteria {
  readonly fieldId?: string;
  readonly fromDate?: string;
  readonly toDate?: string;
  readonly metadataFilters?: Readonly<Record<string, JsonValue>>;
}

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly hasMore: boolean;
  readonly nextCursor?: StorageCursor;
  readonly totalScannedCount: number;
}

export interface CursorPagingOptions {
  readonly pageSize: number;
  readonly cursor?: StorageCursor;
  readonly maxScanPages?: number;
}

export async function paginateWithFilter<T>(params: {
  readonly pageSize: number;
  readonly cursor?: StorageCursor;
  readonly maxScanPages?: number;
  readonly fetchPage: (
    rawCursor: StorageCursor | undefined,
    limit: number
  ) => Promise<{ readonly rawItems: readonly T[]; readonly rawNextCursor?: StorageCursor }>;
  readonly filterPredicate: (item: T) => boolean;
  readonly encodeCursor: (lastItem: T) => StorageCursor;
}): Promise<PaginatedResult<T>> {
  const { pageSize, cursor, maxScanPages = 5, fetchPage, filterPredicate, encodeCursor } = params;
  normalizeSubmissionPageSize(pageSize);
  if (!Number.isSafeInteger(maxScanPages) || maxScanPages < 1) {
    throw new TypeError("maxScanPages must be a positive safe integer.");
  }

  const collected: T[] = [];
  let currentRawCursor = cursor;
  let totalScannedCount = 0;
  let scanCount = 0;

  while (collected.length < pageSize && scanCount < maxScanPages) {
    scanCount += 1;
    const fetchLimit = pageSize - collected.length + 1;
    const { rawItems, rawNextCursor } = await fetchPage(currentRawCursor, fetchLimit);
    totalScannedCount += rawItems.length;
    for (const item of rawItems) {
      if (!filterPredicate(item)) continue;
      collected.push(item);
      if (collected.length === pageSize) {
        const lastItem = collected.at(-1);
        if (lastItem === undefined) break;
        return {
          items: collected,
          hasMore: rawNextCursor !== undefined,
          ...(rawNextCursor === undefined ? {} : { nextCursor: encodeCursor(lastItem) }),
          totalScannedCount
        };
      }
    }
    if (rawItems.length === 0 || rawNextCursor === undefined) break;
    currentRawCursor = rawNextCursor;
  }

  return { items: collected, hasMore: false, totalScannedCount };
}

function asFormResponse(submission: FormSubmission): FormResponse {
  const metadata =
    submission.metadata === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(submission.metadata).filter((entry): entry is [string, JsonValue] => entry[1] !== undefined)
        );
  return {
    responseId: submission.id,
    formId: submission.formId,
    formVersion: submission.formVersion,
    ...(submission.locale === undefined ? {} : { sourceLocale: submission.locale }),
    answers: submission.values,
    submittedAt: submission.submittedAt,
    ...(metadata === undefined ? {} : { metadata })
  };
}

export async function* iterateSubmissionPages(
  adapter: PagedSubmissionStorageAdapter,
  formId: string,
  queryOptions: SubmissionPageQueryOptions = {},
  options: PaginationIteratorOptions = {}
): AsyncIterable<readonly FormResponse[]> {
  const pageSize = normalizeSubmissionPageSize(options.pageSize ?? queryOptions.pageSize);
  const maxItems = options.maxItems ?? Number.POSITIVE_INFINITY;
  if (maxItems !== Number.POSITIVE_INFINITY && (!Number.isSafeInteger(maxItems) || maxItems < 0)) {
    throw new TypeError("maxItems must be a non-negative safe integer.");
  }
  if (maxItems === 0) return;
  const seenCursors = new Set<string>();
  let cursor = queryOptions.cursor;
  const { cursor: _initialCursor, pageSize: _initialPageSize, ...baseQueryOptions } = queryOptions;
  if (cursor !== undefined) seenCursors.add(cursor);
  let emitted = 0;

  while (emitted < maxItems) {
    options.signal?.throwIfAborted();
    const remaining = maxItems - emitted;
    const requestedPageSize = Number.isFinite(remaining) ? Math.min(pageSize, remaining) : pageSize;
    const page = await adapter.listSubmissionPage(formId, {
      ...baseQueryOptions,
      pageSize: requestedPageSize,
      ...(cursor === undefined ? {} : { cursor })
    });
    options.signal?.throwIfAborted();
    const available = Number.isFinite(remaining) ? page.items.slice(0, remaining) : page.items;
    if (available.length > 0) {
      emitted += available.length;
      yield available.map(asFormResponse);
    }
    if (!page.hasMore || emitted >= maxItems) return;
    const nextCursor = page.nextCursor;
    if (nextCursor === undefined || nextCursor.length === 0) {
      throw new Error("Submission pagination returned hasMore without a next cursor.");
    }
    if (seenCursors.has(nextCursor)) throw new Error(`Submission pagination cursor cycle detected: ${nextCursor}`);
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }
}

export interface SubmissionCursorValue {
  readonly submittedAt: string;
  readonly responseId: string;
}

export function encodeStorageSubmissionCursor(value: SubmissionCursorPayload): StorageCursor {
  if (
    value.kind !== "submission" ||
    value.formId.length === 0 ||
    value.submittedAt.length === 0 ||
    value.id.length === 0
  ) {
    throw new TypeError("Submission cursor values are invalid.");
  }
  return encodeBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

export function decodeStorageSubmissionCursor(cursor: StorageCursor): SubmissionCursorPayload {
  const parsed = decodeCursorPayload(cursor, "submission cursor payload is invalid.");
  if (
    parsed.kind !== "submission" ||
    typeof parsed.formId !== "string" ||
    parsed.formId.length === 0 ||
    typeof parsed.submittedAt !== "string" ||
    parsed.submittedAt.length === 0 ||
    typeof parsed.id !== "string" ||
    parsed.id.length === 0
  ) {
    throw new TypeError("submission cursor payload is invalid.");
  }
  return {
    kind: "submission",
    formId: parsed.formId,
    submittedAt: parsed.submittedAt,
    id: parsed.id
  };
}

export function encodeStorageTextAnswerCursor(value: TextAnswerCursorPayload): StorageCursor {
  if (
    value.kind !== "text_answer" ||
    value.formId.length === 0 ||
    value.fieldId.length === 0 ||
    value.submittedAt.length === 0 ||
    value.submissionId.length === 0
  ) {
    throw new TypeError("Text answer cursor values are invalid.");
  }
  return encodeBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

export function decodeStorageTextAnswerCursor(cursor: StorageCursor): TextAnswerCursorPayload {
  const parsed = decodeCursorPayload(cursor, "text answer cursor payload is invalid.");
  if (
    parsed.kind !== "text_answer" ||
    typeof parsed.formId !== "string" ||
    parsed.formId.length === 0 ||
    typeof parsed.fieldId !== "string" ||
    parsed.fieldId.length === 0 ||
    typeof parsed.submittedAt !== "string" ||
    parsed.submittedAt.length === 0 ||
    typeof parsed.submissionId !== "string" ||
    parsed.submissionId.length === 0
  ) {
    throw new TypeError("text answer cursor payload is invalid.");
  }
  return {
    kind: "text_answer",
    formId: parsed.formId,
    fieldId: parsed.fieldId,
    submittedAt: parsed.submittedAt,
    submissionId: parsed.submissionId
  };
}

export interface TextAnswerCursorValue {
  readonly responseId: string;
  readonly fieldId: string;
}

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function encodeBase64(bytes: Uint8Array): string {
  let result = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const combined = (first << 16) | (second << 8) | third;
    result += BASE64_ALPHABET[(combined >> 18) & 63] ?? "";
    result += BASE64_ALPHABET[(combined >> 12) & 63] ?? "";
    result += index + 1 < bytes.length ? (BASE64_ALPHABET[(combined >> 6) & 63] ?? "") : "=";
    result += index + 2 < bytes.length ? (BASE64_ALPHABET[combined & 63] ?? "") : "=";
  }
  return result;
}

function decodeBase64(value: string): Uint8Array {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new TypeError("cursor must be a valid Base64 token.");
  }
  const bytes: number[] = [];
  for (let index = 0; index < value.length; index += 4) {
    const characters = value.slice(index, index + 4);
    const sextets = [...characters].map((character) => (character === "=" ? 0 : BASE64_ALPHABET.indexOf(character)));
    const combined =
      ((sextets[0] ?? 0) << 18) | ((sextets[1] ?? 0) << 12) | ((sextets[2] ?? 0) << 6) | (sextets[3] ?? 0);
    bytes.push((combined >> 16) & 255);
    if (characters[2] !== "=") bytes.push((combined >> 8) & 255);
    if (characters[3] !== "=") bytes.push(combined & 255);
  }
  return new Uint8Array(bytes);
}

function encodeBase64Url(bytes: Uint8Array): string {
  return encodeBase64(bytes).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decodeCursorPayload(cursor: StorageCursor, invalidMessage: string): Record<string, unknown> {
  try {
    const normalized = cursor
      .replaceAll("-", "+")
      .replaceAll("_", "/")
      .padEnd(Math.ceil(cursor.length / 4) * 4, "=");
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(decodeBase64(normalized)));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new TypeError(invalidMessage);
    return parsed as Record<string, unknown>;
  } catch (cause) {
    if (cause instanceof TypeError && cause.message === invalidMessage) throw cause;
    throw new TypeError("cursor must be a valid Base64URL JSON token.", { cause });
  }
}

export function encodeSubmissionCursor(value: SubmissionCursorValue): string {
  if (value.submittedAt.length === 0 || value.responseId.length === 0) {
    throw new TypeError("Cursor values must not be empty.");
  }
  return encodeBase64(new TextEncoder().encode(JSON.stringify(value)));
}

export function decodeSubmissionCursor(cursor: string): SubmissionCursorValue {
  try {
    const parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(decodeBase64(cursor))) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("submittedAt" in parsed) ||
      typeof parsed.submittedAt !== "string" ||
      parsed.submittedAt.length === 0 ||
      !("responseId" in parsed) ||
      typeof parsed.responseId !== "string" ||
      parsed.responseId.length === 0
    ) {
      throw new TypeError("cursor payload is invalid.");
    }
    return { submittedAt: parsed.submittedAt, responseId: parsed.responseId };
  } catch (cause) {
    if (cause instanceof TypeError && cause.message === "cursor payload is invalid.") throw cause;
    throw new TypeError("cursor must be a valid form-engine cursor.", { cause });
  }
}

export function encodeTextAnswerCursor(value: TextAnswerCursorValue): string {
  if (value.responseId.length === 0 || value.fieldId.length === 0) {
    throw new TypeError("Text answer cursor values must not be empty.");
  }
  return encodeBase64(new TextEncoder().encode(JSON.stringify(value)));
}

export function decodeTextAnswerCursor(cursor: string): TextAnswerCursorValue {
  try {
    const parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(decodeBase64(cursor))) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("responseId" in parsed) ||
      typeof parsed.responseId !== "string" ||
      parsed.responseId.length === 0 ||
      !("fieldId" in parsed) ||
      typeof parsed.fieldId !== "string" ||
      parsed.fieldId.length === 0
    ) {
      throw new TypeError("text answer cursor payload is invalid.");
    }
    return { responseId: parsed.responseId, fieldId: parsed.fieldId };
  } catch (cause) {
    if (cause instanceof TypeError && cause.message === "text answer cursor payload is invalid.") throw cause;
    throw new TypeError("cursor must be a valid text answer cursor.", { cause });
  }
}

export function normalizeSubmissionPageSize(pageSize: number | undefined, fallback = 100): number {
  const value = pageSize ?? fallback;
  if (!Number.isSafeInteger(value) || value < 1) throw new TypeError("pageSize must be a positive safe integer.");
  return value;
}

function isJsonArray(value: JsonValue): value is readonly JsonValue[] {
  return Array.isArray(value);
}

function isJsonObject(value: JsonValue): value is Readonly<Record<string, JsonValue>> {
  return typeof value === "object" && value !== null && !isJsonArray(value);
}

export function jsonValuesEqual(left: JsonValue | undefined, right: JsonValue | undefined): boolean {
  if (left === right) return true;
  if (left === undefined || left === null || right === undefined || right === null || typeof left !== typeof right) {
    return false;
  }
  if (isJsonArray(left) || isJsonArray(right)) {
    return (
      isJsonArray(left) &&
      isJsonArray(right) &&
      left.length === right.length &&
      left.every((value, index) => jsonValuesEqual(value, right[index]))
    );
  }
  if (!isJsonObject(left) || !isJsonObject(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) => Object.hasOwn(right, key) && jsonValuesEqual(left[key], right[key]))
  );
}

function readSubmissionPath(submission: FormSubmission, path: string): JsonValue | undefined {
  if (
    path.length === 0 ||
    path.split(".").some((part) => part.length === 0 || part === "__proto__" || part === "constructor")
  ) {
    return undefined;
  }
  let current: unknown = submission;
  for (const part of path.split(".")) {
    if (typeof current !== "object" || current === null || !Object.hasOwn(current, part)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current as JsonValue | undefined;
}

function compareRangeValue(value: JsonValue | undefined, boundary: JsonValue, direction: "from" | "to"): boolean {
  if (typeof value === "number" && typeof boundary === "number") {
    return direction === "from" ? value >= boundary : value <= boundary;
  }
  if (typeof value === "string" && typeof boundary === "string") {
    return direction === "from" ? value >= boundary : value <= boundary;
  }
  return false;
}

export function matchesSubmissionFilter(submission: FormSubmission, filter: SubmissionFilter): boolean {
  if (filter.op === "and") return filter.filters.every((item) => matchesSubmissionFilter(submission, item));
  if (filter.op === "or") return filter.filters.some((item) => matchesSubmissionFilter(submission, item));
  const value = readSubmissionPath(submission, filter.path);
  if (filter.op === "eq") return jsonValuesEqual(value, filter.value);
  if (filter.op === "in") return filter.values.some((candidate) => jsonValuesEqual(value, candidate));
  if (filter.op === "exists") return filter.value ? value !== undefined : value === undefined;
  return (
    (filter.from === undefined || compareRangeValue(value, filter.from, "from")) &&
    (filter.to === undefined || compareRangeValue(value, filter.to, "to"))
  );
}

export function matchesSubmissionPageFilters(
  submission: FormSubmission,
  options: Pick<SubmissionPageQueryOptions, "filter" | "metadataFilters">
): boolean {
  if (
    options.filter !== undefined &&
    !(typeof options.filter === "function"
      ? options.filter(submission)
      : matchesSubmissionFilter(submission, options.filter))
  ) {
    return false;
  }
  if (options.metadataFilters === undefined) return true;
  return Object.entries(options.metadataFilters).every(([key, value]) =>
    jsonValuesEqual(submission.metadata?.[key], value)
  );
}
