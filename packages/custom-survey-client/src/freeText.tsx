import type { SensitiveDataFinding } from "@form-engine-ts/privacy";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toFreeTextAnswerItems } from "./freeTextNormalization";
import { createFreeTextTranslationController, translateFreeTextAnswers } from "./freeTextTranslation";
import type {
  CreateFreeTextTranslationControllerOptions,
  DirectFreeTextTranslationOptions,
  FreeTextAnswerInput,
  FreeTextAnswerItem,
  FreeTextAnswerTranslationSlots,
  FreeTextAnswerTranslationsProps,
  FreeTextTranslationController,
  FreeTextTranslationItemState,
  FreeTextTranslationState,
  UseFreeTextAnswerTranslationOptions,
  UseFreeTextAnswerTranslationResult
} from "./types";

function normalizeError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

function initialItems(items: readonly FreeTextAnswerItem[]): FreeTextTranslationItemState[] {
  return items.map((item) => ({ ...item, status: "idle" }));
}

function useStableFreeTextItems(inputItems: readonly FreeTextAnswerInput[]): readonly FreeTextAnswerItem[] {
  const inputItemsKey = inputItems.map((item) => JSON.stringify(item)).join("\u0000");
  const valueRef = useRef<{ readonly key: string; readonly items: readonly FreeTextAnswerItem[] } | undefined>(
    undefined
  );
  if (valueRef.current === undefined || valueRef.current.key !== inputItemsKey) {
    valueRef.current = { key: inputItemsKey, items: toFreeTextAnswerItems(inputItems) };
  }
  return valueRef.current.items;
}

function initialState(
  items: readonly FreeTextAnswerItem[],
  targetLanguage: string,
  sourceLanguage: string
): FreeTextTranslationState {
  return {
    status: "idle",
    items: initialItems(items),
    selectedIds: [],
    targetLanguage,
    sourceLanguage,
    findings: []
  };
}

function findingsFor(
  item: FreeTextAnswerItem,
  detectPii: UseFreeTextAnswerTranslationOptions["detectPii"]
): readonly SensitiveDataFinding[] {
  return item.findings ?? detectPii?.(item) ?? [];
}

/** Manages selection, PII confirmation, batching, and per-answer translation state. */
export function useFreeTextAnswerTranslation({
  items: inputItems,
  adapter,
  targetLanguage,
  sourceLanguage,
  batchSize = 20,
  detectPii
}: UseFreeTextAnswerTranslationOptions): UseFreeTextAnswerTranslationResult {
  const items = useStableFreeTextItems(inputItems);
  const effectiveSourceLanguage = sourceLanguage ?? items[0]?.sourceLanguage ?? "";
  const [state, setState] = useState(() => initialState(items, targetLanguage, effectiveSourceLanguage));
  const [piiConfirmed, setPiiConfirmed] = useState(false);
  const controllerRef = useRef<AbortController | undefined>(undefined);

  useEffect(() => {
    setState(initialState(items, targetLanguage, effectiveSourceLanguage));
    setPiiConfirmed(false);
  }, [effectiveSourceLanguage, items, targetLanguage]);

  const selectedItems = useMemo(() => {
    const selected = new Set(state.selectedIds);
    return state.items.filter((item) => selected.has(item.id));
  }, [state.items, state.selectedIds]);

  const setSelected = useCallback((id: string, selected: boolean) => {
    setState((current) => {
      if (!current.items.some((item) => item.id === id)) return current;
      const ids = new Set(current.selectedIds);
      if (selected) ids.add(id);
      else ids.delete(id);
      return { ...current, selectedIds: [...ids] };
    });
  }, []);

  const selectAll = useCallback(() => {
    setState((current) => ({ ...current, selectedIds: current.items.map((item) => item.id) }));
  }, []);

  const clearSelection = useCallback(() => {
    setState((current) => ({ ...current, selectedIds: [] }));
  }, []);

  const executeTranslation = useCallback(
    async (skipConfirmation: boolean): Promise<FreeTextTranslationState> => {
      const findings = selectedItems.flatMap((item) => findingsFor(item, detectPii));
      if (!skipConfirmation && findings.length > 0 && !piiConfirmed) {
        const next = { ...state, status: "needs_confirmation" as const, findings };
        setState(next);
        return next;
      }
      if (selectedItems.length === 0) return state;
      if (!Number.isSafeInteger(batchSize) || batchSize < 1) {
        const error = new TypeError("batchSize must be a positive safe integer.");
        const next = { ...state, status: "error" as const, error };
        setState(next);
        return next;
      }

      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      const selectedIds = new Set(selectedItems.map((item) => item.id));
      const translatingItems = state.items.map((item) => {
        if (!selectedIds.has(item.id)) return item;
        const { error: _error, ...withoutError } = item;
        return { ...withoutError, status: "translating" as const };
      });
      const started = {
        ...state,
        status: "translating" as const,
        items: translatingItems,
        findings
      };
      setState(started);

      try {
        const groups = new Map<string, FreeTextAnswerItem[]>();
        for (const item of selectedItems) {
          const group = groups.get(item.sourceLanguage) ?? [];
          group.push(item);
          groups.set(item.sourceLanguage, group);
        }
        const translatedById = new Map<string, string>();
        for (const [groupSourceLanguage, group] of groups) {
          for (let offset = 0; offset < group.length; offset += batchSize) {
            const batch = group.slice(offset, offset + batchSize);
            const results = await adapter.translateBatch({
              items: batch,
              targetLanguage,
              sourceLanguage: groupSourceLanguage,
              signal: controller.signal
            });
            for (const result of results) translatedById.set(result.id, result.text);
          }
        }
        if (controller.signal.aborted) return state;
        const missing = selectedItems.find((item) => !translatedById.has(item.id));
        if (missing !== undefined) throw new Error(`Translation result for ${missing.id} is missing.`);
        const completedItems = state.items.map((item) => {
          if (!selectedIds.has(item.id)) return item;
          const translatedText = translatedById.get(item.id);
          if (translatedText === undefined) throw new Error(`Translation result for ${item.id} is missing.`);
          return { ...item, status: "success" as const, translatedText };
        });
        const completed = { ...started, status: "success" as const, items: completedItems };
        setPiiConfirmed(false);
        setState(completed);
        return completed;
      } catch (cause) {
        if (controller.signal.aborted) return state;
        const error = normalizeError(cause);
        const failedItems = state.items.map((item) =>
          selectedIds.has(item.id) ? { ...item, status: "error" as const, error } : item
        );
        const failed = { ...started, status: "error" as const, items: failedItems, error };
        setState(failed);
        return failed;
      }
    },
    [adapter, batchSize, detectPii, piiConfirmed, selectedItems, state, targetLanguage]
  );

  const confirmPii = useCallback(() => {
    setPiiConfirmed(true);
    return executeTranslation(true);
  }, [executeTranslation]);

  const cancelPii = useCallback(() => {
    setPiiConfirmed(false);
    setState((current) => ({ ...current, status: "idle", findings: [] }));
  }, []);

  const translateSelected = useCallback(() => executeTranslation(false), [executeTranslation]);

  const translate = useCallback(
    (inputItems: readonly FreeTextAnswerInput[], options: DirectFreeTextTranslationOptions = {}) =>
      translateFreeTextAnswers(inputItems, adapter, {
        ...options,
        targetLanguage: options.targetLanguage ?? targetLanguage,
        ...(options.sourceLanguage === undefined
          ? sourceLanguage === undefined
            ? {}
            : { sourceLanguage }
          : { sourceLanguage: options.sourceLanguage })
      }),
    [adapter, sourceLanguage, targetLanguage]
  );

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    setPiiConfirmed(false);
    setState(initialState(items, targetLanguage, effectiveSourceLanguage));
  }, [effectiveSourceLanguage, items, targetLanguage]);

  return {
    ...state,
    setSelected,
    selectAll,
    clearSelection,
    confirmPii,
    cancelPii,
    translateSelected,
    translate,
    reset
  };
}

/** Creates a selection-free translation controller for arbitrary answer arrays. */
export function useFreeTextAnswerTranslationController(
  options: CreateFreeTextTranslationControllerOptions
): FreeTextTranslationController {
  const { adapter, targetLanguage, sourceLanguage, batchSize, detectPii } = options;
  return useMemo(
    () =>
      createFreeTextTranslationController({
        adapter,
        targetLanguage,
        ...(sourceLanguage === undefined ? {} : { sourceLanguage }),
        ...(batchSize === undefined ? {} : { batchSize }),
        ...(detectPii === undefined ? {} : { detectPii })
      }),
    [adapter, batchSize, detectPii, sourceLanguage, targetLanguage]
  );
}

function defaultItem(item: FreeTextTranslationItemState): React.JSX.Element {
  return (
    <span>
      <span>{item.text}</span>
      {item.translatedText === undefined ? null : <span> → {item.translatedText}</span>}
      {item.status === "translating" ? <span> …</span> : null}
      {item.error === undefined ? null : <span role="alert"> {item.error.message}</span>}
    </span>
  );
}

export function FreeTextAnswerTranslations({
  items,
  adapter,
  targetLanguage,
  sourceLanguage,
  batchSize,
  detectPii,
  slots,
  title = "Free-text answers",
  translateLabel = "Translate selected"
}: FreeTextAnswerTranslationsProps): React.JSX.Element {
  const translation = useFreeTextAnswerTranslation({
    items,
    adapter,
    targetLanguage,
    ...(sourceLanguage === undefined ? {} : { sourceLanguage }),
    ...(batchSize === undefined ? {} : { batchSize }),
    ...(detectPii === undefined ? {} : { detectPii })
  });
  const selected = new Set(translation.selectedIds);
  const groups = new Map<string, FreeTextTranslationItemState[]>();
  for (const item of translation.items) {
    const group = groups.get(item.sourceLanguage) ?? [];
    group.push(item);
    groups.set(item.sourceLanguage, group);
  }

  return (
    <section className="fe-free-text-translations">
      <h2>{title}</h2>
      <button type="button" onClick={translation.selectAll}>
        Select all
      </button>
      <button type="button" onClick={translation.clearSelection}>
        Clear selection
      </button>
      <button
        type="button"
        onClick={() => void translation.translateSelected()}
        disabled={translation.status === "translating"}
      >
        {translateLabel}
      </button>
      {translation.status === "needs_confirmation"
        ? (slots?.renderPiiConfirmation?.(
            translation.findings,
            () => void translation.confirmPii(),
            translation.cancelPii
          ) ?? (
            <div role="alert">
              <p>Potential personal information was found. Confirm before translating.</p>
              <button type="button" onClick={() => void translation.confirmPii()}>
                Confirm and translate
              </button>
            </div>
          ))
        : null}
      {translation.error === undefined ? null : <div role="alert">{translation.error.message}</div>}
      {[...groups].map(([language, group]) => (
        <div key={language} data-language={language}>
          <h3>{language}</h3>
          {group.map((item) => (
            <div key={item.id}>
              {slots?.renderItem?.(item, selected.has(item.id)) ?? defaultItem(item)}
              <input
                type="checkbox"
                checked={selected.has(item.id)}
                onChange={(event) => translation.setSelected(item.id, event.target.checked)}
                aria-label={`Select ${item.id}`}
              />
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}

/** Survey-specific name for the free-text translation container. */
export function SurveyFreeTextTable(props: FreeTextAnswerTranslationsProps): React.JSX.Element {
  return <FreeTextAnswerTranslations {...props} />;
}

export { toFreeTextAnswerItems } from "./freeTextNormalization";
export type { FreeTextAnswerTranslationSlots };
