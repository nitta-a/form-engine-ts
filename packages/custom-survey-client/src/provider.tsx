import type { FormEngineTranslator } from "@form-engine-ts/core";
import { FormEngineI18nProvider, useFormEngineI18n } from "@form-engine-ts/react";
import { type ReactNode, useMemo } from "react";
import type { SurveyI18n, SurveyTranslationAdapter, SurveyUiProviderProps } from "./types";

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

/** Provides one shared translation scope for all custom survey client components. */
export function SurveyUiProvider({
  locale,
  fallbackLocale,
  namespaces,
  i18n,
  translationAdapter,
  translator: explicitTranslator,
  children
}: SurveyUiProviderProps): ReactNode {
  const parentI18n = useFormEngineI18n();
  const shouldInheritParent =
    explicitTranslator === undefined &&
    i18n === undefined &&
    translationAdapter === undefined &&
    locale === undefined &&
    fallbackLocale === undefined;
  const effectiveLocale = locale ?? (isSurveyI18n(i18n) ? i18n.language : undefined) ?? parentI18n.uiLocale;
  const effectiveFallbackLocale = fallbackLocale ?? "en";
  const translator = useMemo(() => {
    if (explicitTranslator !== undefined) return explicitTranslator;
    if (translationAdapter !== undefined) return createSurveyTranslator(translationAdapter, effectiveLocale);
    if (i18n !== undefined && isSurveyI18n(i18n)) {
      return (key, params = {}) => {
        const translated = i18n.t(key, {
          ...params,
          ...(namespaces === undefined ? {} : { ns: namespaces.length === 1 ? namespaces[0] : namespaces })
        });
        return typeof translated === "string" ? translated : key;
      };
    }
    return undefined;
  }, [effectiveLocale, explicitTranslator, i18n, namespaces, translationAdapter]);

  if (shouldInheritParent) return children;

  return (
    <FormEngineI18nProvider
      locale={effectiveLocale}
      fallbackLocale={effectiveFallbackLocale}
      {...(translator === undefined ? {} : { translator })}
    >
      {children}
    </FormEngineI18nProvider>
  );
}

/** Short alias for applications that use Survey as their only Form Engine surface. */
export const SurveyProvider = SurveyUiProvider;
