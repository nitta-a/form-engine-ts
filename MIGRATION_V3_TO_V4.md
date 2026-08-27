# v3 to v4 migration guide

This guide summarizes the public API changes when upgrading form-engine-ts from v3 to v4.

## Typed Select options

`SelectComponentProps` and `BuilderSelectOption` are generic in v4. Add the value type when a select carries a
domain-specific value:

```ts
// v3
type Props = SelectComponentProps;
type Option = BuilderSelectOption;

// v4
type Props = SelectComponentProps<"draft" | "published">;
type Option = BuilderSelectOption<"draft" | "published">;
```

When no narrower value type is needed, use `SelectComponentProps<string>` and `BuilderSelectOption<string>`.

## Translation adapters

`TranslationAdapter.translate` now returns `string | undefined | null`. Adapters should return `undefined` when a key
cannot be resolved so the caller can try aliases or its built-in catalog:

```ts
const translator: TranslationAdapter = {
  translate(key, locale, params) {
    if (!i18n.exists(key, { ...params, lng: locale })) return undefined;
    return i18n.t(key, { ...params, lng: locale });
  }
};
```

The official i18next adapter supports nested catalogs with `namespace` and `keyPrefix`:

```ts
const translator = createI18nextTranslationAdapter(i18n, {
  namespace: "common",
  keyPrefix: "formEngine",
  fallbackLocales: ["ja"]
});
```

## MUI adapter context

MUI integrations are context-based in v4. Replace direct per-adapter arguments with a `MuiFormBuilderContext` and
`MuiAdapterOptions` supplied through the MUI provider. This keeps the theme, translator, and builder policy consistent
across all controls.

## Builder field constraints

`FormPolicy.fieldConstraints` can provide defaults and enforce immutable or bounded field properties:

```ts
const policy: FormPolicy = {
  fieldConstraints: {
    rating: { defaultMin: 1, defaultMax: 5, fixedMin: 1, fixedMax: 5 },
    text: { maxMaxLength: 500 }
  }
};
```

Use `validateFormSchema(schema, { policy })` at persistence boundaries and `sanitizeSchema(schema, { policy })` when a
safe corrected copy is desired.

## Translation key names

The builder uses the following canonical keys. The former `builder.fieldType.*` names remain aliases during migration.

| v3 key | v4 key |
| --- | --- |
| `builder.fieldType.text` | `builder.fields.typeText` |
| `builder.fieldType.textarea` | `builder.fields.typeTextarea` |
| `builder.fieldType.number` | `builder.fields.typeNumber` |
| `builder.fieldType.rating` | `builder.fields.typeRating` |
| `builder.fieldType.radio` | `builder.fields.typeRadio` |
| `builder.fieldType.checkbox` | `builder.fields.typeCheckbox` |
| `builder.fieldType.select` | `builder.fields.typeSelect` |
| `builder.fieldType.multi-select` | `builder.fields.typeMultiSelect` |

## MongoDB storage options

The MongoDB adapter keeps the v3 collection-name options and also accepts grouped names and application indexes:

```ts
createMongoDbStorage({
  db,
  collectionNames: { forms: "forms", formResponses: "responses" },
  customIndexes: {
    formResponses: [{ spec: { "metadata.tenantId": 1, submittedAt: -1 } }]
  }
});
```

Run `createIndexes()` after deploying the new configuration.
