import type { LocaleOption } from "@form-engine-ts/core";
import type { useFormEngineI18n } from "@form-engine-ts/react";
import {
  type LocaleSelectorProps,
  type TranslationWorkspaceActionsProps,
  type TranslationWorkspaceHeaderProps,
  useTranslationWorkspace
} from "@form-engine-ts/react";
import { useState } from "react";
import type { TranslationWorkspaceProps } from "./TranslationWorkspace";
import { TranslationWorkspaceDialog } from "./TranslationWorkspaceDialog";
import { getLocaleDisplayLabel, localizeLocaleOptions, workspaceErrorMessage } from "./translationWorkspaceUtils";

export interface TranslationWorkspaceViewResult {
  readonly workspace: ReturnType<typeof useTranslationWorkspace>;
  readonly newLocale: string;
  readonly setNewLocale: (locale: string) => void;
  readonly handleAddLocale: () => void;
  readonly localeLabel: (locale: string) => string;
  readonly localizedLocaleOptions: readonly LocaleOption[];
  readonly headerProps: TranslationWorkspaceHeaderProps;
  readonly actionsProps: TranslationWorkspaceActionsProps;
  readonly localeSelectorProps: LocaleSelectorProps;
  readonly errorMessage: string | undefined;
}

type TranslationFunction = ReturnType<typeof useFormEngineI18n>["translator"];

export function useTranslationWorkspaceView(
  props: TranslationWorkspaceProps,
  translate: TranslationFunction
): TranslationWorkspaceViewResult {
  const {
    schema,
    onChange,
    sourceLocale,
    targetLocale,
    translationAdapter,
    signal,
    readOnly = false,
    policy,
    availableLocales,
    onLocaleAdded,
    onLocaleRemoved,
    onLocaleChange,
    beforeRemoveLocale,
    onTranslationStart,
    onTranslationSuccess,
    onTranslationReport,
    onTranslationError,
    onTranslationChange,
    validateLocale,
    createTranslationMetadata,
    i18n,
    slots: workspaceSlots
  } = props;
  const [newLocale, setNewLocale] = useState("");
  const localizedAvailableLocales = availableLocales?.map((candidate) =>
    typeof candidate === "string"
      ? { locale: candidate, label: getLocaleDisplayLabel(candidate, [], i18n?.getLocaleLabel, i18n?.customDictionary) }
      : candidate
  );
  const workspace = useTranslationWorkspace({
    schema,
    ...(onChange === undefined ? {} : { onChange }),
    ...(sourceLocale === undefined ? {} : { sourceLocale }),
    ...(targetLocale === undefined ? {} : { targetLocale }),
    ...(translationAdapter === undefined ? {} : { translationAdapter }),
    ...(signal === undefined ? {} : { signal }),
    readOnly,
    ...(policy === undefined ? {} : { policy }),
    ...(localizedAvailableLocales === undefined ? {} : { availableLocales: localizedAvailableLocales }),
    ...(onLocaleAdded === undefined ? {} : { onLocaleAdded }),
    ...(onLocaleRemoved === undefined ? {} : { onLocaleRemoved }),
    ...(onLocaleChange === undefined ? {} : { onLocaleChange }),
    ...(beforeRemoveLocale === undefined ? {} : { beforeRemoveLocale }),
    confirmRemoveLocale:
      workspaceSlots?.confirmRemoveLocale ??
      ((dialogProps) => (
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
      )),
    ...(onTranslationStart === undefined ? {} : { onTranslationStart }),
    ...(onTranslationSuccess === undefined ? {} : { onTranslationSuccess }),
    ...(onTranslationReport === undefined ? {} : { onTranslationReport }),
    ...(onTranslationError === undefined ? {} : { onTranslationError }),
    ...(onTranslationChange === undefined ? {} : { onTranslationChange }),
    ...(createTranslationMetadata === undefined ? {} : { createTranslationMetadata }),
    ...(validateLocale === undefined ? {} : { validateLocale })
  });
  const localeLabel = (locale: string): string =>
    getLocaleDisplayLabel(locale, workspace.localeOptions, i18n?.getLocaleLabel, i18n?.customDictionary);
  const localizedLocaleOptions = localizeLocaleOptions(workspace.localeOptions, i18n?.getLocaleLabel);
  const headerProps: TranslationWorkspaceHeaderProps = {
    schema,
    sourceLocale: workspace.sourceLocale,
    targetLocale: workspace.targetLocale,
    summary: workspace.summary,
    onTranslateAll: () => void workspace.translateAll(),
    isTranslating: workspace.isTranslating,
    readOnly,
    ...(workspace.progress === undefined ? {} : { progress: workspace.progress }),
    onCancel: workspace.cancelTranslation
  };
  const actionsProps: TranslationWorkspaceActionsProps = {
    onTranslateAll: headerProps.onTranslateAll,
    isTranslating: workspace.isTranslating,
    readOnly
  };
  const localeSelectorProps: LocaleSelectorProps = {
    targetLocale: workspace.targetLocale,
    targetLocales: workspace.targetLocales,
    localeOptions: localizedLocaleOptions,
    newLocale,
    readOnly,
    onTargetLocaleChange: workspace.setTargetLocale,
    onNewLocaleChange: setNewLocale,
    onAddLocale: () => {
      const result = workspace.addLocale(newLocale);
      if (result.success) setNewLocale("");
    }
  };
  const handleAddLocale = () => localeSelectorProps.onAddLocale();
  const errorMessage =
    workspace.error === undefined ? undefined : workspaceErrorMessage(workspace.error, translate, localeLabel);
  return {
    workspace,
    newLocale,
    setNewLocale,
    handleAddLocale,
    localeLabel,
    localizedLocaleOptions,
    headerProps,
    actionsProps,
    localeSelectorProps,
    errorMessage
  };
}
