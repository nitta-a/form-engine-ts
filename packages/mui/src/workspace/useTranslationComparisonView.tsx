import type { LocaleOption } from "@form-engine-ts/core";
import {
  type ConfirmRemoveLocaleSlotProps,
  type TranslationComparisonHeaderProps,
  type TranslationComparisonLocaleSelectorProps,
  useTranslationComparison
} from "@form-engine-ts/react";
import { useState } from "react";
import type { TranslationComparisonWorkspaceProps } from "./TranslationComparisonWorkspace";
import { TranslationWorkspaceDialog } from "./TranslationWorkspaceDialog";
import {
  getLocaleDisplayLabel,
  localeKey,
  localizeLocaleOptions,
  workspaceErrorMessage
} from "./translationWorkspaceUtils";

export interface TranslationComparisonViewResult {
  readonly comparison: ReturnType<typeof useTranslationComparison>;
  readonly newLocale: string;
  readonly setNewLocale: (locale: string) => void;
  readonly handleAddLocale: () => void;
  readonly localeLabel: (locale: string) => string;
  readonly sourceLocaleLabel: string;
  readonly targetLocaleLabel: string;
  readonly sourceHeader: string;
  readonly targetHeader: string;
  readonly headerProps: TranslationComparisonHeaderProps;
  readonly localizedLocaleOptions: readonly LocaleOption[];
  readonly localeCandidates: readonly LocaleOption[];
  readonly selectedLocaleOption: LocaleOption | undefined;
  readonly canRemoveTargetLocale: boolean;
  readonly errorMessage: string | undefined;
  readonly targetLocaleSelectorProps: TranslationComparisonLocaleSelectorProps;
}

type TranslationFunction = (key: string, params?: Record<string, unknown>) => string;

export function useTranslationComparisonView(
  props: TranslationComparisonWorkspaceProps,
  translate: TranslationFunction
): TranslationComparisonViewResult {
  const {
    schema,
    sourceLocale,
    targetLocale,
    availableLocales,
    policy,
    readOnly = false,
    translationAdapter,
    signal,
    onChange,
    onTranslationChange,
    onTranslationReport,
    onTranslationError,
    onLocaleAdded,
    onLocaleRemoved,
    onLocaleChange,
    beforeRemoveLocale,
    onTranslationStart,
    onTranslationSuccess,
    validateLocale,
    createTranslationMetadata,
    i18n,
    slots
  } = props;
  const [newLocale, setNewLocale] = useState("");
  const localizedAvailableLocales = availableLocales?.map((candidate) =>
    typeof candidate === "string"
      ? { locale: candidate, label: getLocaleDisplayLabel(candidate, [], i18n?.getLocaleLabel, i18n?.customDictionary) }
      : candidate
  );
  const defaultConfirmRemoveLocale = (dialogProps: ConfirmRemoveLocaleSlotProps) => (
    <TranslationWorkspaceDialog
      {...dialogProps}
      localeLabel={getLocaleDisplayLabel(
        dialogProps.locale,
        localizedAvailableLocales,
        i18n?.getLocaleLabel,
        i18n?.customDictionary
      )}
      translate={translate}
    />
  );
  const comparison = useTranslationComparison({
    schema,
    targetLocale: targetLocale ?? "",
    ...(localizedAvailableLocales === undefined ? {} : { availableLocales: localizedAvailableLocales }),
    ...(policy === undefined ? {} : { policy }),
    ...(sourceLocale === undefined ? {} : { sourceLocale }),
    ...(translationAdapter === undefined ? {} : { translationAdapter }),
    ...(signal === undefined ? {} : { signal }),
    readOnly,
    ...(onChange === undefined ? {} : { onChange }),
    ...(onTranslationChange === undefined ? {} : { onTranslationChange }),
    ...(onTranslationReport === undefined ? {} : { onTranslationReport }),
    ...(onTranslationError === undefined ? {} : { onTranslationError }),
    ...(onLocaleAdded === undefined ? {} : { onLocaleAdded }),
    ...(onLocaleRemoved === undefined ? {} : { onLocaleRemoved }),
    ...(onLocaleChange === undefined ? {} : { onLocaleChange }),
    ...(beforeRemoveLocale === undefined ? {} : { beforeRemoveLocale }),
    ...(onTranslationStart === undefined ? {} : { onTranslationStart }),
    ...(onTranslationSuccess === undefined ? {} : { onTranslationSuccess }),
    ...(validateLocale === undefined ? {} : { validateLocale }),
    ...(createTranslationMetadata === undefined ? {} : { createTranslationMetadata }),
    confirmRemoveLocale: slots?.confirmRemoveLocale ?? defaultConfirmRemoveLocale
  });
  const getLocaleLabel = (locale: string): string =>
    getLocaleDisplayLabel(locale, comparison.localeOptions, i18n?.getLocaleLabel, i18n?.customDictionary);
  const sourceLocaleLabel = getLocaleLabel(comparison.sourceLocale);
  const targetLocaleLabel = getLocaleLabel(comparison.targetLocale);
  const sourceHeader =
    i18n?.customDictionary?.headers?.sourceTitle ??
    translate("workspace.comparison.sourceHeader", { locale: sourceLocaleLabel });
  const targetHeader =
    i18n?.customDictionary?.headers?.targetTitle ??
    translate("workspace.comparison.targetHeader", { locale: targetLocaleLabel });
  const localizedLocaleOptions = localizeLocaleOptions(comparison.localeOptions, i18n?.getLocaleLabel);
  const targetLocaleSet = new Set(comparison.targetLocales.map(localeKey));
  const localeCandidates = comparison.localeOptions.filter(
    (option) =>
      localeKey(option.locale) !== localeKey(comparison.sourceLocale) && !targetLocaleSet.has(localeKey(option.locale))
  );
  const selectedLocaleOption = comparison.localeOptions.find(
    (option) => localeKey(option.locale) === localeKey(comparison.targetLocale)
  );
  const canRemoveTargetLocale =
    !readOnly && comparison.targetLocale.length > 0 && comparison.targetLocale !== comparison.sourceLocale;
  const handleAddLocale = () => {
    const result = comparison.addLocale(newLocale);
    if (result.success) setNewLocale("");
  };
  const errorMessage =
    comparison.error === undefined ? undefined : workspaceErrorMessage(comparison.error, translate, getLocaleLabel);
  const headerProps: TranslationComparisonHeaderProps = {
    sourceLocale: comparison.sourceLocale,
    targetLocale: comparison.targetLocale,
    sourceLocaleLabel,
    targetLocaleLabel,
    summary: comparison.summary,
    onTranslateAll: () => void comparison.translateAll(),
    isTranslating: comparison.isTranslating,
    readOnly,
    ...(comparison.report === undefined ? {} : { report: comparison.report }),
    ...(comparison.progress === undefined ? {} : { progress: comparison.progress }),
    onCancel: comparison.cancelTranslation
  };
  return {
    comparison,
    newLocale,
    setNewLocale,
    handleAddLocale,
    localeLabel: getLocaleLabel,
    sourceLocaleLabel,
    targetLocaleLabel,
    sourceHeader,
    targetHeader,
    headerProps,
    localizedLocaleOptions,
    localeCandidates,
    selectedLocaleOption,
    canRemoveTargetLocale,
    errorMessage,
    targetLocaleSelectorProps: {
      targetLocale: comparison.targetLocale,
      targetLocales: comparison.targetLocales,
      localeOptions: localizedLocaleOptions,
      readOnly,
      onTargetLocaleChange: comparison.setTargetLocale
    }
  };
}
