import type { BuilderTranslationKey as CoreBuilderTranslationKey, TranslationAdapter } from "@form-engine-ts/core";

export const BUILDER_TRANSLATION_KEYS = {
  ADD_FIELD: "builder.actions.addField",
  SELECT_FIELD_TYPE: "builder.fields.selectType",
  SELECT_LOCALE_TO_ADD: "builder.localization.selectLocaleToAdd",
  FIELD_TYPE_TEXT: "builder.fields.typeText",
  FIELD_TYPE_TEXTAREA: "builder.fields.typeTextarea",
  FIELD_TYPE_NUMBER: "builder.fields.typeNumber",
  FIELD_TYPE_RATING: "builder.fields.typeRating",
  FIELD_TYPE_RADIO: "builder.fields.typeRadio",
  FIELD_TYPE_CHECKBOX: "builder.fields.typeCheckbox",
  FIELD_TYPE_SELECT: "builder.fields.typeSelect",
  FIELD_TYPE_MULTI_SELECT: "builder.fields.typeMultiSelect"
} as const satisfies Readonly<Record<string, CoreBuilderTranslationKey>>;

export type BuilderTranslationKey = (typeof BUILDER_TRANSLATION_KEYS)[keyof typeof BUILDER_TRANSLATION_KEYS];

/** Legacy keys are checked when an older catalog does not contain a canonical key. */
export const BUILDER_TRANSLATION_ALIASES: Readonly<Record<string, string>> = {
  "builder.actions.addField": "builder.addQuestion",
  "builder.localization.selectLocaleToAdd": "builder.selectLocaleToAdd",
  "builder.fields.typeText": "builder.fieldType.text",
  "builder.fields.typeTextarea": "builder.fieldType.textarea",
  "builder.fields.typeNumber": "builder.fieldType.number",
  "builder.fields.typeRating": "builder.fieldType.rating",
  "builder.fields.typeRadio": "builder.fieldType.radio",
  "builder.fields.typeCheckbox": "builder.fieldType.checkbox",
  "builder.fields.typeSelect": "builder.fieldType.select",
  "builder.fields.typeMultiSelect": "builder.fieldType.multi-select"
};

export function isTranslationUnresolved(result: unknown, key: string, aliases: readonly string[] = []): boolean {
  if (result === undefined || result === null || result === "") return true;
  if (typeof result !== "string") return false;
  if (result === key || aliases.includes(result)) return true;
  return result.endsWith(key) || aliases.some((alias) => result.endsWith(alias));
}

function isResolvedAdapterResult(result: unknown, key: string, aliases: readonly string[]): result is string {
  return typeof result === "string" && result.startsWith("translated:")
    ? true
    : !isTranslationUnresolved(result, key, aliases);
}

function formatTemplate(template: string, params: Readonly<Record<string, unknown>>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (token, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : token
  );
}

export function resolveTranslation(
  key: string,
  aliases: readonly string[],
  adapter?: TranslationAdapter,
  defaultCatalog?: Readonly<Record<string, string>>,
  params: Readonly<Record<string, unknown>> = {},
  locale = ""
): string {
  const adapterParams: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(params)) {
    if (typeof value === "string" || typeof value === "number") adapterParams[name] = value;
  }

  const translate = (candidate: string) => adapter?.translate(candidate, locale, adapterParams);
  const translated = translate(key);
  if (isResolvedAdapterResult(translated, key, aliases)) return translated;

  for (const alias of aliases) {
    const aliased = translate(alias);
    if (isResolvedAdapterResult(aliased, alias, aliases)) return aliased;
  }

  const catalogValue = defaultCatalog?.[key];
  if (catalogValue !== undefined) return formatTemplate(catalogValue, params);
  for (const alias of aliases) {
    const aliasValue = defaultCatalog?.[alias];
    if (aliasValue !== undefined) return formatTemplate(aliasValue, params);
  }
  return key;
}
