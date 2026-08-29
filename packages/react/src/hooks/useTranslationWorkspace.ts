import {
  type AsyncTranslationAdapter,
  type CanonicalTranslationMetadata,
  collectSchemaLocales,
  collectTranslationSlots,
  computeSourceTextHash,
  type FormField,
  type FormPolicy,
  type FormSchema,
  type JsonValue,
  type LocaleOption,
  normalizeLocale,
  type PopulateTranslationOptions,
  populateSchemaTranslations,
  removeLocaleFromSchema,
  type TranslationAdapter,
  type TranslationProgress,
  type TranslationReport,
  type TranslationSlot,
  type TranslationStatus
} from "@form-engine-ts/core";
import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import type {
  ConfirmRemoveLocaleSlotProps,
  TranslationEventPayload,
  TranslationSlotChangeEvent,
  TranslationWorkspaceSlots
} from "../types";

export interface UseTranslationWorkspaceOptions {
  readonly schema: FormSchema;
  readonly onChange?: (schema: FormSchema) => void;
  readonly sourceLocale?: string;
  readonly targetLocale?: string;
  readonly translationAdapter?: TranslationAdapter | AsyncTranslationAdapter;
  readonly signal?: AbortSignal;
  readonly readOnly?: boolean;
  readonly policy?: FormPolicy;
  readonly availableLocales?: readonly (string | LocaleOption)[];
  readonly onLocaleAdded?: (locale: string) => void;
  readonly onLocaleRemoved?: (locale: string) => void;
  readonly onLocaleChange?: (targetLocale: string) => void;
  readonly beforeRemoveLocale?: (locale: string, context: { readonly slotCount: number }) => Promise<boolean> | boolean;
  readonly confirmRemoveLocale?: (props: ConfirmRemoveLocaleSlotProps) => ReactNode;
  readonly slots?: Pick<TranslationWorkspaceSlots, "confirmRemoveLocale">;
  readonly onTranslationStart?: (params: {
    readonly targetLocale: string;
    readonly mode: "manual" | "automatic";
  }) => void;
  readonly onTranslationSuccess?: (payload: TranslationEventPayload) => void;
  readonly onTranslationReport?: (report: TranslationReport) => void;
  readonly onTranslationError?: (params: {
    readonly targetLocale: string;
    readonly error: TranslationWorkspaceError;
  }) => void;
  readonly onTranslationChange?: (event: TranslationSlotChangeEvent) => void;
  readonly createTranslationMetadata?: (params: {
    readonly slot: TranslationSlot;
    readonly translatedText: string;
    readonly mode: "manual" | "automatic";
  }) => Readonly<Record<string, import("@form-engine-ts/core").JsonValue>>;
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
      | "source_locale"
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

export type TranslationWorkspaceError =
  | { readonly type: "locale_not_allowed"; readonly locale: string }
  | { readonly type: "locale_already_exists"; readonly locale: string }
  | { readonly type: "source_locale"; readonly locale: string }
  | { readonly type: "invalid_locale_format"; readonly locale: string }
  | { readonly type: "max_locales_exceeded"; readonly max: number; readonly current: number }
  | { readonly type: "read_only_mode" }
  | { readonly type: "adapter_not_configured" }
  | { readonly type: "target_locale_missing" }
  | { readonly type: "translation_failed"; readonly message: string; readonly cause?: unknown }
  | { readonly type: "partial_failure"; readonly succeeded: number; readonly failed: number }
  | { readonly type: "cancelled" }
  | { readonly type: "custom_validation_failed"; readonly message: string };

export interface UseTranslationWorkspaceResult {
  readonly sourceLocale: string;
  readonly targetLocale: string;
  readonly targetLocales: readonly string[];
  readonly localeOptions: readonly LocaleOption[];
  readonly setTargetLocale: (locale: string) => void;
  readonly slots: readonly TranslationSlot[];
  readonly summary: TranslationSummary;
  readonly addLocale: (locale: string) => { readonly success: boolean; readonly error?: TranslationWorkspaceError };
  readonly isAddLocaleAllowed: (locale: string) => boolean;
  readonly removeLocale: (locale: string) => boolean | Promise<boolean>;
  readonly removeLocaleConfirmation?: ReactNode;
  readonly setTranslation: (slot: TranslationSlot, text: string) => void;
  readonly translateAll: (options?: PopulateTranslationOptions) => Promise<{
    readonly success: boolean;
    readonly report?: TranslationReport;
    readonly error?: TranslationWorkspaceError;
  }>;
  readonly translateSlot: (
    slot: TranslationSlot,
    options?: { readonly signal?: AbortSignal }
  ) => Promise<{ readonly success: boolean; readonly error?: TranslationWorkspaceError }>;
  readonly cancelTranslation: () => void;
  readonly isTranslating: boolean;
  readonly progress?: TranslationProgress;
  readonly error?: TranslationWorkspaceError;
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

export const validateLocalePipeline = (
  locale: string,
  schema: FormSchema,
  policy?: FormPolicy,
  customValidator?:
    | ((locale: string, currentLocales: readonly string[]) => LocaleValidationResult)
    | CustomLocaleValidator,
  availableLocales?: readonly (string | LocaleOption)[],
  sourceLocale?: string
): LocaleValidationResult => {
  const canonicalLocale = normalizeLocale(locale);

  if (canonicalLocale === null) {
    return {
      valid: false,
      error: {
        type: "invalid_locale_format",
        message: `Invalid BCP 47 locale format: "${locale}"`
      }
    };
  }

  const currentLocales = (schema.supportedLocales ?? []).map((candidate) => normalizeLocale(candidate) ?? candidate);
  const defaultLocale =
    normalizeLocale(sourceLocale ?? schema.defaultLocale ?? "") ?? sourceLocale ?? schema.defaultLocale ?? "";

  if (canonicalLocale === defaultLocale) {
    return {
      valid: false,
      error: {
        type: "source_locale",
        message: `Locale "${canonicalLocale}" is the source locale and cannot be added as a translation.`
      }
    };
  }

  if (currentLocales.includes(canonicalLocale)) {
    return {
      valid: false,
      error: {
        type: "locale_already_exists",
        message: `Locale "${canonicalLocale}" is already registered.`
      }
    };
  }

  if (
    availableLocales !== undefined &&
    !availableLocales.some((candidate) => {
      const value = typeof candidate === "string" ? candidate : candidate.locale;
      return normalizeLocale(value) === canonicalLocale;
    })
  ) {
    return {
      valid: false,
      error: {
        type: "locale_not_allowed",
        message: `Locale "${canonicalLocale}" is not available in the locale catalog.`
      }
    };
  }

  if (
    policy?.allowedLocales !== undefined &&
    !policy.allowedLocales.some((candidate) => normalizeLocale(candidate) === canonicalLocale)
  ) {
    return {
      valid: false,
      error: {
        type: "locale_not_allowed",
        message: `Locale "${canonicalLocale}" is not allowed by policy.`
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
    const context: LocaleValidationContext = {
      locale: canonicalLocale,
      defaultLocale,
      currentLocales: Object.freeze([...currentLocales]),
      ...(policy === undefined ? {} : { policy })
    };
    const customResult = Reflect.apply(customValidator, undefined, [canonicalLocale, context]);
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

function workspaceLocaleValidationError(
  validation: LocaleValidationResult,
  currentLocales: number,
  requestedLocale: string
): TranslationWorkspaceError {
  const error = validation.error;
  if (error === undefined) return { type: "invalid_locale_format", locale: requestedLocale };
  if (error.type === "locale_not_allowed") return { type: "locale_not_allowed", locale: requestedLocale };
  if (error.type === "locale_already_exists") {
    return { type: "locale_already_exists", locale: requestedLocale };
  }
  if (error.type === "source_locale") return { type: "source_locale", locale: requestedLocale };
  if (error.type === "invalid_locale_format") {
    return { type: "invalid_locale_format", locale: requestedLocale };
  }
  if (error.type === "max_locales_exceeded") {
    const max = Number(error.message.match(/\((\d+)\)/u)?.[1] ?? 0);
    return { type: "max_locales_exceeded", max, current: currentLocales };
  }
  return { type: "custom_validation_failed", message: error.message };
}

function translationMetadata(
  sourceText: string,
  sourceLocale: string,
  mode: "manual" | "automatic"
): CanonicalTranslationMetadata {
  return {
    sourceLocale,
    sourceTextHash: computeSourceTextHash(sourceText),
    translationSource: mode,
    ...(mode === "manual" ? { editedAt: new Date().toISOString() } : { translatedAt: new Date().toISOString() })
  };
}

type WorkspaceTranslationMetadata = Readonly<Record<string, JsonValue>> & CanonicalTranslationMetadata;

function createTranslationMetadata(
  slot: TranslationSlot,
  sourceLocale: string,
  translatedText: string,
  mode: "manual" | "automatic",
  factory: UseTranslationWorkspaceOptions["createTranslationMetadata"]
): WorkspaceTranslationMetadata {
  return {
    ...(factory?.({ slot, translatedText, mode }) ?? {}),
    ...translationMetadata(slot.sourceText, sourceLocale, mode)
  };
}

function setNodeMetadata<T extends { readonly translationMetadata?: FormSchema["translationMetadata"] }>(
  node: T,
  slot: TranslationSlot,
  text: string,
  sourceLocale: string,
  mode: "manual" | "automatic",
  metadataOverride?: CanonicalTranslationMetadata
): T {
  const localeMetadata = node.translationMetadata?.[slot.locale];
  const nextMetadata =
    text.trim().length === 0
      ? Object.fromEntries(Object.entries(localeMetadata ?? {}).filter(([key]) => key !== slot.property))
      : {
          ...localeMetadata,
          [slot.property]: metadataOverride ?? translationMetadata(slot.sourceText, sourceLocale, mode)
        };
  return { ...node, translationMetadata: { ...node.translationMetadata, [slot.locale]: nextMetadata } };
}

function updateSchemaTranslation(
  schema: FormSchema,
  slot: TranslationSlot,
  text: string,
  sourceLocale: string,
  mode: "manual" | "automatic" = "manual",
  metadataOverride?: CanonicalTranslationMetadata
): FormSchema {
  if (slot.kind === "form") {
    return setNodeMetadata(
      { ...schema, translations: updateTranslationMap(schema.translations, slot.locale, slot.property, text) },
      slot,
      text,
      sourceLocale,
      mode,
      metadataOverride
    );
  }
  if (slot.kind === "field") {
    return {
      ...schema,
      fields: schema.fields.map((field) => {
        if (field.id !== slot.nodeId) return field;
        const translations = updateTranslationMap(field.translations, slot.locale, slot.property, text);
        return setNodeMetadata(
          { ...field, translations } as FormField,
          slot,
          text,
          sourceLocale,
          mode,
          metadataOverride
        );
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
            return setNodeMetadata({ ...option, translations }, slot, text, sourceLocale, mode, metadataOverride);
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
            return setNodeMetadata({ ...page, translations }, slot, text, sourceLocale, mode, metadataOverride);
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
  signal,
  readOnly = false,
  policy,
  availableLocales,
  onLocaleAdded,
  onLocaleRemoved,
  onLocaleChange,
  beforeRemoveLocale,
  confirmRemoveLocale,
  slots: workspaceSlots,
  onTranslationStart,
  onTranslationSuccess,
  onTranslationReport,
  onTranslationError,
  onTranslationChange,
  validateLocale,
  createTranslationMetadata: metadataFactory
}: UseTranslationWorkspaceOptions): UseTranslationWorkspaceResult {
  const [draftSchema, setDraftSchema] = useState(schema);
  const [selectedLocale, setSelectedLocale] = useState(normalizeLocale(targetLocale ?? "") ?? targetLocale ?? "");
  const [isTranslating, setIsTranslating] = useState(false);
  const [progress, setProgress] = useState<TranslationProgress>();
  const [error, setError] = useState<TranslationWorkspaceError>();
  const [pendingRemoval, setPendingRemoval] = useState<{
    readonly locale: string;
    readonly localeLabel: string;
    readonly translatedSlotsCount: number;
  }>();
  const activeAbortController = useRef<AbortController | undefined>(undefined);
  const pendingRemovalResolver = useRef<((allowed: boolean) => void) | undefined>(undefined);
  const currentSchema = onChange === undefined ? draftSchema : schema;
  const confirmRemoveLocaleRenderer = confirmRemoveLocale ?? workspaceSlots?.confirmRemoveLocale;
  const targetLocales = useMemo(() => {
    const locales = collectSchemaLocales(currentSchema).allUniqueLocales;
    const normalizedSourceLocale = normalizeLocale(sourceLocale) ?? sourceLocale;
    return [
      ...new Set(
        [...(currentSchema.supportedLocales ?? []), ...locales].map((locale) => normalizeLocale(locale) ?? locale)
      )
    ].filter((locale) => locale !== normalizedSourceLocale);
  }, [currentSchema, sourceLocale]);
  const activeLocale = selectedLocale.length > 0 ? selectedLocale : (targetLocales[0] ?? "");
  const localeOptions = useMemo<readonly LocaleOption[]>(() => {
    if (availableLocales === undefined) {
      return targetLocales.map((locale) => ({ locale, label: locale }));
    }
    const targetLocaleSet = new Set(targetLocales);
    const allowedLocales = policy?.allowedLocales?.map((locale) => normalizeLocale(locale) ?? locale);
    const options = new Map<string, LocaleOption>();
    for (const candidate of availableLocales) {
      const option =
        typeof candidate === "string"
          ? { locale: normalizeLocale(candidate) ?? candidate, label: candidate }
          : { ...candidate, locale: normalizeLocale(candidate.locale) ?? candidate.locale };
      const allowed = allowedLocales === undefined || allowedLocales.includes(option.locale);
      if (allowed || targetLocaleSet.has(option.locale)) options.set(option.locale, option);
    }
    for (const locale of targetLocales) {
      if (!options.has(locale)) options.set(locale, { locale, label: locale });
    }
    return [...options.values()];
  }, [availableLocales, policy?.allowedLocales, targetLocales]);
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
      const metadata = createTranslationMetadata(slot, sourceLocale, text, "manual", metadataFactory);
      commit(updateSchemaTranslation(currentSchema, slot, text, sourceLocale, "manual", metadata));
      onTranslationChange?.({
        slot,
        ...(slot.existingText === undefined ? {} : { previousText: slot.existingText }),
        nextText: text,
        mode: "manual",
        metadata
      });
    },
    [commit, currentSchema, metadataFactory, onTranslationChange, readOnly, sourceLocale]
  );
  const addLocale = useCallback(
    (locale: string): { readonly success: boolean; readonly error?: TranslationWorkspaceError } => {
      if (readOnly) {
        const workspaceError: TranslationWorkspaceError = { type: "read_only_mode" };
        setError(workspaceError);
        return { success: false, error: workspaceError };
      }
      const normalized = normalizeLocale(locale);
      if (normalized === null) {
        const workspaceError = workspaceLocaleValidationError(
          validateLocalePipeline(locale, currentSchema, policy, validateLocale, availableLocales, sourceLocale),
          collectSchemaLocales(currentSchema).allUniqueLocales.size,
          locale
        );
        setError(workspaceError);
        return { success: false, error: workspaceError };
      }
      const validation = validateLocalePipeline(
        normalized,
        currentSchema,
        policy,
        validateLocale,
        availableLocales,
        sourceLocale
      );
      if (!validation.valid) {
        const workspaceError = workspaceLocaleValidationError(
          validation,
          collectSchemaLocales(currentSchema).allUniqueLocales.size,
          normalized
        );
        setError(workspaceError);
        return { success: false, error: workspaceError };
      }
      setError(undefined);
      commit({
        ...currentSchema,
        supportedLocales: [...new Set([...(currentSchema.supportedLocales ?? []), normalized])]
      });
      setSelectedLocale(normalized);
      onLocaleAdded?.(normalized);
      return { success: true };
    },
    [availableLocales, commit, currentSchema, onLocaleAdded, policy, readOnly, sourceLocale, validateLocale]
  );
  const isAddLocaleAllowed = useCallback(
    (locale: string): boolean => {
      if (readOnly) return false;
      const normalized = normalizeLocale(locale);
      if (normalized === null) return false;
      return validateLocalePipeline(normalized, currentSchema, policy, validateLocale, availableLocales, sourceLocale)
        .valid;
    },
    [availableLocales, currentSchema, policy, readOnly, sourceLocale, validateLocale]
  );
  const removeLocale = useCallback(
    (locale: string): boolean | Promise<boolean> => {
      const normalized = normalizeLocale(locale) ?? locale;
      const normalizedSourceLocale = normalizeLocale(sourceLocale) ?? sourceLocale;
      const normalizedDefaultLocale =
        currentSchema.defaultLocale === undefined
          ? undefined
          : (normalizeLocale(currentSchema.defaultLocale) ?? currentSchema.defaultLocale);
      if (readOnly || normalized === normalizedSourceLocale || normalized === normalizedDefaultLocale) return false;
      const remove = (): void => {
        commit(removeLocaleFromSchema(currentSchema, normalized));
        if (activeLocale === normalized) setSelectedLocale("");
        onLocaleRemoved?.(normalized);
      };
      const slotCount = collectTranslationSlots(currentSchema, normalized).length;
      const translatedSlotsCount = collectTranslationSlots(currentSchema, normalized).filter(
        (slot) => slot.existingText !== undefined && slot.existingText.trim().length > 0
      ).length;
      const requestConfirmation = (): Promise<boolean> =>
        new Promise((resolve) => {
          pendingRemovalResolver.current = resolve;
          setPendingRemoval({
            locale: normalized,
            localeLabel: localeOptions.find((option) => option.locale === normalized)?.label ?? normalized,
            translatedSlotsCount
          });
        });
      const removeAfterApproval = (): boolean | Promise<boolean> => {
        if (confirmRemoveLocaleRenderer === undefined) {
          remove();
          return true;
        }
        return requestConfirmation();
      };
      if (beforeRemoveLocale === undefined) {
        return removeAfterApproval();
      }
      try {
        const decision = beforeRemoveLocale(normalized, { slotCount });
        if (typeof decision === "boolean") {
          if (!decision) return false;
          return removeAfterApproval();
        }
        return decision.then((allowed) => {
          if (!allowed) return false;
          return removeAfterApproval();
        });
      } catch (cause) {
        const workspaceError: TranslationWorkspaceError = {
          type: "translation_failed",
          message: cause instanceof Error ? cause.message : String(cause),
          cause
        };
        setError(workspaceError);
        return Promise.reject(cause);
      }
    },
    [
      activeLocale,
      beforeRemoveLocale,
      commit,
      confirmRemoveLocaleRenderer,
      currentSchema,
      localeOptions,
      onLocaleRemoved,
      readOnly,
      sourceLocale
    ]
  );
  const confirmPendingRemoval = useCallback((): void => {
    const pending = pendingRemoval;
    const resolve = pendingRemovalResolver.current;
    if (pending === undefined || resolve === undefined) return;
    pendingRemovalResolver.current = undefined;
    setPendingRemoval(undefined);
    commit(removeLocaleFromSchema(currentSchema, pending.locale));
    if (activeLocale === pending.locale) setSelectedLocale("");
    onLocaleRemoved?.(pending.locale);
    resolve(true);
  }, [activeLocale, commit, currentSchema, onLocaleRemoved, pendingRemoval]);
  const cancelPendingRemoval = useCallback((): void => {
    const resolve = pendingRemovalResolver.current;
    if (resolve === undefined) return;
    pendingRemovalResolver.current = undefined;
    setPendingRemoval(undefined);
    resolve(false);
  }, []);
  const removeLocaleConfirmation = useMemo(() => {
    if (confirmRemoveLocaleRenderer === undefined || pendingRemoval === undefined) return null;
    return confirmRemoveLocaleRenderer({
      ...pendingRemoval,
      isOpen: true,
      onConfirm: confirmPendingRemoval,
      onCancel: cancelPendingRemoval
    });
  }, [cancelPendingRemoval, confirmPendingRemoval, confirmRemoveLocaleRenderer, pendingRemoval]);
  const translateAll = useCallback(
    async (
      options: PopulateTranslationOptions = {}
    ): Promise<{
      readonly success: boolean;
      readonly report?: TranslationReport;
      readonly error?: TranslationWorkspaceError;
    }> => {
      if (readOnly) {
        const workspaceError: TranslationWorkspaceError = { type: "read_only_mode" };
        setError(workspaceError);
        return { success: false, error: workspaceError };
      }
      if (translationAdapter === undefined) {
        const workspaceError: TranslationWorkspaceError = { type: "adapter_not_configured" };
        setError(workspaceError);
        return { success: false, error: workspaceError };
      }
      if (activeLocale.length === 0) {
        const workspaceError: TranslationWorkspaceError = { type: "target_locale_missing" };
        setError(workspaceError);
        return { success: false, error: workspaceError };
      }
      const selectedLocaleOption = localeOptions.find(
        (option) => (normalizeLocale(option.locale) ?? option.locale) === activeLocale
      );
      if (selectedLocaleOption?.translatable === false) {
        setError(undefined);
        return {
          success: true,
          report: {
            updatedSlots: [],
            skippedSlots: slots,
            staleSlots: [],
            skippedReasons: Object.fromEntries(
              slots.map((slot) => [slot.path ?? `${slot.kind}.${slot.nodeId}.${slot.property}`, "unsupported"])
            )
          }
        };
      }
      setIsTranslating(true);
      setError(undefined);
      setProgress(undefined);
      onTranslationStart?.({ targetLocale: activeLocale, mode: "automatic" });
      const controller = new AbortController();
      activeAbortController.current = controller;
      const operationSignal = options.signal ?? signal;
      const abortListener = operationSignal === undefined ? undefined : () => controller.abort(operationSignal.reason);
      if (operationSignal?.aborted) controller.abort(operationSignal.reason);
      else if (operationSignal !== undefined && abortListener !== undefined)
        operationSignal.addEventListener("abort", abortListener, { once: true });
      try {
        const populated = await populateSchemaTranslations(
          currentSchema,
          [activeLocale],
          asAsyncAdapter(translationAdapter),
          {
            overwrite: "stale-and-missing",
            preserveManualTranslations: true,
            ...options,
            continueOnError: true,
            signal: controller.signal,
            createMetadata: (slot, translatedText) =>
              options.createMetadata?.(slot, translatedText) ??
              createTranslationMetadata(slot, sourceLocale, translatedText, "automatic", metadataFactory),
            onProgress: (nextProgress) => {
              setProgress(nextProgress);
              options.onProgress?.(nextProgress);
            }
          }
        );
        commit(populated.schema);
        onTranslationReport?.(populated.report);
        const missingSlotsCount = collectTranslationSlots(populated.schema, activeLocale).filter(
          (slot) => slot.status === "missing"
        ).length;
        if (populated.report.cancelled === true) {
          const workspaceError: TranslationWorkspaceError = { type: "cancelled" };
          setError(workspaceError);
          onTranslationError?.({ targetLocale: activeLocale, error: workspaceError });
          return { success: false, report: populated.report, error: workspaceError };
        }
        if ((populated.report.failed ?? 0) > 0) {
          const workspaceError: TranslationWorkspaceError = {
            type: "partial_failure",
            succeeded: populated.report.succeeded ?? populated.report.updatedSlots.length,
            failed: populated.report.failed ?? 0
          };
          setError(workspaceError);
          onTranslationError?.({ targetLocale: activeLocale, error: workspaceError });
          return { success: false, report: populated.report, error: workspaceError };
        }
        onTranslationSuccess?.({
          sourceLocale,
          targetLocale: activeLocale,
          mode: "automatic",
          updatedSlots: populated.report.updatedSlots,
          skippedSlots: populated.report.skippedSlots,
          missingSlotsCount
        });
        return { success: true, report: populated.report };
      } catch (cause) {
        if (controller.signal.aborted || (cause instanceof DOMException && cause.name === "AbortError")) {
          const workspaceError: TranslationWorkspaceError = { type: "cancelled" };
          setError(workspaceError);
          onTranslationError?.({ targetLocale: activeLocale, error: workspaceError });
          return { success: false, error: workspaceError };
        }
        const workspaceError: TranslationWorkspaceError = {
          type: "translation_failed",
          message: cause instanceof Error ? cause.message : String(cause),
          cause
        };
        setError(workspaceError);
        onTranslationError?.({ targetLocale: activeLocale, error: workspaceError });
        return { success: false, error: workspaceError };
      } finally {
        if (operationSignal !== undefined && abortListener !== undefined) {
          const listener = abortListener;
          operationSignal.removeEventListener("abort", listener);
        }
        if (activeAbortController.current === controller) activeAbortController.current = undefined;
        setIsTranslating(false);
      }
    },
    [
      activeLocale,
      commit,
      currentSchema,
      localeOptions,
      onTranslationError,
      onTranslationStart,
      onTranslationSuccess,
      onTranslationReport,
      readOnly,
      slots,
      sourceLocale,
      metadataFactory,
      translationAdapter,
      signal
    ]
  );
  const cancelTranslation = useCallback(() => {
    activeAbortController.current?.abort(new DOMException("The translation was cancelled.", "AbortError"));
  }, []);
  const translateSlot = useCallback(
    async (
      slot: TranslationSlot,
      options: { readonly signal?: AbortSignal } = {}
    ): Promise<{ readonly success: boolean; readonly error?: TranslationWorkspaceError }> => {
      if (translationAdapter === undefined) {
        const workspaceError: TranslationWorkspaceError = { type: "adapter_not_configured" };
        setError(workspaceError);
        return { success: false, error: workspaceError };
      }
      if (readOnly) {
        const workspaceError: TranslationWorkspaceError = { type: "read_only_mode" };
        setError(workspaceError);
        return { success: false, error: workspaceError };
      }
      setIsTranslating(true);
      setError(undefined);
      setProgress({ total: 1, completed: 0, succeeded: 0, failed: 0, percentage: 0 });
      const controller = new AbortController();
      activeAbortController.current = controller;
      const operationSignal = options.signal ?? signal;
      const abortListener = operationSignal === undefined ? undefined : () => controller.abort(operationSignal.reason);
      if (operationSignal?.aborted) controller.abort(operationSignal.reason);
      else if (operationSignal !== undefined && abortListener !== undefined)
        operationSignal.addEventListener("abort", abortListener, { once: true });
      try {
        const text = await asAsyncAdapter(translationAdapter).translateText(
          slot.sourceText,
          slot.locale,
          sourceLocale,
          controller.signal
        );
        const metadata = createTranslationMetadata(slot, sourceLocale, text, "automatic", metadataFactory);
        commit(updateSchemaTranslation(currentSchema, slot, text, sourceLocale, "automatic", metadata));
        onTranslationChange?.({
          slot,
          ...(slot.existingText === undefined ? {} : { previousText: slot.existingText }),
          nextText: text,
          mode: "automatic",
          metadata
        });
        setProgress({ total: 1, completed: 1, succeeded: 1, failed: 0, percentage: 100 });
        return { success: true };
      } catch (cause) {
        if (controller.signal.aborted || (cause instanceof DOMException && cause.name === "AbortError")) {
          const workspaceError: TranslationWorkspaceError = { type: "cancelled" };
          setError(workspaceError);
          onTranslationError?.({ targetLocale: slot.locale, error: workspaceError });
          return { success: false, error: workspaceError };
        }
        const workspaceError: TranslationWorkspaceError = {
          type: "translation_failed",
          message: cause instanceof Error ? cause.message : String(cause),
          cause
        };
        setError(workspaceError);
        onTranslationError?.({ targetLocale: slot.locale, error: workspaceError });
        return { success: false, error: workspaceError };
      } finally {
        if (operationSignal !== undefined && abortListener !== undefined) {
          const listener = abortListener;
          operationSignal.removeEventListener("abort", listener);
        }
        if (activeAbortController.current === controller) activeAbortController.current = undefined;
        setIsTranslating(false);
      }
    },
    [
      commit,
      currentSchema,
      metadataFactory,
      onTranslationChange,
      onTranslationError,
      readOnly,
      signal,
      sourceLocale,
      translationAdapter
    ]
  );
  return {
    sourceLocale,
    targetLocale: activeLocale,
    targetLocales,
    localeOptions,
    setTargetLocale: (locale) => {
      const normalized = normalizeLocale(locale) ?? locale;
      setSelectedLocale(normalized);
      onLocaleChange?.(normalized);
    },
    slots,
    summary,
    addLocale,
    isAddLocaleAllowed,
    removeLocale,
    ...(removeLocaleConfirmation === null ? {} : { removeLocaleConfirmation }),
    setTranslation,
    translateAll,
    translateSlot,
    cancelTranslation,
    isTranslating,
    ...(progress === undefined ? {} : { progress }),
    ...(error === undefined ? {} : { error })
  };
}
