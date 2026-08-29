import type {
  CanonicalTranslationMetadata,
  FormSchema,
  TranslationReport,
  TranslationSlot,
  TranslationStatus
} from "@form-engine-ts/core";
import { computeSourceTextHash } from "@form-engine-ts/core";
import { useCallback, useMemo } from "react";
import type {
  TranslationComparisonItem,
  TranslationComparisonSummary,
  UseTranslationComparisonOptions,
  UseTranslationComparisonResult
} from "../types";
import { useTranslationWorkspace } from "./useTranslationWorkspace";

function canonicalMetadata(
  metadata: Readonly<Record<string, unknown>> | undefined,
  sourceText: string,
  sourceLocale: string,
  translatedText: string | undefined
): CanonicalTranslationMetadata | undefined {
  if (translatedText === undefined || translatedText.trim().length === 0) return undefined;
  if (
    metadata !== undefined &&
    typeof metadata.sourceLocale === "string" &&
    typeof metadata.sourceTextHash === "string" &&
    (metadata.translationSource === "automatic" || metadata.translationSource === "manual")
  ) {
    return {
      sourceLocale: metadata.sourceLocale,
      sourceTextHash: metadata.sourceTextHash,
      translationSource: metadata.translationSource,
      ...(typeof metadata.translatedAt === "string" ? { translatedAt: metadata.translatedAt } : {}),
      ...(typeof metadata.editedAt === "string" ? { editedAt: metadata.editedAt } : {})
    };
  }
  return {
    sourceLocale: typeof metadata?.sourceLocale === "string" ? metadata.sourceLocale : sourceLocale,
    sourceTextHash: computeSourceTextHash(sourceText),
    translationSource:
      metadata?.isManual === true || metadata?.isManuallyEdited === true || metadata?.translationSource === "manual"
        ? "manual"
        : "automatic"
  };
}

function optionParentId(slot: TranslationSlot): string | undefined {
  if (slot.kind !== "option" || slot.path === undefined) return undefined;
  return /^fields\.([^.]+)\.options\./u.exec(slot.path)?.[1];
}

function getNodeTitle(schema: FormSchema, slot: TranslationSlot): string | undefined {
  if (slot.kind === "field") return schema.fields.find((field) => field.id === slot.nodeId)?.title;
  if (slot.kind === "page") return schema.pages?.find((page) => page.id === slot.nodeId)?.title;
  if (slot.kind === "option") return schema.fields.find((field) => field.id === optionParentId(slot))?.title;
  return undefined;
}

function comparisonItem(
  schema: FormSchema,
  slot: TranslationSlot,
  sourceLocale: string,
  hasAdapter: boolean
): TranslationComparisonItem {
  const path = slot.path ?? `${slot.kind}.${slot.nodeId}.${slot.property}`;
  const nodeTitle = getNodeTitle(schema, slot);
  const metadata = canonicalMetadata(
    slot.existingTranslationMetadata,
    slot.sourceText,
    sourceLocale,
    slot.existingText
  );
  return {
    id: path,
    path,
    targetKind: slot.kind,
    targetProperty: slot.property,
    ...(nodeTitle === undefined ? {} : { nodeTitle }),
    sourceText: slot.sourceText,
    translatedText: slot.existingText ?? "",
    status: slot.status ?? "missing",
    ...(metadata === undefined ? {} : { metadata }),
    translatable: hasAdapter && slot.sourceText.trim().length > 0
  };
}

function summaryFor(items: readonly TranslationComparisonItem[]): TranslationComparisonSummary {
  const counts: Record<TranslationStatus, number> = {
    missing: 0,
    translated: 0,
    stale: 0,
    manual: 0,
    "manual-stale": 0
  };
  for (const item of items) counts[item.status] += 1;
  return {
    total: items.length,
    translated: counts.translated + counts.manual,
    missing: counts.missing,
    stale: counts.stale + counts["manual-stale"],
    manual: counts.manual + counts["manual-stale"]
  };
}

export function useTranslationComparison({
  schema,
  sourceLocale = schema.defaultLocale ?? "en",
  targetLocale,
  translationAdapter,
  readOnly = false,
  onChange,
  onTranslationChange
}: UseTranslationComparisonOptions): UseTranslationComparisonResult {
  const workspace = useTranslationWorkspace({
    schema,
    sourceLocale,
    targetLocale,
    ...(translationAdapter === undefined ? {} : { translationAdapter }),
    readOnly,
    ...(onChange === undefined ? {} : { onChange }),
    ...(onTranslationChange === undefined ? {} : { onTranslationChange })
  });
  const items = useMemo(
    () => workspace.slots.map((slot) => comparisonItem(schema, slot, sourceLocale, translationAdapter !== undefined)),
    [schema, sourceLocale, translationAdapter, workspace.slots]
  );
  const itemByPath = useMemo(() => new Map(workspace.slots.map((slot) => [slot.path, slot])), [workspace.slots]);
  const updateTranslation = useCallback(
    (path: string, text: string): void => {
      const slot = itemByPath.get(path);
      if (slot !== undefined) workspace.setTranslation(slot, text);
    },
    [itemByPath, workspace]
  );
  const translateSingle = useCallback(
    async (path: string): Promise<void> => {
      const slot = itemByPath.get(path);
      if (slot === undefined) return;
      const result = await workspace.translateSlot(slot);
      if (!result.success) throw new Error(result.error?.type ?? "Translation failed.");
    },
    [itemByPath, workspace]
  );
  const translateAll = useCallback(async (): Promise<TranslationReport> => {
    const result = await workspace.translateAll();
    if (result.report !== undefined) return result.report;
    throw new Error(result.error?.type ?? "Translation failed.");
  }, [workspace]);
  return {
    sourceLocale: workspace.sourceLocale,
    targetLocale: workspace.targetLocale,
    items,
    summary: summaryFor(items),
    isTranslating: workspace.isTranslating,
    updateTranslation,
    translateSingle,
    translateAll
  };
}
