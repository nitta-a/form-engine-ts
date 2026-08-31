import type { SensitiveDataFinding } from "@form-engine-ts/privacy";
import { toFreeTextAnswerItems } from "./freeTextNormalization";
import type {
  CreateFreeTextTranslationControllerOptions,
  DirectFreeTextTranslationOptions,
  FreeTextAnswerInput,
  FreeTextAnswerItem,
  FreeTextTranslationAdapter,
  FreeTextTranslationController,
  FreeTextTranslationOutcome,
  FreeTextTranslationOutcomeItem,
  TranslateFreeTextAnswersOptions
} from "./types";

function normalizeError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

function findingsFor(
  item: FreeTextAnswerItem,
  detectPii: TranslateFreeTextAnswersOptions["detectPii"]
): readonly SensitiveDataFinding[] {
  return item.findings ?? detectPii?.(item) ?? [];
}

export function getFreeTextAnswerFindings(
  items: readonly FreeTextAnswerInput[],
  detectPii?: TranslateFreeTextAnswersOptions["detectPii"]
): readonly SensitiveDataFinding[] {
  return toFreeTextAnswerItems(items).flatMap((item) => findingsFor(item, detectPii));
}

export function hasPiiCandidate(
  items: readonly FreeTextAnswerInput[],
  detectPii?: TranslateFreeTextAnswersOptions["detectPii"]
): boolean {
  return getFreeTextAnswerFindings(items, detectPii).length > 0;
}

function outcomeItems(
  items: readonly FreeTextAnswerItem[],
  translatedById: ReadonlyMap<string, string>,
  errorsById: ReadonlyMap<string, Error>
): FreeTextTranslationOutcomeItem[] {
  return items.map((item) => {
    const translatedText = translatedById.get(item.id);
    if (translatedText !== undefined) return { ...item, status: "success", translatedText };
    return { ...item, status: "error", error: errorsById.get(item.id) ?? new Error("Translation failed.") };
  });
}

function pendingOutcome(
  items: readonly FreeTextAnswerItem[],
  findings: readonly SensitiveDataFinding[]
): FreeTextTranslationOutcome {
  return {
    status: "needs_confirmation",
    items: items.map((item) => ({ ...item, status: "pending" })),
    findings,
    succeeded: 0,
    failed: 0,
    failures: []
  };
}

function createOutcome(
  items: readonly FreeTextAnswerItem[],
  findings: readonly SensitiveDataFinding[],
  translatedById: ReadonlyMap<string, string>,
  errorsById: ReadonlyMap<string, Error>,
  failures: readonly { readonly item: FreeTextAnswerItem; readonly cause: unknown }[],
  statusOverride?: FreeTextTranslationOutcome["status"]
): FreeTextTranslationOutcome {
  const resultItems = outcomeItems(items, translatedById, errorsById);
  const succeeded = resultItems.filter((item) => item.status === "success").length;
  const failed = resultItems.length - succeeded;
  const status = statusOverride ?? (failed === 0 ? "success" : succeeded === 0 ? "error" : "partial");
  const firstFailure = failures[0];
  return {
    status,
    items: resultItems,
    findings,
    succeeded,
    failed,
    failures,
    ...(firstFailure === undefined ? {} : { error: normalizeError(firstFailure.cause) })
  };
}

/** Translates arbitrary free-text answers without using selection state. */
export async function translateFreeTextAnswers(
  inputItems: readonly FreeTextAnswerInput[],
  adapter: FreeTextTranslationAdapter,
  options: TranslateFreeTextAnswersOptions
): Promise<FreeTextTranslationOutcome> {
  const items = toFreeTextAnswerItems(inputItems);
  const findings = items.flatMap((item) => findingsFor(item, options.detectPii));
  const emptyResults = new Map<string, string>();
  if (findings.length > 0 && options.piiConfirmed !== true) {
    return pendingOutcome(items, findings);
  }

  const batchSize = options.batchSize ?? 20;
  if (!Number.isSafeInteger(batchSize) || batchSize < 1) {
    const error = new TypeError("batchSize must be a positive safe integer.");
    const errors = new Map(items.map((item) => [item.id, error]));
    return createOutcome(
      items,
      findings,
      emptyResults,
      errors,
      items.map((item) => ({ item, cause: error }))
    );
  }

  const translatedById = new Map<string, string>();
  const errorsById = new Map<string, Error>();
  const failures: { readonly item: FreeTextAnswerItem; readonly cause: unknown }[] = [];
  const groups = new Map<string, FreeTextAnswerItem[]>();
  for (const item of items) {
    const sourceLanguage = options.sourceLanguage ?? item.sourceLanguage;
    const group = groups.get(sourceLanguage) ?? [];
    group.push(item);
    groups.set(sourceLanguage, group);
  }

  for (const [sourceLanguage, group] of groups) {
    for (let offset = 0; offset < group.length; offset += batchSize) {
      const batch = group.slice(offset, offset + batchSize);
      if (options.signal?.aborted) {
        return createOutcome(items, findings, translatedById, errorsById, failures, "cancelled");
      }
      try {
        const results = await adapter.translateBatch({
          items: batch,
          targetLanguage: options.targetLanguage,
          sourceLanguage,
          signal: options.signal ?? new AbortController().signal
        });
        const batchIds = new Set(batch.map((item) => item.id));
        const resultIds = new Set<string>();
        for (const result of results) {
          if (!batchIds.has(result.id) || resultIds.has(result.id)) continue;
          resultIds.add(result.id);
          translatedById.set(result.id, result.text);
        }
        for (const item of batch) {
          if (translatedById.has(item.id)) continue;
          const error = new Error(`Translation result for ${item.id} is missing.`);
          errorsById.set(item.id, error);
          failures.push({ item, cause: error });
        }
      } catch (cause) {
        if (options.signal?.aborted) {
          return createOutcome(items, findings, translatedById, errorsById, failures, "cancelled");
        }
        const error = normalizeError(cause);
        for (const item of batch) {
          errorsById.set(item.id, error);
          failures.push({ item, cause });
        }
      }
    }
  }
  return createOutcome(items, findings, translatedById, errorsById, failures);
}

function optionsWithDefaults(
  defaults: CreateFreeTextTranslationControllerOptions,
  options: DirectFreeTextTranslationOptions
): TranslateFreeTextAnswersOptions {
  return {
    targetLanguage: options.targetLanguage ?? defaults.targetLanguage,
    ...(options.sourceLanguage === undefined
      ? defaults.sourceLanguage === undefined
        ? {}
        : { sourceLanguage: defaults.sourceLanguage }
      : { sourceLanguage: options.sourceLanguage }),
    ...(options.batchSize === undefined
      ? defaults.batchSize === undefined
        ? {}
        : { batchSize: defaults.batchSize }
      : { batchSize: options.batchSize }),
    ...(options.detectPii === undefined
      ? defaults.detectPii === undefined
        ? {}
        : { detectPii: defaults.detectPii }
      : { detectPii: options.detectPii }),
    ...(options.piiConfirmed === undefined ? {} : { piiConfirmed: options.piiConfirmed }),
    ...(options.signal === undefined ? {} : { signal: options.signal })
  };
}

export function createFreeTextTranslationController(
  defaults: CreateFreeTextTranslationControllerOptions
): FreeTextTranslationController {
  return {
    translate: (items, options = {}) =>
      translateFreeTextAnswers(items, defaults.adapter, optionsWithDefaults(defaults, options))
  };
}
