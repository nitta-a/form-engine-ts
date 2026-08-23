import { assertValidFormSchema } from "./schema";
import type { AsyncTranslationAdapter, FormField, FormSchema } from "./types";

export async function resolveFormTranslation(
  schema: FormSchema,
  adapter: AsyncTranslationAdapter,
  targetLocale: string,
  sourceLocale?: string
): Promise<FormSchema> {
  assertValidFormSchema(schema);
  const texts: string[] = [schema.title];
  if (schema.description !== undefined) texts.push(schema.description);
  for (const field of schema.fields) {
    texts.push(field.title);
    if (field.description !== undefined) texts.push(field.description);
    if ("options" in field) texts.push(...field.options.map((option) => option.label));
  }

  const translated = await adapter.translateBatch(texts, targetLocale, sourceLocale);
  if (translated.length !== texts.length) {
    throw new Error(`Translation adapter returned ${translated.length} texts for ${texts.length} inputs.`);
  }
  let index = 0;
  const next = (): string => {
    const value = translated[index];
    index += 1;
    if (value === undefined) throw new Error("Translation adapter returned an incomplete result.");
    return value;
  };

  const title = next();
  const description = schema.description === undefined ? undefined : next();
  const fields = schema.fields.map((field): FormField => {
    const translatedTitle = next();
    const translatedDescription = field.description === undefined ? undefined : next();
    const base = {
      ...field,
      title: translatedTitle,
      ...(translatedDescription === undefined ? {} : { description: translatedDescription })
    };
    if (!("options" in field)) return base;
    return { ...base, options: field.options.map((option) => ({ ...option, label: next() })) } as FormField;
  });

  const translatedSchema: FormSchema = {
    ...schema,
    title,
    ...(description === undefined ? {} : { description }),
    fields
  };
  assertValidFormSchema(translatedSchema);
  return translatedSchema;
}
