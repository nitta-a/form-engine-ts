import { normalizeLocale } from "./locale";
import { collectSchemaLocales } from "./policy";
import { assertValidFormSchema } from "./schema";
import type {
  AsyncTranslationAdapter,
  ExtensibleNode,
  FormField,
  FormPage,
  FormPolicy,
  FormSchema,
  JsonValue,
  SchemaTranslations,
  TranslationAdapter
} from "./types";

export { normalizeLocale } from "./locale";

export interface TranslationProviderError {
  readonly code: "RATE_LIMIT" | "AUTH_FAILED" | "UNSUPPORTED_LANGUAGE" | "NETWORK_ERROR" | "UNKNOWN";
  readonly message: string;
  readonly retryable: boolean;
  readonly rawError?: unknown;
}

export interface TranslationSlot {
  readonly kind: "form" | "page" | "field" | "option";
  readonly nodeId: string;
  readonly property: "title" | "description" | "label" | "completionMessage";
  readonly locale: string;
  readonly sourceText: string;
  readonly existingText?: string;
  readonly nodeMetadata?: Readonly<Record<string, JsonValue>>;
  readonly existingTranslationMetadata?: Readonly<Record<string, JsonValue>>;
  /** Canonical target information for workspace clients. */
  readonly target?: {
    readonly kind: "form" | "page" | "field" | "option";
    readonly id?: string;
    readonly property: "title" | "description" | "label" | "completionMessage";
  };
  readonly path?: string;
  readonly sourceTextHash?: string;
  readonly status?: TranslationStatus;
  /** @deprecated Use nodeMetadata instead. */
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export type TranslationStatus = "missing" | "translated" | "stale" | "manual" | "manual-stale";

export interface CanonicalTranslationMetadata {
  readonly sourceLocale: string;
  readonly sourceTextHash: string;
  readonly translationSource: "automatic" | "manual";
  readonly translatedAt?: string;
  readonly editedAt?: string;
}

export interface LegacyTranslationMetadata {
  readonly isManuallyEdited?: boolean;
  readonly translationSource?: "MANUAL" | "AUTOMATIC" | "manual" | "automatic" | string;
  readonly sourceTextHash?: string;
  readonly sourceText?: string;
  readonly sourceLocale?: string;
  readonly translatedAt?: string;
  readonly editedAt?: string;
  readonly isManual?: boolean;
  readonly [key: string]: unknown;
}

export interface TranslationMigrationContext {
  /** Target locale code, for example "en" or "zh-Hans". */
  readonly locale: string;
  /** The schema's default locale. */
  readonly defaultLocale: string;
  /** JSON path of the translated property. */
  readonly path: string;
  /** Translated property name. */
  readonly property: "title" | "description" | "label" | "completionMessage";
  /** Kind of node that owns the translated property. */
  readonly nodeKind: "form" | "page" | "field" | "option";
  /** Identifier of the owning node. */
  readonly nodeId?: string;
  /** Identifier of the parent node, used for options. */
  readonly parentId?: string;
}

export type TranslationMetadataMigrator = (
  oldMeta: unknown,
  sourceText: string,
  context: TranslationMigrationContext
) => CanonicalTranslationMetadata;

export interface MigrateSchemaTranslationMetadataOptions {
  /** Custom migration function used instead of the built-in legacy normalizer. */
  readonly migrator?: TranslationMetadataMigrator;
}

export const isManualTranslationMetadata = (
  metadata?: LegacyTranslationMetadata | CanonicalTranslationMetadata
): boolean => {
  if (metadata === undefined) return false;
  if (
    ("isManuallyEdited" in metadata && metadata.isManuallyEdited === true) ||
    ("isManual" in metadata && metadata.isManual === true)
  )
    return true;
  return typeof metadata.translationSource === "string" && metadata.translationSource.toLowerCase() === "manual";
};

export interface PopulateTranslationOptions {
  readonly overwrite?: "all" | "missing-only" | "stale-and-missing";
  readonly preserveManualTranslations?: boolean;
  readonly markStaleTranslations?: boolean;
  readonly shouldOverwrite?: (slot: TranslationSlot) => boolean;
  readonly createMetadata?: (slot: TranslationSlot, translatedText: string) => Readonly<Record<string, JsonValue>>;
  readonly isManualTranslation?: (
    metadata: unknown,
    context: { readonly path: string; readonly locale: string }
  ) => boolean;
  readonly normalizeMetadata?: (metadata: unknown, sourceText: string) => CanonicalTranslationMetadata;
  /** Applies locale admission and count limits before the adapter is called. */
  readonly policy?: Pick<FormPolicy, "allowedLocales" | "maxLocales">;
  /** Aborts an in-flight translation operation when requested. */
  readonly signal?: AbortSignal;
  /** Reports progress for the slots selected for translation. */
  readonly onProgress?: (progress: TranslationProgress) => void;
  /** Keeps successful slots when individual translation calls fail. */
  readonly continueOnError?: boolean;
}

/** Compatibility alias for clients that used the pluralized options name. */
export type PopulateTranslationsOptions = PopulateTranslationOptions;

export interface TranslationReport {
  readonly updatedSlots: readonly TranslationSlot[];
  readonly skippedSlots: readonly TranslationSlot[];
  readonly staleSlots?: readonly TranslationSlot[];
  readonly skippedReasons?: Readonly<Record<string, "manual" | "unchanged" | "unsupported">>;
  readonly totalSlots?: number;
  readonly attemptedSlots?: number;
  readonly succeeded?: number;
  readonly failed?: number;
  readonly cancelled?: boolean;
  readonly failures?: readonly TranslationFailure[];
}

export interface TranslationProgress {
  readonly total: number;
  readonly completed: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly percentage: number;
}

export interface TranslationFailure {
  readonly slot: TranslationSlot;
  readonly cause: unknown;
}

export const computeSourceTextHash = (text: string): string => {
  const normalized = text.normalize("NFKC").trim().replace(/\s+/gu, " ");
  let hash = 0x811c9dc5;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

export function getTranslationStatus(
  sourceText: string,
  translatedText: string | undefined,
  metadata: CanonicalTranslationMetadata | Readonly<Record<string, JsonValue>> | undefined
): TranslationStatus {
  return getTranslationStatusWithManualOverride(sourceText, translatedText, metadata, undefined);
}

function getTranslationStatusWithManualOverride(
  sourceText: string,
  translatedText: string | undefined,
  metadata: CanonicalTranslationMetadata | LegacyTranslationMetadata | Readonly<Record<string, JsonValue>> | undefined,
  manualOverride: boolean | undefined
): TranslationStatus {
  if (translatedText === undefined || translatedText.trim() === "") return "missing";
  if (metadata === undefined) return "translated";
  const currentHash = computeSourceTextHash(sourceText);
  const sourceHash = typeof metadata.sourceTextHash === "string" ? metadata.sourceTextHash : undefined;
  const isManual = manualOverride ?? isManualTranslationMetadata(metadata);
  if (isManual) return sourceHash === undefined || sourceHash === currentHash ? "manual" : "manual-stale";
  return sourceHash === undefined || sourceHash === currentHash ? "translated" : "stale";
}

interface SlotDescriptor {
  readonly slot: TranslationSlot;
  readonly manual: boolean;
  readonly apply: (
    schema: FormSchema,
    translatedText: string,
    metadata: Readonly<Record<string, JsonValue>> | undefined
  ) => FormSchema;
}

type TranslationProvider = AsyncTranslationAdapter | TranslationAdapter;

async function translateBatch(
  adapter: TranslationProvider,
  texts: readonly string[],
  locale: string,
  sourceLocale: string | undefined,
  signal?: AbortSignal
): Promise<readonly string[]> {
  if ("translateBatch" in adapter) {
    if (signal === undefined) return adapter.translateBatch(texts, locale, sourceLocale);
    return adapter.translateBatch(texts, locale, sourceLocale, signal);
  }
  return texts.map(
    (text) => adapter.translate(text, locale, sourceLocale === undefined ? undefined : { sourceLocale }) ?? text
  );
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw signal.reason ?? new DOMException("The translation was cancelled.", "AbortError");
}

type LocalizedProperty = "title" | "description" | "completionMessage";

function mergeLocalizedText(
  translations: SchemaTranslations | undefined,
  locale: string,
  property: LocalizedProperty,
  value: string
): SchemaTranslations {
  return { ...translations, [locale]: { ...translations?.[locale], [property]: value } };
}

function withTranslationMetadata<T extends ExtensibleNode>(
  node: T,
  locale: string,
  property: TranslationSlot["property"],
  metadata: Readonly<Record<string, JsonValue>> | undefined
): T {
  if (metadata === undefined) return node;
  return {
    ...node,
    translationMetadata: {
      ...node.translationMetadata,
      [locale]: {
        ...node.translationMetadata?.[locale],
        [property]: metadata
      }
    }
  };
}

interface TranslationSlotOptions {
  readonly isManualTranslation?: PopulateTranslationOptions["isManualTranslation"];
  readonly normalizeMetadata?: PopulateTranslationOptions["normalizeMetadata"];
}

function localeRecordEntry<T>(record: Readonly<Record<string, T>> | undefined, locale: string): T | undefined {
  const normalizedLocale = normalizeLocale(locale) ?? locale;
  for (const [candidate, value] of Object.entries(record ?? {})) {
    if ((normalizeLocale(candidate) ?? candidate) === normalizedLocale) return value;
  }
  return undefined;
}

function createSlot(
  kind: TranslationSlot["kind"],
  nodeId: string,
  property: TranslationSlot["property"],
  locale: string,
  sourceText: string,
  existingText: string | undefined,
  nodeMetadata: Readonly<Record<string, JsonValue>> | undefined,
  existingTranslationMetadata: Readonly<Record<string, JsonValue>> | undefined,
  options: TranslationSlotOptions = {},
  parentId?: string
): TranslationSlot {
  const path =
    kind === "form"
      ? `form.${property}`
      : kind === "option"
        ? `fields.${parentId ?? ""}.options.${nodeId}.${property}`
        : `${kind}s.${nodeId}.${property}`;
  const manual =
    options.isManualTranslation?.(existingTranslationMetadata, { path, locale }) ??
    isManualTranslationMetadata(existingTranslationMetadata);
  const normalizedMetadata: Readonly<Record<string, JsonValue>> | undefined =
    existingTranslationMetadata === undefined
      ? undefined
      : options.normalizeMetadata === undefined
        ? existingTranslationMetadata
        : { ...options.normalizeMetadata(existingTranslationMetadata, sourceText) };
  const status = getTranslationStatusWithManualOverride(sourceText, existingText, normalizedMetadata, manual);
  return {
    kind,
    nodeId,
    property,
    locale,
    sourceText,
    target: { kind, ...(nodeId.length === 0 ? {} : { id: nodeId }), property },
    path,
    sourceTextHash: computeSourceTextHash(sourceText),
    status,
    ...(existingText === undefined ? {} : { existingText }),
    ...(nodeMetadata === undefined ? {} : { nodeMetadata, metadata: nodeMetadata }),
    ...(normalizedMetadata === undefined ? {} : { existingTranslationMetadata: normalizedMetadata })
  };
}

function translationSlots(
  schema: FormSchema,
  locale: string,
  options: TranslationSlotOptions = {}
): readonly SlotDescriptor[] {
  locale = normalizeLocale(locale) ?? locale;
  const descriptors: SlotDescriptor[] = [];
  const schemaTranslation = localeRecordEntry(schema.translations, locale);
  const schemaTranslationMetadata = localeRecordEntry(schema.translationMetadata, locale);
  const addFormSlot = (property: LocalizedProperty, sourceText: string) => {
    const slot = createSlot(
      "form",
      schema.id,
      property,
      locale,
      sourceText,
      schemaTranslation?.[property],
      schema.metadata,
      schemaTranslationMetadata?.[property],
      options
    );
    descriptors.push({
      slot,
      manual:
        options.isManualTranslation?.(schemaTranslationMetadata?.[property], {
          path: slot.path ?? "",
          locale
        }) ?? isManualTranslationMetadata(schemaTranslationMetadata?.[property]),
      apply: (current, value, metadata) =>
        withTranslationMetadata(
          { ...current, translations: mergeLocalizedText(current.translations, locale, property, value) },
          locale,
          property,
          metadata
        )
    });
  };
  addFormSlot("title", schema.title);
  if (schema.description !== undefined) addFormSlot("description", schema.description);
  if (schema.completionMessage !== undefined) addFormSlot("completionMessage", schema.completionMessage);

  schema.fields.forEach((field, fieldIndex) => {
    const fieldTranslation = localeRecordEntry(field.translations, locale);
    const fieldTranslationMetadata = localeRecordEntry(field.translationMetadata, locale);
    const addFieldSlot = (property: "title" | "description", sourceText: string) => {
      const slot = createSlot(
        "field",
        field.id,
        property,
        locale,
        sourceText,
        fieldTranslation?.[property],
        field.metadata,
        fieldTranslationMetadata?.[property],
        options
      );
      descriptors.push({
        slot,
        manual:
          options.isManualTranslation?.(fieldTranslationMetadata?.[property], {
            path: slot.path ?? "",
            locale
          }) ?? isManualTranslationMetadata(fieldTranslationMetadata?.[property]),
        apply: (current, value, metadata) => ({
          ...current,
          fields: current.fields.map((candidate, index) =>
            index === fieldIndex
              ? withTranslationMetadata(
                  {
                    ...candidate,
                    translations: mergeLocalizedText(candidate.translations, locale, property, value)
                  } as FormField,
                  locale,
                  property,
                  metadata
                )
              : candidate
          )
        })
      });
    };
    addFieldSlot("title", field.title);
    if (field.description !== undefined) addFieldSlot("description", field.description);

    if ("options" in field) {
      field.options.forEach((option, optionIndex) => {
        const optionTranslation = localeRecordEntry(option.translations, locale);
        const optionTranslationMetadata = localeRecordEntry(option.translationMetadata, locale);
        const slot = createSlot(
          "option",
          option.id,
          "label",
          locale,
          option.label,
          optionTranslation,
          option.metadata,
          optionTranslationMetadata?.label,
          options,
          field.id
        );
        descriptors.push({
          slot,
          manual:
            options.isManualTranslation?.(optionTranslationMetadata?.label, {
              path: slot.path ?? "",
              locale
            }) ?? isManualTranslationMetadata(optionTranslationMetadata?.label),
          apply: (current, value, metadata) => ({
            ...current,
            fields: current.fields.map((candidate, candidateIndex) => {
              if (candidateIndex !== fieldIndex || !("options" in candidate)) return candidate;
              return {
                ...candidate,
                options: candidate.options.map((candidateOption, candidateOptionIndex) =>
                  candidateOptionIndex === optionIndex
                    ? withTranslationMetadata(
                        {
                          ...candidateOption,
                          translations: { ...candidateOption.translations, [locale]: value }
                        },
                        locale,
                        "label",
                        metadata
                      )
                    : candidateOption
                )
              } as FormField;
            })
          })
        });
      });
    }
  });

  schema.pages?.forEach((page, pageIndex) => {
    const pageTranslation = localeRecordEntry(page.translations, locale);
    const pageTranslationMetadata = localeRecordEntry(page.translationMetadata, locale);
    const addPageSlot = (property: "title" | "description", sourceText: string) => {
      const slot = createSlot(
        "page",
        page.id,
        property,
        locale,
        sourceText,
        pageTranslation?.[property],
        page.metadata,
        pageTranslationMetadata?.[property],
        options
      );
      descriptors.push({
        slot,
        manual:
          options.isManualTranslation?.(pageTranslationMetadata?.[property], {
            path: slot.path ?? "",
            locale
          }) ?? isManualTranslationMetadata(pageTranslationMetadata?.[property]),
        apply: (current, value, metadata) => ({
          ...current,
          ...(current.pages === undefined
            ? {}
            : {
                pages: current.pages.map((candidate, index) =>
                  index === pageIndex
                    ? withTranslationMetadata(
                        {
                          ...candidate,
                          translations: mergeLocalizedText(candidate.translations, locale, property, value)
                        },
                        locale,
                        property,
                        metadata
                      )
                    : candidate
                )
              })
        })
      });
    };
    if (page.title !== undefined) addPageSlot("title", page.title);
    if (page.description !== undefined) addPageSlot("description", page.description);
  });
  return descriptors;
}

function removeLocaleRecord<T>(
  record: Readonly<Record<string, T>> | undefined,
  locale: string
): Readonly<Record<string, T>> | undefined {
  if (record === undefined) return undefined;
  const remaining = Object.entries(record).filter(([candidate]) => candidate !== locale);
  return remaining.length === 0 ? undefined : Object.fromEntries(remaining);
}

function removeLocalizedNodeLocale<T extends ExtensibleNode & { readonly translations?: SchemaTranslations }>(
  node: T,
  locale: string
): T {
  const translations = removeLocaleRecord(node.translations, locale);
  const translationMetadata = removeLocaleRecord(node.translationMetadata, locale);
  const { translations: _translations, translationMetadata: _translationMetadata, ...base } = node;
  return {
    ...base,
    ...(translations === undefined ? {} : { translations }),
    ...(translationMetadata === undefined ? {} : { translationMetadata })
  } as T;
}

function defaultTranslationMetadataMigrator(
  metadata: unknown,
  sourceText: string,
  defaultLocale: string
): CanonicalTranslationMetadata {
  const record =
    metadata !== null && typeof metadata === "object" ? (metadata as Readonly<Record<string, unknown>>) : undefined;
  const sourceLocale = typeof record?.sourceLocale === "string" ? record.sourceLocale : defaultLocale;
  const translationSource = isManualTranslationMetadata(record) ? "manual" : "automatic";
  const canonicalKeys = new Set([
    "sourceLocale",
    "sourceTextHash",
    "translationSource",
    "translatedAt",
    "editedAt",
    "isManuallyEdited",
    "isManual",
    "sourceText"
  ]);
  const extensions = Object.fromEntries(
    Object.entries(record ?? {}).filter(
      ([key, value]) => key !== "isManual" && !canonicalKeys.has(key) && isJsonValue(value)
    )
  );
  return {
    ...extensions,
    sourceLocale,
    sourceTextHash: computeSourceTextHash(sourceText),
    translationSource,
    ...(typeof record?.translatedAt === "string" ? { translatedAt: record.translatedAt } : {}),
    ...(typeof record?.editedAt === "string" ? { editedAt: record.editedAt } : {})
  };
}

/** Normalizes canonical and legacy translation metadata for application-owned text codecs. */
export function normalizeTranslationMetadata(
  metadata: unknown,
  sourceText: string,
  defaultLocale = ""
): CanonicalTranslationMetadata {
  return defaultTranslationMetadataMigrator(metadata, sourceText, defaultLocale);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value !== "object") return false;
  return Object.values(value).every(isJsonValue);
}

function migrateMetadata(
  metadata: unknown,
  sourceText: string,
  context: TranslationMigrationContext,
  migrator: TranslationMetadataMigrator
): CanonicalTranslationMetadata {
  return migrator(metadata, sourceText, context);
}

type TranslationMetadataProperty = TranslationMigrationContext["property"];

function isTranslationMetadataProperty(property: string): property is TranslationMetadataProperty {
  return property === "title" || property === "description" || property === "label" || property === "completionMessage";
}

function migrateNodeMetadata<T extends ExtensibleNode>(
  node: T,
  sourceTexts: Readonly<Record<string, string>>,
  contextFor: (locale: string, property: TranslationMetadataProperty) => TranslationMigrationContext,
  migrator: TranslationMetadataMigrator
): T {
  if (node.translationMetadata === undefined) return node;
  const translationMetadata = Object.fromEntries(
    Object.entries(node.translationMetadata).map(([locale, properties]) => [
      locale,
      Object.fromEntries(
        Object.entries(properties).map(([property, metadata]) => {
          if (!isTranslationMetadataProperty(property)) return [property, metadata];
          return [
            property,
            migrateMetadata(metadata, sourceTexts[property] ?? "", contextFor(locale, property), migrator)
          ];
        })
      )
    ])
  );
  return { ...node, translationMetadata } as T;
}

export const migrateSchemaTranslationMetadata = (
  schema: FormSchema,
  migratorOrOptions?:
    | ((oldMeta: unknown, sourceText: string) => CanonicalTranslationMetadata)
    | TranslationMetadataMigrator
    | MigrateSchemaTranslationMetadataOptions
): FormSchema => {
  const defaultLocale = schema.defaultLocale ?? "";
  const migrator: TranslationMetadataMigrator =
    typeof migratorOrOptions === "function"
      ? migratorOrOptions
      : (migratorOrOptions?.migrator ??
        ((metadata, sourceText, context) =>
          defaultTranslationMetadataMigrator(metadata, sourceText, context.defaultLocale)));
  const migratedSchema = migrateNodeMetadata(
    schema,
    {
      title: schema.title,
      ...(schema.description === undefined ? {} : { description: schema.description }),
      ...(schema.completionMessage === undefined ? {} : { completionMessage: schema.completionMessage })
    },
    (locale, property) => ({
      locale,
      defaultLocale,
      path: `form.${property}`,
      property,
      nodeKind: "form"
    }),
    migrator
  );
  const fields = schema.fields.map((field) => {
    const migratedField = migrateNodeMetadata(
      field,
      { title: field.title, ...(field.description === undefined ? {} : { description: field.description }) },
      (locale, property) => ({
        locale,
        defaultLocale,
        path: `fields.${field.id}.${property}`,
        property,
        nodeKind: "field",
        nodeId: field.id
      }),
      migrator
    );
    if (!("options" in migratedField)) return migratedField;
    return {
      ...migratedField,
      options: migratedField.options.map((option) =>
        migrateNodeMetadata(
          option,
          { label: option.label },
          (locale, property) => ({
            locale,
            defaultLocale,
            path: `fields.${field.id}.options.${option.id}.${property}`,
            property,
            nodeKind: "option",
            nodeId: option.id,
            parentId: field.id
          }),
          migrator
        )
      )
    } as FormField;
  });
  const pages = schema.pages?.map((page) =>
    migrateNodeMetadata(
      page,
      {
        ...(page.title === undefined ? {} : { title: page.title }),
        ...(page.description === undefined ? {} : { description: page.description })
      },
      (locale, property) => ({
        locale,
        defaultLocale,
        path: `pages.${page.id}.${property}`,
        property,
        nodeKind: "page",
        nodeId: page.id
      }),
      migrator
    )
  );
  return {
    ...migratedSchema,
    fields,
    ...(pages === undefined ? {} : { pages })
  };
};

/** Removes a locale registration and every localized value and metadata entry for it. */
export const removeLocaleFromSchema = (schema: FormSchema, localeToRemove: string): FormSchema => {
  const normalizedLocaleToRemove = normalizeLocale(localeToRemove) ?? localeToRemove;
  const normalizedDefaultLocale =
    schema.defaultLocale === undefined ? undefined : (normalizeLocale(schema.defaultLocale) ?? schema.defaultLocale);
  if (normalizedLocaleToRemove === normalizedDefaultLocale) {
    throw new Error(`Cannot remove defaultLocale: ${localeToRemove}`);
  }
  const form = removeLocalizedNodeLocale(schema, normalizedLocaleToRemove);
  const fields = schema.fields.map((field) => {
    const localizedField = removeLocalizedNodeLocale(field, normalizedLocaleToRemove);
    if (!("options" in localizedField)) return localizedField;
    return {
      ...localizedField,
      options: localizedField.options.map((option) => {
        const translations = removeLocaleRecord(option.translations, normalizedLocaleToRemove);
        const translationMetadata = removeLocaleRecord(option.translationMetadata, normalizedLocaleToRemove);
        const { translations: _translations, translationMetadata: _translationMetadata, ...base } = option;
        return {
          ...base,
          ...(translations === undefined ? {} : { translations }),
          ...(translationMetadata === undefined ? {} : { translationMetadata })
        };
      })
    } as FormField;
  });
  const pages = schema.pages?.map((page) => removeLocalizedNodeLocale(page, normalizedLocaleToRemove));
  return {
    ...form,
    supportedLocales: (schema.supportedLocales ?? []).filter(
      (locale) => (normalizeLocale(locale) ?? locale) !== normalizedLocaleToRemove
    ),
    fields,
    ...(pages === undefined ? {} : { pages })
  };
};

export function collectTranslationSlots(schema: FormSchema, locale: string): readonly TranslationSlot[] {
  return translationSlots(schema, locale).map((descriptor) => descriptor.slot);
}

export function resolveLocalizedSchema(schema: FormSchema, targetLocale?: string): FormSchema {
  if (targetLocale === undefined || targetLocale.length === 0) return schema;
  const normalizedTargetLocale = normalizeLocale(targetLocale) ?? targetLocale;
  const defaultLocale = schema.defaultLocale === undefined ? undefined : normalizeLocale(schema.defaultLocale);
  if (normalizedTargetLocale === defaultLocale || targetLocale === schema.defaultLocale) return schema;
  const formTranslation = localeRecordEntry(schema.translations, normalizedTargetLocale);
  const completionMessage = formTranslation?.completionMessage ?? schema.completionMessage;
  return {
    ...schema,
    title: formTranslation?.title ?? schema.title,
    ...((formTranslation?.description ?? schema.description) === undefined
      ? {}
      : { description: formTranslation?.description ?? schema.description }),
    ...(completionMessage === undefined ? {} : { completionMessage }),
    fields: schema.fields.map((field): FormField => {
      const translation = localeRecordEntry(field.translations, normalizedTargetLocale);
      const localized = {
        ...field,
        title: translation?.title ?? field.title,
        ...((translation?.description ?? field.description) === undefined
          ? {}
          : { description: translation?.description ?? field.description })
      };
      if (!("options" in field)) return localized;
      return {
        ...localized,
        options: field.options.map((option) => ({
          ...option,
          label: localeRecordEntry(option.translations, normalizedTargetLocale) ?? option.label
        }))
      } as FormField;
    }),
    ...(schema.pages === undefined
      ? {}
      : {
          pages: schema.pages.map((page): FormPage => {
            const translation = localeRecordEntry(page.translations, normalizedTargetLocale);
            const title = translation?.title ?? page.title;
            const description = translation?.description ?? page.description;
            return {
              ...page,
              ...(title === undefined ? {} : { title }),
              ...(description === undefined ? {} : { description })
            };
          })
        })
  };
}

export function populateSchemaTranslations(
  schema: FormSchema,
  targetLocales: readonly string[],
  adapter: AsyncTranslationAdapter,
  options?: PopulateTranslationOptions
): Promise<{ readonly schema: FormSchema; readonly report: TranslationReport }>;
export function populateSchemaTranslations(
  schema: FormSchema,
  targetLocales: readonly string[],
  adapter: TranslationAdapter,
  options?: PopulateTranslationOptions
): Promise<{ readonly schema: FormSchema; readonly report: TranslationReport }>;
export async function populateSchemaTranslations(
  schema: FormSchema,
  targetLocales: readonly string[],
  adapter: TranslationProvider,
  options: PopulateTranslationOptions = {}
): Promise<{ readonly schema: FormSchema; readonly report: TranslationReport }> {
  assertValidFormSchema(schema);
  const defaultLocale =
    schema.defaultLocale === undefined ? undefined : (normalizeLocale(schema.defaultLocale) ?? schema.defaultLocale);
  const locales = [
    ...new Set(
      targetLocales
        .map((locale) => normalizeLocale(locale) ?? locale.trim())
        .filter((locale) => locale.length > 0 && locale !== defaultLocale)
    )
  ];
  const allowedLocales = options.policy?.allowedLocales?.map((locale) => normalizeLocale(locale) ?? locale);
  const collectedLocales = collectSchemaLocales(schema);
  const disallowedLocale = [...collectedLocales.allUniqueLocales, ...locales].find(
    (locale) => allowedLocales !== undefined && !allowedLocales.includes(locale)
  );
  if (disallowedLocale !== undefined) {
    throw new RangeError(`Translation locale ${disallowedLocale} is not allowed by the form policy.`);
  }
  const projectedLocales = new Set([...collectedLocales.allUniqueLocales, ...locales]);
  if (options.policy?.maxLocales !== undefined && projectedLocales.size > options.policy.maxLocales) {
    throw new RangeError(`At most ${options.policy.maxLocales} locales are allowed by the form policy.`);
  }
  const updatedSlots: TranslationSlot[] = [];
  const skippedSlots: TranslationSlot[] = [];
  const staleSlots: TranslationSlot[] = [];
  const skippedReasons: Record<string, "manual" | "unchanged" | "unsupported"> = {};
  const failures: TranslationFailure[] = [];
  let attemptedSlots = 0;
  let completedSlots = 0;
  let cancelled = false;
  let result = schema;

  for (const locale of locales) {
    const descriptors = translationSlots(schema, locale, options);
    if (options.markStaleTranslations ?? true) {
      for (const descriptor of descriptors) {
        if (descriptor.slot.status === "stale" || descriptor.slot.status === "manual-stale")
          staleSlots.push(descriptor.slot);
      }
    }
    const selected: SlotDescriptor[] = [];
    for (const descriptor of descriptors) {
      const status = descriptor.slot.status ?? "missing";
      const manual = descriptor.manual || status === "manual" || status === "manual-stale";
      const requestedOverwrite = options.shouldOverwrite?.(descriptor.slot);
      const shouldTranslate =
        (options.preserveManualTranslations ?? true) && manual
          ? false
          : (requestedOverwrite ??
            (options.overwrite === "all" ||
              (options.overwrite === "stale-and-missing" || options.overwrite === undefined
                ? status === "missing" ||
                  status === "stale" ||
                  (!(options.preserveManualTranslations ?? true) && status === "manual-stale")
                : status === "missing")));
      if (shouldTranslate) selected.push(descriptor);
      else {
        skippedSlots.push(descriptor.slot);
        skippedReasons[
          descriptor.slot.path ?? `${descriptor.slot.kind}.${descriptor.slot.nodeId}.${descriptor.slot.property}`
        ] = manual ? "manual" : "unchanged";
      }
    }
    if (selected.length === 0) continue;
    attemptedSlots += selected.length;
    const applyTranslation = (descriptor: SlotDescriptor, translatedText: string): void => {
      const metadata =
        options.createMetadata?.(descriptor.slot, translatedText) ??
        ({
          sourceLocale: defaultLocale ?? "",
          sourceTextHash: computeSourceTextHash(descriptor.slot.sourceText),
          translationSource: "automatic",
          translatedAt: new Date().toISOString()
        } satisfies CanonicalTranslationMetadata);
      result = descriptor.apply(result, translatedText, metadata);
      updatedSlots.push(descriptor.slot);
      completedSlots += 1;
      options.onProgress?.({
        total: attemptedSlots,
        completed: completedSlots,
        succeeded: updatedSlots.length,
        failed: failures.length,
        percentage: attemptedSlots === 0 ? 100 : Math.round((completedSlots / attemptedSlots) * 100)
      });
    };
    const recordFailure = (descriptor: SlotDescriptor, cause: unknown): void => {
      failures.push({ slot: descriptor.slot, cause });
      completedSlots += 1;
      options.onProgress?.({
        total: attemptedSlots,
        completed: completedSlots,
        succeeded: updatedSlots.length,
        failed: failures.length,
        percentage: attemptedSlots === 0 ? 100 : Math.round((completedSlots / attemptedSlots) * 100)
      });
    };
    let translated: readonly string[] | undefined;
    try {
      throwIfAborted(options.signal);
      translated = await translateBatch(
        adapter,
        selected.map((descriptor) => descriptor.slot.sourceText),
        locale,
        defaultLocale,
        options.signal
      );
      if (translated.length !== selected.length) {
        throw new Error(`Translation adapter returned ${translated.length} texts for ${selected.length} inputs.`);
      }
    } catch (cause) {
      if (options.continueOnError !== true) throw cause;
      if (options.signal?.aborted || (cause instanceof DOMException && cause.name === "AbortError")) {
        cancelled = true;
        break;
      }
      translated = undefined;
    }
    if (translated !== undefined) {
      selected.forEach((descriptor, index) => {
        const translatedText = translated?.[index];
        if (translatedText === undefined) {
          if (options.continueOnError === true) recordFailure(descriptor, new Error("Unexpected empty translation."));
          else throw new Error("Translation adapter returned an unexpected result.");
          return;
        }
        applyTranslation(descriptor, translatedText);
      });
    } else {
      for (const descriptor of selected) {
        try {
          throwIfAborted(options.signal);
          const translatedText =
            "translateText" in adapter
              ? await adapter.translateText(descriptor.slot.sourceText, locale, defaultLocale, options.signal)
              : (adapter.translate(
                  descriptor.slot.sourceText,
                  locale,
                  defaultLocale === undefined ? undefined : { sourceLocale: defaultLocale }
                ) ?? descriptor.slot.sourceText);
          applyTranslation(descriptor, translatedText);
        } catch (cause) {
          if (options.signal?.aborted || (cause instanceof DOMException && cause.name === "AbortError")) {
            cancelled = true;
            break;
          }
          recordFailure(descriptor, cause);
        }
      }
      if (cancelled) break;
    }
  }

  const supportedLocales = [
    ...new Set([
      ...(defaultLocale === undefined ? [] : [defaultLocale]),
      ...(schema.supportedLocales ?? []).map((locale) => normalizeLocale(locale) ?? locale),
      ...locales
    ])
  ];
  if (supportedLocales.length > 0) result = { ...result, supportedLocales };
  assertValidFormSchema(result);
  return {
    schema: result,
    report: {
      updatedSlots,
      skippedSlots,
      staleSlots,
      skippedReasons,
      totalSlots: attemptedSlots,
      attemptedSlots,
      succeeded: updatedSlots.length,
      failed: failures.length,
      cancelled,
      failures
    }
  };
}

export async function resolveFormTranslation(
  schema: FormSchema,
  adapter: AsyncTranslationAdapter,
  targetLocale: string,
  sourceLocale?: string
): Promise<FormSchema> {
  const populated = await populateSchemaTranslations(
    sourceLocale === undefined ? schema : { ...schema, defaultLocale: sourceLocale },
    [targetLocale],
    adapter,
    { overwrite: "all" }
  );
  return resolveLocalizedSchema(populated.schema, targetLocale);
}
