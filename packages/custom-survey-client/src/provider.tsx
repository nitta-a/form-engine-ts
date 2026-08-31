import type { FormEngineTranslator } from "@form-engine-ts/core";
import { FormEngineI18nProvider, useFormEngineI18n } from "@form-engine-ts/react";
import { createContext, type ReactNode, useContext, useMemo } from "react";
import type { SurveyI18n, SurveyTranslationAdapter, SurveyTranslationScope, SurveyUiProviderProps } from "./types";

export interface CreateSurveyTranslationAdapterOptions {
  readonly translate: SurveyTranslationAdapter["translate"];
  readonly translateText?: SurveyTranslationAdapter["translateText"];
  readonly translateBatch?: SurveyTranslationAdapter["translateBatch"];
}

/** Creates the package adapter shape without requiring an application-specific type assertion. */
export function createSurveyTranslationAdapter(
  options: CreateSurveyTranslationAdapterOptions
): SurveyTranslationAdapter {
  return {
    translate: options.translate,
    ...(options.translateText === undefined ? {} : { translateText: options.translateText }),
    ...(options.translateBatch === undefined ? {} : { translateBatch: options.translateBatch })
  };
}

function createAdapterTranslator(
  adapter: NonNullable<SurveyUiProviderProps["translationAdapter"]>,
  locale: string
): FormEngineTranslator {
  return (key, params = {}) => {
    const adapterParams: Record<string, string | number> = {};
    for (const [name, value] of Object.entries(params)) {
      if (typeof value === "string" || typeof value === "number") adapterParams[name] = value;
    }
    const result = adapter.translate(key, locale, adapterParams);
    return result ?? key;
  };
}

function isSurveyI18n(value: unknown): value is SurveyI18n {
  return typeof value === "object" && value !== null && "t" in value && typeof value.t === "function";
}

/** Adapts an application's typed translation function to the Form Engine translator contract. */
export function createSurveyTranslator(
  adapter: NonNullable<SurveyUiProviderProps["translationAdapter"]>,
  locale: string
): FormEngineTranslator {
  return createAdapterTranslator(adapter, locale);
}

const defaultTranslationScope: SurveyTranslationScope = {
  locale: "ja",
  common: (key) => key,
  customSurvey: (key) => key
};

const SurveyTranslationContext = createContext<SurveyTranslationScope>(defaultTranslationScope);

function toTranslationParams(options: Readonly<Record<string, unknown>> | undefined): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(options ?? {})) {
    if (typeof value === "string" || typeof value === "number") params[name] = value;
  }
  return params;
}

function createTranslationScope(
  props: SurveyUiProviderProps,
  locale: string,
  commonNamespace: string,
  customSurveyNamespace: string
): SurveyTranslationScope {
  if (props.translation !== undefined) return { ...props.translation, locale: props.translation.locale ?? locale };
  const translate = (namespace: string, key: string, options?: Record<string, unknown>): string => {
    if (props.i18n !== undefined && isSurveyI18n(props.i18n)) {
      const value = props.i18n.t(key, { ...(options ?? {}), ns: namespace });
      return typeof value === "string" ? value : key;
    }
    if (props.translationAdapter !== undefined) {
      return props.translationAdapter.translate(`${namespace}:${key}`, locale, toTranslationParams(options)) ?? key;
    }
    if (props.translator !== undefined) return props.translator(`${namespace}:${key}`, options);
    return `${namespace}:${key}`;
  };
  return {
    locale,
    common: (key, options) => translate(commonNamespace, key, options),
    customSurvey: (key, options) => translate(customSurveyNamespace, key, options)
  };
}

/** Provides one shared translation scope for all custom survey client components. */
export function SurveyUiProvider(props: SurveyUiProviderProps): ReactNode {
  const {
    locale,
    fallbackLocale,
    namespaces,
    commonNamespace,
    customSurveyNamespace,
    i18n,
    translationAdapter,
    translator: explicitTranslator,
    translation,
    children
  } = props;
  const parentI18n = useFormEngineI18n();
  const shouldInheritParent =
    explicitTranslator === undefined &&
    i18n === undefined &&
    translationAdapter === undefined &&
    locale === undefined &&
    fallbackLocale === undefined &&
    namespaces === undefined &&
    commonNamespace === undefined &&
    customSurveyNamespace === undefined &&
    translation === undefined;
  const effectiveLocale = locale ?? (isSurveyI18n(i18n) ? i18n.language : undefined) ?? parentI18n.uiLocale;
  const effectiveFallbackLocale = fallbackLocale ?? "en";
  const effectiveNamespaces = useMemo(
    () =>
      Array.from(
        new Set([
          ...(namespaces ?? []),
          ...(commonNamespace === undefined ? [] : [commonNamespace]),
          ...(customSurveyNamespace === undefined ? [] : [customSurveyNamespace])
        ])
      ),
    [commonNamespace, customSurveyNamespace, namespaces]
  );
  const translator = useMemo(() => {
    if (explicitTranslator !== undefined) return explicitTranslator;
    if (translation !== undefined) return (key, params = {}) => translation.common(key, params);
    if (translationAdapter !== undefined) return createSurveyTranslator(translationAdapter, effectiveLocale);
    if (i18n !== undefined && isSurveyI18n(i18n)) {
      return (key, params = {}) => {
        const translated = i18n.t(key, {
          ...params,
          ...(effectiveNamespaces.length === 0
            ? {}
            : { ns: effectiveNamespaces.length === 1 ? effectiveNamespaces[0] : effectiveNamespaces })
        });
        return typeof translated === "string" ? translated : key;
      };
    }
    return undefined;
  }, [effectiveLocale, effectiveNamespaces, explicitTranslator, i18n, translation, translationAdapter]);

  const translationScope = useMemo(
    () =>
      createTranslationScope(
        props,
        effectiveLocale,
        commonNamespace ?? "common",
        customSurveyNamespace ?? "customSurvey"
      ),
    [commonNamespace, customSurveyNamespace, effectiveLocale, props]
  );

  if (shouldInheritParent) {
    return <SurveyTranslationContext.Provider value={translationScope}>{children}</SurveyTranslationContext.Provider>;
  }

  return (
    <FormEngineI18nProvider
      locale={effectiveLocale}
      fallbackLocale={effectiveFallbackLocale}
      {...(translator === undefined ? {} : { translator })}
    >
      <SurveyTranslationContext.Provider value={translationScope}>{children}</SurveyTranslationContext.Provider>
    </FormEngineI18nProvider>
  );
}

/** Shared translation contract for headless hooks and ready-to-use survey components. */
export function useSurveyTranslation(): SurveyTranslationScope {
  return useContext(SurveyTranslationContext);
}

/** Short alias for applications that use Survey as their only Form Engine surface. */
export const SurveyProvider = SurveyUiProvider;
