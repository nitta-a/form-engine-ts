import type {
  BaseSubmissionMetadata,
  FormSubmission,
  PaginatedResult,
  StorageCursor,
  TypedSubmissionPage,
  TypedSubmissionPageQueryOptions
} from "@form-engine-ts/core";

export type { TypedSubmissionPage, TypedSubmissionPageQueryOptions } from "@form-engine-ts/core";
export {
  decodeStorageSubmissionCursor,
  decodeStorageTextAnswerCursor,
  encodeStorageSubmissionCursor,
  encodeStorageTextAnswerCursor
} from "@form-engine-ts/core";
export type { CursorPagingOptions, PaginatedResult, StorageCursor } from "./types";

export interface TypedPagedSubmissionStorageAdapter<TMeta extends BaseSubmissionMetadata> {
  readonly fetchPage: (
    formId: string,
    options?: TypedSubmissionPageQueryOptions<TMeta>
  ) => Promise<TypedSubmissionPage<TMeta>>;
}

export async function* iterateTypedSubmissionPages<TMeta extends BaseSubmissionMetadata>(
  adapter: TypedPagedSubmissionStorageAdapter<TMeta>,
  formId: string,
  options: TypedSubmissionPageQueryOptions<TMeta> = {}
): AsyncIterable<readonly FormSubmission<TMeta>[]> {
  let currentCursor = options.cursor;
  const seenCursors = new Set<string>();
  do {
    if (currentCursor !== undefined) {
      if (seenCursors.has(currentCursor)) throw new TypeError("Typed submission pagination cursor cycle detected.");
      seenCursors.add(currentCursor);
    }
    const queryOptions = {
      ...options,
      ...(currentCursor === undefined ? {} : { cursor: currentCursor })
    };
    const page = await adapter.fetchPage(formId, queryOptions);
    yield page.items;
    currentCursor = page.nextCursor;
  } while (currentCursor !== undefined && currentCursor.length > 0);
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
  if (!Number.isSafeInteger(pageSize) || pageSize < 1) {
    throw new TypeError("pageSize must be a positive safe integer.");
  }
  if (!Number.isSafeInteger(maxScanPages) || maxScanPages < 1) {
    throw new TypeError("maxScanPages must be a positive safe integer.");
  }

  const collected: T[] = [];
  let currentRawCursor = cursor;
  let totalScannedCount = 0;
  let scanCount = 0;
  while (collected.length < pageSize && scanCount < maxScanPages) {
    scanCount += 1;
    const { rawItems, rawNextCursor } = await fetchPage(currentRawCursor, pageSize - collected.length + 1);
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
