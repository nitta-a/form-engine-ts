import type { FormEngineTranslator } from "@form-engine-ts/core";
import { FormEngineI18nProvider } from "@form-engine-ts/react";
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

/** Provides one shared translation scope for all custom survey client components. */
export function SurveyUiProvider({
  locale = "ja",
  fallbackLocale = "en",
  translationAdapter,
  translator: explicitTranslator,
  children
}: SurveyUiProviderProps): ReactNode {
  const translator = useMemo(() => {
    if (explicitTranslator !== undefined) return explicitTranslator;
    if (translationAdapter !== undefined) return createAdapterTranslator(translationAdapter, locale);
    return undefined;
  }, [explicitTranslator, locale, translationAdapter]);

  return (
    <FormEngineI18nProvider
      locale={locale}
      fallbackLocale={fallbackLocale}
      {...(translator === undefined ? {} : { translator })}
    >
      {children}
    </FormEngineI18nProvider>
  );
}

/** Short alias for applications that use Survey as their only Form Engine surface. */
export const SurveyProvider = SurveyUiProvider;
