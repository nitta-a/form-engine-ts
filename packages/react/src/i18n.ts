import type { BuilderTranslationKey as CoreBuilderTranslationKey } from "@form-engine-ts/core";

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
