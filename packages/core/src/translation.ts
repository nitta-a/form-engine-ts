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

export interface PopulateTranslationOptions {
  readonly overwrite?: "all" | "missing-only" | "stale-and-missing";
  readonly preserveManualTranslations?: boolean;
  readonly markStaleTranslations?: boolean;
  readonly shouldOverwrite?: (slot: TranslationSlot) => boolean;
  readonly createMetadata?: (slot: TranslationSlot, translatedText: string) => Readonly<Record<string, JsonValue>>;
  /** Applies locale admission and count limits before the adapter is called. */
  readonly policy?: Pick<FormPolicy, "allowedLocales" | "maxLocales">;
}

export interface TranslationReport {
  readonly updatedSlots: readonly TranslationSlot[];
  readonly skippedSlots: readonly TranslationSlot[];
  readonly staleSlots?: readonly TranslationSlot[];
  readonly skippedReasons?: Readonly<Record<string, "manual" | "unchanged" | "unsupported">>;
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
  if (translatedText === undefined || translatedText.trim() === "") return "missing";
  if (metadata === undefined) return "translated";
  const currentHash = computeSourceTextHash(sourceText);
  const sourceHash = typeof metadata.sourceTextHash === "string" ? metadata.sourceTextHash : undefined;
  const isManual = metadata.translationSource === "manual" || ("isManual" in metadata && metadata.isManual === true);
  if (isManual) return sourceHash === undefined || sourceHash === currentHash ? "manual" : "manual-stale";
  return sourceHash === undefined || sourceHash === currentHash ? "translated" : "stale";
}

interface SlotDescriptor {
  readonly slot: TranslationSlot;
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
  sourceLocale: string | undefined
): Promise<readonly string[]> {
  if ("translateBatch" in adapter) return adapter.translateBatch(texts, locale, sourceLocale);
  return texts.map(
    (text) => adapter.translate(text, locale, sourceLocale === undefined ? undefined : { sourceLocale }) ?? text
  );
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

function createSlot(
  kind: TranslationSlot["kind"],
  nodeId: string,
  property: TranslationSlot["property"],
  locale: string,
  sourceText: string,
  existingText: string | undefined,
  nodeMetadata: Readonly<Record<string, JsonValue>> | undefined,
  existingTranslationMetadata: Readonly<Record<string, JsonValue>> | undefined
): TranslationSlot {
  const status = getTranslationStatus(sourceText, existingText, existingTranslationMetadata);
  return {
    kind,
    nodeId,
    property,
    locale,
    sourceText,
    target: { kind, ...(nodeId.length === 0 ? {} : { id: nodeId }), property },
    path: `${kind}.${nodeId}.${property}`,
    sourceTextHash: computeSourceTextHash(sourceText),
    status,
    ...(existingText === undefined ? {} : { existingText }),
    ...(nodeMetadata === undefined ? {} : { nodeMetadata, metadata: nodeMetadata }),
    ...(existingTranslationMetadata === undefined ? {} : { existingTranslationMetadata })
  };
}

function translationSlots(schema: FormSchema, locale: string): readonly SlotDescriptor[] {
  const descriptors: SlotDescriptor[] = [];
  const addFormSlot = (property: LocalizedProperty, sourceText: string) => {
    const slot = createSlot(
      "form",
      schema.id,
      property,
      locale,
      sourceText,
      schema.translations?.[locale]?.[property],
      schema.metadata,
      schema.translationMetadata?.[locale]?.[property]
    );
    descriptors.push({
      slot,
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
    const addFieldSlot = (property: "title" | "description", sourceText: string) => {
      const slot = createSlot(
        "field",
        field.id,
        property,
        locale,
        sourceText,
        field.translations?.[locale]?.[property],
        field.metadata,
        field.translationMetadata?.[locale]?.[property]
      );
      descriptors.push({
        slot,
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
        const slot = createSlot(
          "option",
          option.id,
          "label",
          locale,
          option.label,
          option.translations?.[locale],
          option.metadata,
          option.translationMetadata?.[locale]?.label
        );
        descriptors.push({
          slot,
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
    const addPageSlot = (property: "title" | "description", sourceText: string) => {
      const slot = createSlot(
        "page",
        page.id,
        property,
        locale,
        sourceText,
        page.translations?.[locale]?.[property],
        page.metadata,
        page.translationMetadata?.[locale]?.[property]
      );
      descriptors.push({
        slot,
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

export function collectTranslationSlots(schema: FormSchema, locale: string): readonly TranslationSlot[] {
  return translationSlots(schema, locale).map((descriptor) => descriptor.slot);
}

export function resolveLocalizedSchema(schema: FormSchema, targetLocale?: string): FormSchema {
  if (targetLocale === undefined || targetLocale.length === 0 || targetLocale === schema.defaultLocale) return schema;
  const formTranslation = schema.translations?.[targetLocale];
  const completionMessage = formTranslation?.completionMessage ?? schema.completionMessage;
  return {
    ...schema,
    title: formTranslation?.title ?? schema.title,
    ...((formTranslation?.description ?? schema.description) === undefined
      ? {}
      : { description: formTranslation?.description ?? schema.description }),
    ...(completionMessage === undefined ? {} : { completionMessage }),
    fields: schema.fields.map((field): FormField => {
      const translation = field.translations?.[targetLocale];
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
          label: option.translations?.[targetLocale] ?? option.label
        }))
      } as FormField;
    }),
    ...(schema.pages === undefined
      ? {}
      : {
          pages: schema.pages.map((page): FormPage => {
            const translation = page.translations?.[targetLocale];
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
  const locales = [...new Set(targetLocales.filter((locale) => locale.length > 0 && locale !== schema.defaultLocale))];
  const allowedLocales = options.policy?.allowedLocales;
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
  let result = schema;

  for (const locale of locales) {
    const descriptors = translationSlots(schema, locale);
    if (options.markStaleTranslations ?? true) {
      for (const descriptor of descriptors) {
        if (descriptor.slot.status === "stale" || descriptor.slot.status === "manual-stale")
          staleSlots.push(descriptor.slot);
      }
    }
    const selected: SlotDescriptor[] = [];
    for (const descriptor of descriptors) {
      const status = descriptor.slot.status ?? "missing";
      const manual = status === "manual" || status === "manual-stale";
      const shouldTranslate =
        options.shouldOverwrite?.(descriptor.slot) ??
        ((!(options.preserveManualTranslations ?? true) || !manual) &&
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
    const translated = await translateBatch(
      adapter,
      selected.map((descriptor) => descriptor.slot.sourceText),
      locale,
      schema.defaultLocale
    );
    if (translated.length !== selected.length) {
      throw new Error(`Translation adapter returned ${translated.length} texts for ${selected.length} inputs.`);
    }
    selected.forEach((descriptor, index) => {
      const translatedText = translated[index];
      if (translatedText === undefined) throw new Error("Translation adapter returned an unexpected result.");
      const metadata =
        options.createMetadata?.(descriptor.slot, translatedText) ??
        ({
          sourceLocale: schema.defaultLocale ?? "",
          sourceTextHash: computeSourceTextHash(descriptor.slot.sourceText),
          translationSource: "automatic",
          translatedAt: new Date().toISOString()
        } satisfies CanonicalTranslationMetadata);
      result = descriptor.apply(result, translatedText, metadata);
      updatedSlots.push(descriptor.slot);
    });
  }

  const supportedLocales = [
    ...new Set([
      ...(schema.defaultLocale === undefined ? [] : [schema.defaultLocale]),
      ...(schema.supportedLocales ?? []),
      ...locales
    ])
  ];
  if (supportedLocales.length > 0) result = { ...result, supportedLocales };
  assertValidFormSchema(result);
  return { schema: result, report: { updatedSlots, skippedSlots, staleSlots, skippedReasons } };
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
