import type {
  ConditionOperator,
  ConditionValue,
  DisplayCondition,
  FieldOption,
  FieldType,
  FormField,
  FormSchema,
  TranslationAdapter
} from "@form-engine-ts/core";
import { sanitizeSchema } from "@form-engine-ts/core";

const FIELD_TYPES: readonly FieldType[] = [
  "text",
  "textarea",
  "number",
  "rating",
  "select",
  "multi-select",
  "checkbox",
  "radio"
];

const BUILDER_DEFAULTS: Readonly<Record<string, string>> = {
  "builder.formBuilder": "Form builder",
  "builder.moveUp": "Move {{title}} up",
  "builder.moveDown": "Move {{title}} down",
  "builder.delete": "Delete {{title}}",
  "builder.deleteAction": "Delete",
  "builder.questionTitle": "質問文 / Question Title",
  "builder.questionTitlePlaceholder": "Example: Tell us what we could improve",
  "builder.newQuestionTitle": "New question",
  "builder.type": "Type",
  "builder.required": "Required",
  "builder.minimum": "Minimum",
  "builder.maximum": "Maximum",
  "builder.options": "Options",
  "builder.optionLabel": "選択肢 / Option Label {{index}}",
  "builder.optionLabelPlaceholder": "Example: Very satisfied",
  "builder.newOptionLabel": "Option {{index}}",
  "builder.remove": "Remove",
  "builder.addOption": "Add option",
  "builder.displayCondition": "Display condition",
  "builder.alwaysVisible": "Always visible",
  "builder.conditionOperator": "Condition operator",
  "builder.conditionValue": "Condition value",
  "builder.conditionTrue": "true",
  "builder.conditionFalse": "false",
  "builder.addQuestion": "Add question",
  "builder.fieldType.text": "Text",
  "builder.fieldType.textarea": "Textarea",
  "builder.fieldType.number": "Number",
  "builder.fieldType.rating": "Rating",
  "builder.fieldType.select": "Select",
  "builder.fieldType.multi-select": "Multi-select",
  "builder.fieldType.checkbox": "Checkbox",
  "builder.fieldType.radio": "Radio",
  "builder.operator.equals": "equals",
  "builder.operator.not_equals": "does not equal",
  "builder.operator.contains": "contains",
  "builder.operator.not_empty": "is not empty"
};

function interpolate(template: string, params: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (token, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : token
  );
}

function fieldTypeKey(type: FieldType): string {
  return `builder.fieldType.${type}`;
}

function operatorKey(operator: ConditionOperator): string {
  return `builder.operator.${operator}`;
}

function createUniqueId(prefix: "q" | "opt", existingIds: ReadonlySet<string>): string {
  let id: string;
  do {
    id = `${prefix}_${globalThis.crypto.randomUUID().slice(0, 8)}`;
  } while (existingIds.has(id));
  return id;
}

function baseField(field: FormField, type: FieldType) {
  return {
    id: field.id,
    type,
    title: field.title,
    ...(field.description === undefined ? {} : { description: field.description }),
    ...(field.translationKey === undefined ? {} : { translationKey: field.translationKey }),
    required: field.required,
    ...(field.displayCondition === undefined ? {} : { displayCondition: field.displayCondition })
  };
}

function normalizeField(field: FormField, type: FieldType, newOptionLabel: string): FormField {
  const base = baseField(field, type);
  if (type === "text" || type === "textarea") return { ...base, type };
  if (type === "number") return { ...base, type };
  if (type === "rating") return { ...base, type, min: 1, max: 5 };
  if (type === "checkbox") return { ...base, type };
  const options: readonly FieldOption[] =
    "options" in field && field.options.length > 0
      ? field.options
      : [{ id: createUniqueId("opt", new Set()), label: newOptionLabel }];
  return { ...base, type, options };
}

function defaultConditionValue(field: FormField): ConditionValue {
  if (field.type === "checkbox") return true;
  if (field.type === "number" || field.type === "rating") return field.min ?? 1;
  if ("options" in field) return field.options[0]?.id ?? "";
  return "";
}

function conditionOperators(field: FormField): readonly ConditionOperator[] {
  if (field.type === "multi-select") return ["contains", "not_empty"];
  if (field.type === "text" || field.type === "textarea") {
    return ["equals", "not_equals", "contains", "not_empty"];
  }
  return ["equals", "not_equals", "not_empty"];
}

function withoutDisplayCondition(field: FormField): FormField {
  const { displayCondition: _displayCondition, ...rest } = field;
  return rest as FormField;
}

function sanitizeBuilderSchema(schema: FormSchema): FormSchema {
  const sanitized = sanitizeSchema(schema);
  const indexById = new Map(sanitized.fields.map((field, index) => [field.id, index]));
  return {
    ...sanitized,
    fields: sanitized.fields.map((field, index) => {
      const sourceId = field.displayCondition?.questionId;
      if (sourceId === undefined) return field;
      const sourceIndex = indexById.get(sourceId);
      return sourceIndex !== undefined && sourceIndex < index ? field : withoutDisplayCondition(field);
    })
  };
}

function conditionWithValue(questionId: string, operator: ConditionOperator, value: ConditionValue): DisplayCondition {
  return operator === "not_empty" ? { questionId, operator } : { questionId, operator, value };
}

function ConditionValueEditor({
  source,
  condition,
  onChange,
  translate
}: {
  readonly source: FormField;
  readonly condition: DisplayCondition;
  readonly onChange: (condition: DisplayCondition) => void;
  readonly translate: (key: string, params?: Readonly<Record<string, string | number>>) => string;
}) {
  if (condition.operator === "not_empty") return null;
  const update = (value: ConditionValue) => onChange({ ...condition, value });
  if (source.type === "checkbox") {
    return (
      <select value={String(condition.value)} onChange={(event) => update(event.currentTarget.value === "true")}>
        <option value="true">{translate("builder.conditionTrue")}</option>
        <option value="false">{translate("builder.conditionFalse")}</option>
      </select>
    );
  }
  if (source.type === "number" || source.type === "rating") {
    return (
      <input
        aria-label={translate("builder.conditionValue")}
        type="number"
        value={typeof condition.value === "number" ? condition.value : ""}
        onChange={(event) => update(event.currentTarget.value === "" ? 0 : event.currentTarget.valueAsNumber)}
      />
    );
  }
  if ("options" in source) {
    return (
      <select value={String(condition.value ?? "")} onChange={(event) => update(event.currentTarget.value)}>
        {source.options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      aria-label={translate("builder.conditionValue")}
      type="text"
      value={typeof condition.value === "string" ? condition.value : ""}
      onChange={(event) => update(event.currentTarget.value)}
    />
  );
}

export interface FormBuilderProps {
  readonly schema: FormSchema;
  readonly onChange: (newSchema: FormSchema) => void;
  readonly locale?: string;
  readonly translator?: TranslationAdapter;
}

export function FormBuilder({ schema, onChange, locale = "en", translator }: FormBuilderProps) {
  const translate = (key: string, params: Readonly<Record<string, string | number>> = {}) => {
    const translated = translator?.translate(key, locale, params);
    return translated === undefined ? interpolate(BUILDER_DEFAULTS[key] ?? key, params) : translated;
  };
  const emitSchema = (candidate: FormSchema) => onChange(sanitizeBuilderSchema(candidate));

  const updateField = (fieldId: string, update: (field: FormField) => FormField) => {
    emitSchema({ ...schema, fields: schema.fields.map((field) => (field.id === fieldId ? update(field) : field)) });
  };

  const changeType = (fieldId: string, type: FieldType) => {
    emitSchema({
      ...schema,
      fields: schema.fields.map((field) => {
        if (field.id === fieldId) {
          return normalizeField(field, type, translate("builder.newOptionLabel", { index: 1 }));
        }
        if (field.displayCondition?.questionId === fieldId) {
          const { displayCondition: _condition, ...withoutCondition } = field;
          return withoutCondition as FormField;
        }
        return field;
      })
    });
  };

  const removeField = (fieldId: string) => {
    if (schema.fields.length === 1) return;
    emitSchema({ ...schema, fields: schema.fields.filter((field) => field.id !== fieldId) });
  };

  const moveField = (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= schema.fields.length) return;
    const fields = [...schema.fields];
    const current = fields[index];
    const other = fields[target];
    if (current === undefined || other === undefined) return;
    fields[index] = other;
    fields[target] = current;
    emitSchema({ ...schema, fields });
  };

  const addField = () => {
    const id = createUniqueId("q", new Set(schema.fields.map((field) => field.id)));
    emitSchema({
      ...schema,
      fields: [...schema.fields, { id, type: "text", title: translate("builder.newQuestionTitle"), required: false }]
    });
  };

  return (
    <section className="form-engine-builder" aria-label={translate("builder.formBuilder")}>
      <div className="form-engine-builder__list">
        {schema.fields.map((field, index) => {
          const condition = field.displayCondition;
          const source =
            condition === undefined ? undefined : schema.fields.find((item) => item.id === condition.questionId);
          const availableSources = schema.fields.slice(0, index);
          return (
            <fieldset className="form-engine-builder__question" key={field.id}>
              <legend>{field.title}</legend>
              <div className="form-engine-builder__toolbar">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => moveField(index, -1)}
                  aria-label={translate("builder.moveUp", { title: field.title })}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={index === schema.fields.length - 1}
                  onClick={() => moveField(index, 1)}
                  aria-label={translate("builder.moveDown", { title: field.title })}
                >
                  ↓
                </button>
                <button
                  type="button"
                  disabled={schema.fields.length === 1}
                  onClick={() => removeField(field.id)}
                  aria-label={translate("builder.delete", { title: field.title })}
                >
                  {translate("builder.deleteAction")}
                </button>
              </div>
              <div className="form-engine-builder__grid">
                <label>
                  {translate("builder.questionTitle")}
                  <input
                    value={field.title}
                    placeholder={translate("builder.questionTitlePlaceholder")}
                    onChange={(event) =>
                      updateField(field.id, (current) => ({
                        ...current,
                        title: event.currentTarget.value.trim().length === 0 ? current.title : event.currentTarget.value
                      }))
                    }
                  />
                </label>
                <label>
                  {translate("builder.type")}
                  <select
                    value={field.type}
                    onChange={(event) => changeType(field.id, event.currentTarget.value as FieldType)}
                  >
                    {FIELD_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {translate(fieldTypeKey(type))}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-engine-builder__check">
                  <input
                    type="checkbox"
                    checked={field.required === true}
                    onChange={(event) =>
                      updateField(field.id, (current) => ({ ...current, required: event.currentTarget.checked }))
                    }
                  />
                  {translate("builder.required")}
                </label>
              </div>

              {field.type === "rating" ? (
                <div className="form-engine-builder__grid">
                  <label>
                    {translate("builder.minimum")}
                    <input
                      type="number"
                      value={field.min ?? 1}
                      onChange={(event) => {
                        const min = event.currentTarget.valueAsNumber;
                        if (!Number.isInteger(min)) return;
                        updateField(field.id, (current) =>
                          current.type === "rating"
                            ? { ...current, min, max: Math.max(min, current.max ?? 5) }
                            : current
                        );
                      }}
                    />
                  </label>
                  <label>
                    {translate("builder.maximum")}
                    <input
                      type="number"
                      value={field.max ?? 5}
                      onChange={(event) => {
                        const max = event.currentTarget.valueAsNumber;
                        if (!Number.isInteger(max)) return;
                        updateField(field.id, (current) =>
                          current.type === "rating"
                            ? { ...current, min: Math.min(current.min ?? 1, max), max }
                            : current
                        );
                      }}
                    />
                  </label>
                </div>
              ) : null}

              {"options" in field ? (
                <div className="form-engine-builder__options">
                  <strong>{translate("builder.options")}</strong>
                  {field.options.map((option, optionIndex) => (
                    <div className="form-engine-builder__option" key={option.id}>
                      <input
                        aria-label={translate("builder.optionLabel", { index: optionIndex + 1 })}
                        value={option.label}
                        placeholder={translate("builder.optionLabelPlaceholder")}
                        onChange={(event) =>
                          updateField(field.id, (current) => {
                            if (!("options" in current)) return current;
                            const label = event.currentTarget.value;
                            if (label.trim().length === 0) return current;
                            return {
                              ...current,
                              options: current.options.map((item, itemIndex) =>
                                itemIndex === optionIndex ? { ...item, label } : item
                              )
                            };
                          })
                        }
                      />
                      <button
                        type="button"
                        disabled={field.options.length === 1}
                        onClick={() =>
                          updateField(field.id, (current) =>
                            "options" in current
                              ? {
                                  ...current,
                                  options: current.options.filter((_item, itemIndex) => itemIndex !== optionIndex)
                                }
                              : current
                          )
                        }
                      >
                        {translate("builder.remove")}
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      updateField(field.id, (current) =>
                        "options" in current
                          ? (() => {
                              const id = createUniqueId("opt", new Set(current.options.map((option) => option.id)));
                              return {
                                ...current,
                                options: [
                                  ...current.options,
                                  {
                                    id,
                                    label: translate("builder.newOptionLabel", { index: current.options.length + 1 })
                                  }
                                ]
                              };
                            })()
                          : current
                      )
                    }
                  >
                    {translate("builder.addOption")}
                  </button>
                </div>
              ) : null}

              <div className="form-engine-builder__condition">
                <label>
                  {translate("builder.displayCondition")}
                  <select
                    value={condition?.questionId ?? ""}
                    onChange={(event) => {
                      const selected = schema.fields.find((item) => item.id === event.currentTarget.value);
                      updateField(field.id, (current) => {
                        if (selected === undefined) {
                          const { displayCondition: _condition, ...withoutCondition } = current;
                          return withoutCondition as FormField;
                        }
                        const operator = conditionOperators(selected)[0] ?? "not_empty";
                        return {
                          ...current,
                          displayCondition: conditionWithValue(selected.id, operator, defaultConditionValue(selected))
                        };
                      });
                    }}
                  >
                    <option value="">{translate("builder.alwaysVisible")}</option>
                    {availableSources.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.title}
                      </option>
                    ))}
                  </select>
                </label>
                {condition !== undefined && source !== undefined ? (
                  <>
                    <select
                      aria-label={translate("builder.conditionOperator")}
                      value={condition.operator}
                      onChange={(event) => {
                        const operator = event.currentTarget.value as ConditionOperator;
                        updateField(field.id, (current) => ({
                          ...current,
                          displayCondition: conditionWithValue(source.id, operator, defaultConditionValue(source))
                        }));
                      }}
                    >
                      {conditionOperators(source).map((operator) => (
                        <option key={operator} value={operator}>
                          {translate(operatorKey(operator))}
                        </option>
                      ))}
                    </select>
                    <ConditionValueEditor
                      source={source}
                      condition={condition}
                      onChange={(next) => updateField(field.id, (current) => ({ ...current, displayCondition: next }))}
                      translate={translate}
                    />
                  </>
                ) : null}
              </div>
            </fieldset>
          );
        })}
      </div>
      <button className="form-engine-builder__add" type="button" onClick={addField}>
        {translate("builder.addQuestion")}
      </button>
    </section>
  );
}
