import type { FieldTypeDefinition } from "./types";

export const DEFAULT_FIELD_TYPE_DEFINITIONS: readonly FieldTypeDefinition[] = [
  {
    type: "text",
    labelKey: "builder.fields.typeText",
    defaultLabel: "一行テキスト",
    category: "text",
    hasOptions: false
  },
  {
    type: "textarea",
    labelKey: "builder.fields.typeTextarea",
    defaultLabel: "長文テキスト",
    category: "text",
    hasOptions: false
  },
  {
    type: "number",
    labelKey: "builder.fields.typeNumber",
    defaultLabel: "数値",
    category: "number",
    hasOptions: false
  },
  {
    type: "rating",
    labelKey: "builder.fields.typeRating",
    defaultLabel: "評価",
    category: "number",
    hasOptions: false
  },
  {
    type: "date",
    labelKey: "builder.fields.typeDate",
    defaultLabel: "日付",
    category: "text",
    hasOptions: false
  },
  {
    type: "time",
    labelKey: "builder.fields.typeTime",
    defaultLabel: "時刻",
    category: "text",
    hasOptions: false
  },
  {
    type: "email",
    labelKey: "builder.fields.typeEmail",
    defaultLabel: "メールアドレス",
    category: "text",
    hasOptions: false
  },
  {
    type: "tel",
    labelKey: "builder.fields.typeTel",
    defaultLabel: "電話番号",
    category: "text",
    hasOptions: false
  },
  {
    type: "url",
    labelKey: "builder.fields.typeUrl",
    defaultLabel: "URL",
    category: "text",
    hasOptions: false
  },
  {
    type: "radio",
    labelKey: "builder.fields.typeRadio",
    defaultLabel: "単一選択 (ラジオボタン)",
    category: "choice",
    hasOptions: true
  },
  {
    type: "checkbox",
    labelKey: "builder.fields.typeCheckbox",
    defaultLabel: "チェックボックス",
    category: "choice",
    hasOptions: false
  },
  {
    type: "select",
    labelKey: "builder.fields.typeSelect",
    defaultLabel: "ドロップダウン",
    category: "choice",
    hasOptions: true
  },
  {
    type: "multi-select",
    labelKey: "builder.fields.typeMultiSelect",
    defaultLabel: "複数選択",
    category: "choice",
    hasOptions: true
  }
];
