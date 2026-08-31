import type { FormEngineTranslator } from "@form-engine-ts/core";
import { FormEngineI18nProvider, useFormEngineI18n } from "@form-engine-ts/react";
import { type ReactNode, useMemo } from "react";
import type { SurveyTranslationAdapter, SurveyUiProviderProps } from "./types";

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
  translationAdapter,
  translator: explicitTranslator,
  children
}: SurveyUiProviderProps): ReactNode {
  const parentI18n = useFormEngineI18n();
  const shouldInheritParent =
    explicitTranslator === undefined &&
    translationAdapter === undefined &&
    locale === undefined &&
    fallbackLocale === undefined;
  const effectiveLocale = locale ?? parentI18n.uiLocale;
  const effectiveFallbackLocale = fallbackLocale ?? "en";
  const translator = useMemo(() => {
    if (explicitTranslator !== undefined) return explicitTranslator;
    if (translationAdapter !== undefined) return createSurveyTranslator(translationAdapter, effectiveLocale);
    return undefined;
  }, [effectiveLocale, explicitTranslator, translationAdapter]);

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
