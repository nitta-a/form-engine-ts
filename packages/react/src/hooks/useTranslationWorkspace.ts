import {
  type AsyncTranslationAdapter,
  collectSchemaLocales,
  collectTranslationSlots,
  computeSourceTextHash,
  type FormField,
  type FormPolicy,
  type FormSchema,
  type JsonValue,
  type PopulateTranslationOptions,
  populateSchemaTranslations,
  removeLocaleFromSchema,
  type TranslationAdapter,
  type TranslationReport,
  type TranslationSlot,
  type TranslationStatus
} from "@form-engine-ts/core";
import { useCallback, useMemo, useState } from "react";

export interface UseTranslationWorkspaceOptions {
  readonly schema: FormSchema;
  readonly onChange?: (schema: FormSchema) => void;
  readonly sourceLocale?: string;
  readonly targetLocale?: string;
  readonly translationAdapter?: TranslationAdapter | AsyncTranslationAdapter;
  readonly readOnly?: boolean;
  readonly policy?: FormPolicy;
  readonly validateLocale?:
    | ((locale: string, currentLocales: readonly string[]) => LocaleValidationResult)
    | CustomLocaleValidator;
}

export interface LocaleValidationContext {
  readonly locale: string;
  readonly defaultLocale: string;
  readonly currentLocales: readonly string[];
  readonly policy?: FormPolicy;
}

export type CustomLocaleValidator = (
  locale: string,
  context: LocaleValidationContext
  // biome-ignore lint/suspicious/noConfusingVoidType: Validators may intentionally return void.
) => LocaleValidationResult | boolean | string | undefined | void;

export interface LocaleValidationResult {
  readonly valid: boolean;
  readonly error?: {
    readonly type:
      | "locale_not_allowed"
      | "max_locales_exceeded"
      | "invalid_locale_format"
      | "locale_already_exists"
      | "custom_validation_failed";
    readonly message: string;
  };
}

export interface TranslationSummary {
  readonly totalSlots: number;
  readonly translatedCount: number;
  readonly missingCount: number;
  readonly staleCount: number;
  readonly manualCount: number;
  readonly completionPercentage: number;
}

export interface UseTranslationWorkspaceResult {
  readonly sourceLocale: string;
  readonly targetLocale: string;
  readonly targetLocales: readonly string[];
  readonly setTargetLocale: (locale: string) => void;
  readonly slots: readonly TranslationSlot[];
  readonly summary: TranslationSummary;
  readonly addLocale: (locale: string) => { readonly success: boolean; readonly error?: string };
  readonly isAddLocaleAllowed: (locale: string) => boolean;
  readonly removeLocale: (locale: string) => void;
  readonly setTranslation: (slot: TranslationSlot, text: string) => void;
  readonly translateAll: (options?: PopulateTranslationOptions) => Promise<TranslationReport>;
  readonly translateSlot: (slot: TranslationSlot) => Promise<void>;
  readonly isTranslating: boolean;
  readonly error?: string;
}

type LocalizedProperty = "title" | "description" | "completionMessage";

function updateTranslationMap(
  translations: FormSchema["translations"],
  locale: string,
  property: LocalizedProperty | "label",
  text: string
): NonNullable<FormSchema["translations"]> {
  if (property === "label") return translations ?? {};
  const current = translations?.[locale];
  const next = { ...current, [property]: text };
  return { ...translations, [locale]: next };
}

function asAsyncAdapter(adapter: TranslationAdapter | AsyncTranslationAdapter): AsyncTranslationAdapter {
  if ("translateBatch" in adapter) return adapter;
  return {
    translateText: async (text, locale, sourceLocale) =>
      adapter.translate(text, locale, sourceLocale === undefined ? undefined : { sourceLocale }) ?? text,
    translateBatch: async (texts, locale, sourceLocale) =>
      texts.map(
        (text) => adapter.translate(text, locale, sourceLocale === undefined ? undefined : { sourceLocale }) ?? text
      )
  };
}

function isValidBcp47Locale(locale: string): boolean {
  const language = locale.split("-")[0];
  if (language === undefined || !/^[a-z]{2,3}$/iu.test(language)) return false;
  try {
    Intl.getCanonicalLocales(locale);
    return true;
  } catch {
    return false;
  }
}

export const validateLocalePipeline = (
  locale: string,
  schema: FormSchema,
  policy?: FormPolicy,
  customValidator?:
    | ((locale: string, currentLocales: readonly string[]) => LocaleValidationResult)
    | CustomLocaleValidator
): LocaleValidationResult => {
  const currentLocales = schema.supportedLocales ?? [];
  const defaultLocale = schema.defaultLocale ?? "";

  if (!isValidBcp47Locale(locale)) {
    return {
      valid: false,
      error: {
        type: "invalid_locale_format",
        message: `Invalid BCP 47 locale format: "${locale}"`
      }
    };
  }

  if (locale === defaultLocale || currentLocales.includes(locale)) {
    return {
      valid: false,
      error: {
        type: "locale_already_exists",
        message: `Locale "${locale}" is already registered.`
      }
    };
  }

  if (policy?.allowedLocales !== undefined && !policy.allowedLocales.includes(locale)) {
    return {
      valid: false,
      error: {
        type: "locale_not_allowed",
        message: `Locale "${locale}" is not allowed by policy.`
      }
    };
  }

  const totalLocalesCount = 1 + currentLocales.length;
  if (policy?.maxLocales !== undefined && totalLocalesCount >= policy.maxLocales) {
    return {
      valid: false,
      error: {
        type: "max_locales_exceeded",
        message: `Cannot add locale: maximum allowed locales limit (${policy.maxLocales}) reached.`
      }
    };
  }

  if (customValidator !== undefined) {
    const customContext =
      policy === undefined
        ? Object.assign([...currentLocales], { locale, defaultLocale, currentLocales })
        : Object.assign([...currentLocales], { locale, defaultLocale, currentLocales, policy });
    const customResult = customValidator(locale, customContext);
    if (customResult === false) {
      return {
        valid: false,
        error: {
          type: "custom_validation_failed",
          message: `Custom validation rejected locale "${locale}".`
        }
      };
    }
    if (typeof customResult === "string") {
      return {
        valid: false,
        error: { type: "custom_validation_failed", message: customResult }
      };
    }
    if (typeof customResult === "object" && customResult !== null && !customResult.valid) return customResult;
  }

  return { valid: true };
};

function workspaceLocaleValidationMessage(validation: LocaleValidationResult): string {
  if (validation.error?.type === "locale_not_allowed") {
    return validation.error.message.replace(" is not allowed by policy.", " is not allowed by the form policy.");
  }
  if (validation.error?.type === "max_locales_exceeded") {
    const maximum = validation.error.message.match(/\((\d+)\)/u)?.[1];
    return maximum === undefined
      ? validation.error.message
      : `At most ${maximum} locales are allowed by the form policy.`;
  }
  return validation.error?.message ?? "Locale is not valid.";
}

function manualMetadata(sourceText: string, sourceLocale: string): Readonly<Record<string, JsonValue>> {
  return {
    sourceLocale,
    sourceTextHash: computeSourceTextHash(sourceText),
    translationSource: "manual",
    editedAt: new Date().toISOString()
  };
}

function setNodeMetadata<T extends { readonly translationMetadata?: FormSchema["translationMetadata"] }>(
  node: T,
  slot: TranslationSlot,
  text: string,
  sourceLocale: string
): T {
  const localeMetadata = node.translationMetadata?.[slot.locale];
  const nextMetadata =
    text.trim().length === 0
      ? Object.fromEntries(Object.entries(localeMetadata ?? {}).filter(([key]) => key !== slot.property))
      : { ...localeMetadata, [slot.property]: manualMetadata(slot.sourceText, sourceLocale) };
  return { ...node, translationMetadata: { ...node.translationMetadata, [slot.locale]: nextMetadata } };
}

function updateSchemaTranslation(
  schema: FormSchema,
  slot: TranslationSlot,
  text: string,
  sourceLocale: string
): FormSchema {
  if (slot.kind === "form") {
    return setNodeMetadata(
      { ...schema, translations: updateTranslationMap(schema.translations, slot.locale, slot.property, text) },
      slot,
      text,
      sourceLocale
    );
  }
  if (slot.kind === "field") {
    return {
      ...schema,
      fields: schema.fields.map((field) => {
        if (field.id !== slot.nodeId) return field;
        const translations = updateTranslationMap(field.translations, slot.locale, slot.property, text);
        return setNodeMetadata({ ...field, translations } as FormField, slot, text, sourceLocale);
      })
    };
  }
  if (slot.kind === "option") {
    return {
      ...schema,
      fields: schema.fields.map((field) => {
        if (!("options" in field)) return field;
        return {
          ...field,
          options: field.options.map((option) => {
            if (option.id !== slot.nodeId) return option;
            const translations =
              text.trim().length === 0
                ? Object.fromEntries(
                    Object.entries(option.translations ?? {}).filter(([locale]) => locale !== slot.locale)
                  )
                : { ...option.translations, [slot.locale]: text };
            return setNodeMetadata({ ...option, translations }, slot, text, sourceLocale);
          })
        } as FormField;
      })
    };
  }
  return {
    ...schema,
    ...(schema.pages === undefined
      ? {}
      : {
          pages: schema.pages.map((page) => {
            if (page.id !== slot.nodeId) return page;
            const translations = updateTranslationMap(page.translations, slot.locale, slot.property, text);
            return setNodeMetadata({ ...page, translations }, slot, text, sourceLocale);
          })
        })
  };
}

export function useTranslationWorkspace({
  schema,
  onChange,
  sourceLocale = schema.defaultLocale ?? "en",
  targetLocale,
  translationAdapter,
  readOnly = false,
  policy,
  validateLocale
}: UseTranslationWorkspaceOptions): UseTranslationWorkspaceResult {
  const [draftSchema, setDraftSchema] = useState(schema);
  const [selectedLocale, setSelectedLocale] = useState(targetLocale ?? "");
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string>();
  const currentSchema = onChange === undefined ? draftSchema : schema;
  const targetLocales = useMemo(() => {
    const locales = collectSchemaLocales(currentSchema).allUniqueLocales;
    return [...new Set([...(currentSchema.supportedLocales ?? []), ...locales])].filter(
      (locale) => locale !== sourceLocale
    );
  }, [currentSchema, sourceLocale]);
  const activeLocale = selectedLocale.length > 0 ? selectedLocale : (targetLocales[0] ?? "");
  const slots = useMemo(
    () => (activeLocale.length === 0 ? [] : collectTranslationSlots(currentSchema, activeLocale)),
    [activeLocale, currentSchema]
  );
  const summary = useMemo<TranslationSummary>(() => {
    const counts: Record<TranslationStatus, number> = {
      missing: 0,
      translated: 0,
      stale: 0,
      manual: 0,
      "manual-stale": 0
    };
    for (const slot of slots) counts[slot.status ?? "missing"] += 1;
    const complete = counts.translated + counts.manual;
    return {
      totalSlots: slots.length,
      translatedCount: complete,
      missingCount: counts.missing,
      staleCount: counts.stale + counts["manual-stale"],
      manualCount: counts.manual + counts["manual-stale"],
      completionPercentage: slots.length === 0 ? 100 : Math.round((complete / slots.length) * 100)
    };
  }, [slots]);
  const commit = useCallback(
    (next: FormSchema): void => {
      setDraftSchema(next);
      onChange?.(next);
    },
    [onChange]
  );
  const setTranslation = useCallback(
    (slot: TranslationSlot, text: string): void => {
      if (readOnly) return;
      commit(updateSchemaTranslation(currentSchema, slot, text, sourceLocale));
    },
    [commit, currentSchema, readOnly, sourceLocale]
  );
  const addLocale = useCallback(
    (locale: string): { readonly success: boolean; readonly error?: string } => {
      if (readOnly) return { success: false, error: "Workspace is read-only." };
      const normalized = locale.trim();
      const validation = validateLocalePipeline(normalized, currentSchema, policy, validateLocale);
      if (!validation.valid) return { success: false, error: workspaceLocaleValidationMessage(validation) };
      commit({
        ...currentSchema,
        supportedLocales: [...new Set([...(currentSchema.supportedLocales ?? []), normalized])]
      });
      setSelectedLocale(normalized);
      return { success: true };
    },
    [commit, currentSchema, policy, readOnly, validateLocale]
  );
  const isAddLocaleAllowed = useCallback(
    (locale: string): boolean => {
      if (readOnly) return false;
      const normalized = locale.trim();
      return validateLocalePipeline(normalized, currentSchema, policy, validateLocale).valid;
    },
    [currentSchema, policy, readOnly, validateLocale]
  );
  const removeLocale = useCallback(
    (locale: string): void => {
      if (readOnly || locale === sourceLocale || locale === currentSchema.defaultLocale) return;
      commit(removeLocaleFromSchema(currentSchema, locale));
      if (activeLocale === locale) setSelectedLocale("");
    },
    [activeLocale, commit, currentSchema, readOnly, sourceLocale]
  );
  const translateAll = useCallback(
    async (options: PopulateTranslationOptions = {}): Promise<TranslationReport> => {
      if (translationAdapter === undefined) throw new Error("A translation adapter is required.");
      if (activeLocale.length === 0) throw new Error("A target locale is required.");
      setIsTranslating(true);
      setError(undefined);
      try {
        const populated = await populateSchemaTranslations(
          currentSchema,
          [activeLocale],
          asAsyncAdapter(translationAdapter),
          {
            overwrite: "stale-and-missing",
            preserveManualTranslations: true,
            ...options
          }
        );
        commit(populated.schema);
        return populated.report;
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        setError(message);
        throw cause;
      } finally {
        setIsTranslating(false);
      }
    },
    [activeLocale, commit, currentSchema, translationAdapter]
  );
  const translateSlot = useCallback(
    async (slot: TranslationSlot): Promise<void> => {
      if (translationAdapter === undefined) throw new Error("A translation adapter is required.");
      if (readOnly) return;
      setIsTranslating(true);
      setError(undefined);
      try {
        const text = await asAsyncAdapter(translationAdapter).translateText(slot.sourceText, slot.locale, sourceLocale);
        commit(updateSchemaTranslation(currentSchema, slot, text, sourceLocale));
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        setError(message);
        throw cause;
      } finally {
        setIsTranslating(false);
      }
    },
    [commit, currentSchema, readOnly, sourceLocale, translationAdapter]
  );
  return {
    sourceLocale,
    targetLocale: activeLocale,
    targetLocales,
    setTargetLocale: setSelectedLocale,
    slots,
    summary,
    addLocale,
    isAddLocaleAllowed,
    removeLocale,
    setTranslation,
    translateAll,
    translateSlot,
    isTranslating,
    ...(error === undefined ? {} : { error })
  };
}
