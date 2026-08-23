import { assertValidFormSchema } from "./schema";
import type { AsyncTranslationAdapter, FormField, FormPage, FormSchema, SchemaTranslations } from "./types";

interface TextSlot {
  readonly text: string;
  readonly apply: (schema: FormSchema, translated: string, locale: string) => FormSchema;
}

function mergeLocalizedText(
  translations: SchemaTranslations | undefined,
  locale: string,
  key: "title" | "description",
  value: string
): SchemaTranslations {
  return { ...translations, [locale]: { ...translations?.[locale], [key]: value } };
}

function translationSlots(schema: FormSchema): readonly TextSlot[] {
  const slots: TextSlot[] = [
    {
      text: schema.title,
      apply: (current, value, locale) => ({
        ...current,
        translations: mergeLocalizedText(current.translations, locale, "title", value)
      })
    }
  ];
  if (schema.description !== undefined) {
    slots.push({
      text: schema.description,
      apply: (current, value, locale) => ({
        ...current,
        translations: mergeLocalizedText(current.translations, locale, "description", value)
      })
    });
  }
  schema.fields.forEach((field, fieldIndex) => {
    slots.push({
      text: field.title,
      apply: (current, value, locale) => ({
        ...current,
        fields: current.fields.map((item, index) =>
          index === fieldIndex
            ? ({ ...item, translations: mergeLocalizedText(item.translations, locale, "title", value) } as FormField)
            : item
        )
      })
    });
    if (field.description !== undefined) {
      slots.push({
        text: field.description,
        apply: (current, value, locale) => ({
          ...current,
          fields: current.fields.map((item, index) =>
            index === fieldIndex
              ? ({
                  ...item,
                  translations: mergeLocalizedText(item.translations, locale, "description", value)
                } as FormField)
              : item
          )
        })
      });
    }
    if ("options" in field) {
      field.options.forEach((option, optionIndex) => {
        slots.push({
          text: option.label,
          apply: (current, value, locale) => ({
            ...current,
            fields: current.fields.map((item, index) => {
              if (index !== fieldIndex || !("options" in item)) return item;
              return {
                ...item,
                options: item.options.map((candidate, candidateIndex) =>
                  candidateIndex === optionIndex
                    ? { ...candidate, translations: { ...candidate.translations, [locale]: value } }
                    : candidate
                )
              } as FormField;
            })
          })
        });
      });
    }
  });
  schema.pages?.forEach((page, pageIndex) => {
    if (page.title !== undefined) {
      slots.push({
        text: page.title,
        apply: (current, value, locale) => ({
          ...current,
          ...(current.pages === undefined
            ? {}
            : {
                pages: current.pages.map((item, index) =>
                  index === pageIndex
                    ? { ...item, translations: mergeLocalizedText(item.translations, locale, "title", value) }
                    : item
                )
              })
        })
      });
    }
    if (page.description !== undefined) {
      slots.push({
        text: page.description,
        apply: (current, value, locale) => ({
          ...current,
          ...(current.pages === undefined
            ? {}
            : {
                pages: current.pages.map((item, index) =>
                  index === pageIndex
                    ? { ...item, translations: mergeLocalizedText(item.translations, locale, "description", value) }
                    : item
                )
              })
        })
      });
    }
  });
  return slots;
}

export function resolveLocalizedSchema(schema: FormSchema, targetLocale: string): FormSchema {
  if (targetLocale.length === 0 || targetLocale === schema.defaultLocale) return schema;
  const formTranslation = schema.translations?.[targetLocale];
  return {
    ...schema,
    title: formTranslation?.title ?? schema.title,
    ...((formTranslation?.description ?? schema.description) === undefined
      ? {}
      : { description: formTranslation?.description ?? schema.description }),
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

export async function populateSchemaTranslations(
  schema: FormSchema,
  targetLocales: readonly string[],
  adapter: AsyncTranslationAdapter
): Promise<FormSchema> {
  assertValidFormSchema(schema);
  const slots = translationSlots(schema);
  const locales = [...new Set(targetLocales.filter((locale) => locale.length > 0 && locale !== schema.defaultLocale))];
  let result: FormSchema = schema;
  for (const locale of locales) {
    const translated = await adapter.translateBatch(
      slots.map((slot) => slot.text),
      locale,
      schema.defaultLocale
    );
    if (translated.length !== slots.length) {
      throw new Error(`Translation adapter returned ${translated.length} texts for ${slots.length} inputs.`);
    }
    translated.forEach((value, index) => {
      const slot = slots[index];
      if (slot === undefined) throw new Error("Translation adapter returned an unexpected result.");
      result = slot.apply(result, value, locale);
    });
  }
  const supportedLocales = [
    ...new Set([
      ...(schema.defaultLocale === undefined ? [] : [schema.defaultLocale]),
      ...(schema.supportedLocales ?? []),
      ...locales
    ])
  ];
  result = supportedLocales.length === 0 ? result : { ...result, supportedLocales };
  assertValidFormSchema(result);
  return result;
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
    adapter
  );
  return resolveLocalizedSchema(populated, targetLocale);
}
