import type {
  CanonicalTranslationMetadata,
  FormSchema,
  JsonValue,
  LocaleOption,
  TranslationSlot,
  TranslationStatus,
  TranslationWorkspaceCustomDictionary
} from "@form-engine-ts/core";
import { normalizeLocale } from "@form-engine-ts/core";
import type {
  TranslationComparisonItem,
  TranslationComparisonItemIconProps,
  TranslationComparisonItemRowProps,
  TranslationWorkspaceError
} from "@form-engine-ts/react";
import ArticleIcon from "@mui/icons-material/Article";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HelpIcon from "@mui/icons-material/Help";
import ListIcon from "@mui/icons-material/List";
import type { ReactNode } from "react";

export const translationStatusKey: Record<TranslationStatus, string> = {
  missing: "workspace.status.missing",
  translated: "workspace.status.translated",
  stale: "workspace.status.stale",
  manual: "workspace.status.manual",
  "manual-stale": "workspace.status.manualStale"
};

export const translationPropertyKey: Record<TranslationComparisonItem["targetProperty"], string> = {
  title: "workspace.comparison.property.title",
  description: "workspace.comparison.property.description",
  label: "workspace.comparison.property.label",
  completionMessage: "workspace.comparison.property.completionMessage"
};

export const translationNodeKindKey: Record<TranslationComparisonItem["targetKind"], string> = {
  form: "workspace.comparison.nodeKind.form",
  page: "workspace.comparison.nodeKind.page",
  field: "workspace.comparison.nodeKind.field",
  option: "workspace.comparison.nodeKind.option"
};

export function translationStatusColor(status: TranslationStatus): "default" | "success" | "warning" {
  if (status === "translated" || status === "manual") return "success";
  if (status === "stale" || status === "manual-stale") return "warning";
  return "default";
}

export function defaultTranslationSlotIcon({ item }: TranslationComparisonItemIconProps): ReactNode {
  if (item.targetKind === "option") return <ListIcon fontSize="small" aria-hidden="true" />;
  if (item.targetProperty === "completionMessage") return <CheckCircleIcon fontSize="small" aria-hidden="true" />;
  if (item.targetKind === "field") return <HelpIcon fontSize="small" aria-hidden="true" />;
  return <ArticleIcon fontSize="small" aria-hidden="true" />;
}

export function getLocaleDisplayLabel(
  locale: string,
  options: readonly LocaleOption[] = [],
  getLocaleLabel?: (locale: string) => string,
  customDictionary?: TranslationWorkspaceCustomDictionary
): string {
  const normalizedLocale = localeKey(locale);
  const dictionaryLabel = customDictionary?.localeNames?.[locale] ?? customDictionary?.localeNames?.[normalizedLocale];
  return (
    getLocaleLabel?.(locale) ??
    dictionaryLabel ??
    options.find((option) => localeKey(option.locale) === normalizedLocale)?.label ??
    locale
  );
}

export function localeKey(locale: string): string {
  return normalizeLocale(locale) ?? locale;
}

export function localizeLocaleOptions(
  options: readonly LocaleOption[],
  getLocaleLabel?: (locale: string) => string
): readonly LocaleOption[] {
  return options.map((option) => ({
    ...option,
    label: getLocaleDisplayLabel(option.locale, [option], getLocaleLabel)
  }));
}

export function translationComparisonContext(
  schema: FormSchema,
  item: TranslationComparisonItem
): Pick<TranslationComparisonItemRowProps, "questionIndex" | "fieldType" | "optionIndex"> {
  if (item.targetKind !== "field" && item.targetKind !== "option") return {};
  const parentId = /^fields\.([^.]+)\./u.exec(item.path)?.[1];
  const fieldIndex = schema.fields.findIndex((field) => field.id === parentId);
  const field = fieldIndex < 0 ? undefined : schema.fields[fieldIndex];
  if (field === undefined) return {};
  if (item.targetKind === "field") return { questionIndex: fieldIndex, fieldType: field.type };
  const optionId = /^fields\.[^.]+\.options\.([^.]+)\./u.exec(item.path)?.[1];
  const optionIndex = "options" in field ? field.options.findIndex((option) => option.id === optionId) : -1;
  return {
    questionIndex: fieldIndex,
    fieldType: field.type,
    ...(optionIndex < 0 ? {} : { optionIndex })
  };
}

function isCanonicalMetadata(
  metadata: Readonly<Record<string, JsonValue>> | undefined
): metadata is CanonicalTranslationMetadata & Readonly<Record<string, JsonValue>> {
  return (
    typeof metadata?.sourceLocale === "string" &&
    typeof metadata.sourceTextHash === "string" &&
    (metadata.translationSource === "automatic" || metadata.translationSource === "manual")
  );
}

export function comparisonItemFromSlot(
  schema: FormSchema,
  slot: TranslationSlot,
  hasAdapter: boolean
): TranslationComparisonItem {
  const path = slot.path ?? `${slot.kind}.${slot.nodeId}.${slot.property}`;
  const fieldId = /^fields\.([^.]+)\./u.exec(path)?.[1];
  const field = schema.fields.find((candidate) => candidate.id === fieldId);
  const nodeTitle =
    slot.kind === "form"
      ? schema.title
      : slot.kind === "field" || slot.kind === "option"
        ? field?.title
        : slot.kind === "page"
          ? schema.pages?.find((page) => page.id === slot.nodeId)?.title
          : undefined;
  return {
    id: path,
    path,
    nodeId: slot.nodeId,
    targetKind: slot.kind,
    targetProperty: slot.property,
    ...(nodeTitle === undefined ? {} : { nodeTitle }),
    sourceText: slot.sourceText,
    translatedText: slot.existingText ?? "",
    status: slot.status ?? "missing",
    ...(isCanonicalMetadata(slot.existingTranslationMetadata) ? { metadata: slot.existingTranslationMetadata } : {}),
    translatable: hasAdapter && slot.sourceText.trim().length > 0
  };
}

export function workspaceErrorMessage(
  error: TranslationWorkspaceError,
  translate: (key: string, params?: Record<string, unknown>) => string,
  localeLabel: (locale: string) => string
): string {
  switch (error.type) {
    case "locale_not_allowed":
      return translate("workspace.errors.localeNotAllowed", { locale: localeLabel(error.locale) });
    case "locale_already_exists":
      return translate("workspace.errors.localeAlreadyExists", { locale: localeLabel(error.locale) });
    case "source_locale":
      return translate("workspace.errors.sourceLocale", { locale: localeLabel(error.locale) });
    case "invalid_locale_format":
      return translate("workspace.errors.invalidLocale", { locale: localeLabel(error.locale) });
    case "max_locales_exceeded":
      return translate("workspace.errors.maxLocalesExceeded", { max: error.max });
    case "read_only_mode":
      return translate("workspace.errors.readOnly");
    case "adapter_not_configured":
      return translate("workspace.errors.adapterNotConfigured");
    case "target_locale_missing":
      return translate("workspace.errors.targetLocaleMissing");
    case "translation_failed":
      return translate("workspace.errors.translationFailed");
    case "partial_failure":
      return translate("workspace.errors.partialFailure", { succeeded: error.succeeded, failed: error.failed });
    case "cancelled":
      return translate("workspace.errors.cancelled");
    case "custom_validation_failed":
      return error.message;
  }
}
