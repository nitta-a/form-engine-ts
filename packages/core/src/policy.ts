import type { FormSchema } from "./types";

export interface CollectedLocales {
  readonly defaultLocale?: string;
  readonly supportedLocales: readonly string[];
  readonly translationLocales: ReadonlySet<string>;
  readonly allUniqueLocales: ReadonlySet<string>;
  /** Every translation or translation-metadata locale and the schema paths where it occurs. */
  readonly translationLocalePaths: ReadonlyMap<string, readonly string[]>;
}

function collectRecordKeys(
  value: Readonly<Record<string, unknown>> | undefined,
  path: string,
  pathsByLocale: Map<string, string[]>
): void {
  for (const locale of Object.keys(value ?? {})) {
    const paths = pathsByLocale.get(locale) ?? [];
    paths.push(`${path}.${locale}`);
    pathsByLocale.set(locale, paths);
  }
}

/** Collects locale registrations and every locale key used by translations or translation metadata. */
export function collectSchemaLocales(schema: FormSchema): CollectedLocales {
  const pathsByLocale = new Map<string, string[]>();
  collectRecordKeys(schema.translations, "translations", pathsByLocale);
  collectRecordKeys(schema.translationMetadata, "translationMetadata", pathsByLocale);

  schema.fields.forEach((field, fieldIndex) => {
    collectRecordKeys(field.translations, `fields[${fieldIndex}].translations`, pathsByLocale);
    collectRecordKeys(field.translationMetadata, `fields[${fieldIndex}].translationMetadata`, pathsByLocale);
    if (!("options" in field)) return;
    field.options.forEach((option, optionIndex) => {
      collectRecordKeys(
        option.translations,
        `fields[${fieldIndex}].options[${optionIndex}].translations`,
        pathsByLocale
      );
      collectRecordKeys(
        option.translationMetadata,
        `fields[${fieldIndex}].options[${optionIndex}].translationMetadata`,
        pathsByLocale
      );
    });
  });

  schema.pages?.forEach((page, pageIndex) => {
    collectRecordKeys(page.translations, `pages[${pageIndex}].translations`, pathsByLocale);
    collectRecordKeys(page.translationMetadata, `pages[${pageIndex}].translationMetadata`, pathsByLocale);
  });

  const translationLocales = new Set(pathsByLocale.keys());
  const allUniqueLocales = new Set([
    ...(schema.defaultLocale === undefined ? [] : [schema.defaultLocale]),
    ...(schema.supportedLocales ?? []),
    ...translationLocales
  ]);
  return {
    ...(schema.defaultLocale === undefined ? {} : { defaultLocale: schema.defaultLocale }),
    supportedLocales: schema.supportedLocales ?? [],
    translationLocales,
    allUniqueLocales,
    translationLocalePaths: pathsByLocale
  };
}
