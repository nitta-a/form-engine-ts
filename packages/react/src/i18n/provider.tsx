import {
  createFormEngineTranslator,
  type FormEngineMessages,
  type FormEngineTranslator,
  type TranslationMissingKeyEvent
} from "@form-engine-ts/core";
import { createContext, type ReactNode, useContext, useMemo } from "react";

export interface FormEngineI18nContextValue {
  readonly uiLocale: string;
  readonly translator: FormEngineTranslator;
}

const defaultTranslator = createFormEngineTranslator({ locale: "ja" });

export const FormEngineI18nContext = createContext<FormEngineI18nContextValue>({
  uiLocale: "ja",
  translator: defaultTranslator
});

/** Internal scope marker used by legacy components to distinguish provider defaults. */
export const FormEngineI18nProviderScopeContext = createContext(false);

export interface FormEngineI18nProviderProps {
  readonly locale?: string;
  readonly fallbackLocale?: string;
  readonly messages?: FormEngineMessages;
  readonly customCatalogs?: Record<string, FormEngineMessages>;
  readonly onMissingKey?: (event: TranslationMissingKeyEvent) => void;
  readonly strict?: boolean;
  readonly translator?: FormEngineTranslator;
  readonly children: ReactNode;
}

export function FormEngineI18nProvider({
  locale = "ja",
  fallbackLocale = "en",
  messages,
  customCatalogs,
  onMissingKey,
  strict,
  translator: customTranslator,
  children
}: FormEngineI18nProviderProps) {
  const translator = useMemo(() => {
    if (customTranslator !== undefined) return customTranslator;
    return createFormEngineTranslator({
      locale,
      fallbackLocale,
      ...(messages === undefined ? {} : { messages }),
      ...(customCatalogs === undefined ? {} : { customCatalogs }),
      ...(onMissingKey === undefined ? {} : { onMissingKey }),
      ...(strict === undefined ? {} : { strict })
    });
  }, [customCatalogs, customTranslator, fallbackLocale, locale, messages, onMissingKey, strict]);
  const value = useMemo<FormEngineI18nContextValue>(() => ({ uiLocale: locale, translator }), [locale, translator]);
  return (
    <FormEngineI18nProviderScopeContext.Provider value>
      <FormEngineI18nContext.Provider value={value}>{children}</FormEngineI18nContext.Provider>
    </FormEngineI18nProviderScopeContext.Provider>
  );
}

export function useFormEngineI18n(): FormEngineI18nContextValue {
  return useContext(FormEngineI18nContext);
}
