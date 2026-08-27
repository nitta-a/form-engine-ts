# v3 to v4 migration guide

See the repository-level [v3 to v4 migration guide](../../MIGRATION_V3_TO_V4.md) for the complete migration notes.

The Core-specific changes are:

- `TranslationAdapter.translate` may return `string`, `undefined`, or `null`; unresolved keys should return
  `undefined` so aliases and default catalogs can be attempted.
- `FormPolicy.fieldConstraints` supplies field-type defaults and validation constraints.
- `sanitizeSchema(schema, { policy })` applies fixed field values and clamps configured maximum text lengths.

The canonical builder key mapping is:

| v3 | v4 |
| --- | --- |
| `builder.fieldType.text` | `builder.fields.typeText` |
| `builder.fieldType.textarea` | `builder.fields.typeTextarea` |
| `builder.fieldType.number` | `builder.fields.typeNumber` |
| `builder.fieldType.rating` | `builder.fields.typeRating` |
| `builder.fieldType.radio` | `builder.fields.typeRadio` |
| `builder.fieldType.checkbox` | `builder.fields.typeCheckbox` |
| `builder.fieldType.select` | `builder.fields.typeSelect` |
| `builder.fieldType.multi-select` | `builder.fields.typeMultiSelect` |
