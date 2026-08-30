import type { FormEngineTranslator } from "@form-engine-ts/core";
import { FormEngineI18nProvider } from "@form-engine-ts/react";
import { type ReactNode, useMemo } from "react";
import type { SurveyUiProviderProps } from "./types";

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
