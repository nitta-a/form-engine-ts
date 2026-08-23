import type {
  ConditionOperator,
  ConditionValue,
  DisplayCondition,
  FieldOption,
  FieldType,
  FormField,
  FormSchema
} from "@form-engine/core";

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

function nextId(schema: FormSchema): string {
  let index = schema.fields.length + 1;
  const ids = new Set(schema.fields.map((field) => field.id));
  while (ids.has(`question-${index}`)) index += 1;
  return `question-${index}`;
}

function nextOptionValue(options: readonly FieldOption[]): string {
  const values = new Set(options.map((option) => option.value));
  let index = options.length + 1;
  while (values.has(`option-${index}`)) index += 1;
  return `option-${index}`;
}

function baseField(field: FormField, type: FieldType) {
  return {
    id: field.id,
    type,
    labelKey: field.labelKey,
    ...(field.required === undefined ? {} : { required: field.required }),
    ...(field.displayCondition === undefined ? {} : { displayCondition: field.displayCondition })
  };
}

function normalizeField(field: FormField, type: FieldType): FormField {
  const base = baseField(field, type);
  if (type === "text" || type === "textarea") return { ...base, type };
  if (type === "number") return { ...base, type };
  if (type === "rating") return { ...base, type, min: 1, max: 5 };
  if (type === "checkbox") return { ...base, type };
  const options: readonly FieldOption[] =
    "options" in field && field.options.length > 0
      ? field.options
      : [{ value: "option-1", labelKey: `${field.id}.option-1` }];
  return { ...base, type, options };
}

function defaultConditionValue(field: FormField): ConditionValue {
  if (field.type === "checkbox") return true;
  if (field.type === "number" || field.type === "rating") return field.min ?? 1;
  if ("options" in field) return field.options[0]?.value ?? "";
  return "";
}

function conditionOperators(field: FormField): readonly ConditionOperator[] {
  if (field.type === "multi-select") return ["contains", "not_empty"];
  if (field.type === "text" || field.type === "textarea") {
    return ["equals", "not_equals", "contains", "not_empty"];
  }
  return ["equals", "not_equals", "not_empty"];
}

function createsCycle(schema: FormSchema, targetId: string, sourceId: string): boolean {
  const fields = new Map(schema.fields.map((field) => [field.id, field]));
  let current: string | undefined = sourceId;
  const visited = new Set<string>();
  while (current !== undefined && !visited.has(current)) {
    if (current === targetId) return true;
    visited.add(current);
    current = fields.get(current)?.displayCondition?.questionId;
  }
  return false;
}

function conditionWithValue(questionId: string, operator: ConditionOperator, value: ConditionValue): DisplayCondition {
  return operator === "not_empty" ? { questionId, operator } : { questionId, operator, value };
}

function ConditionValueEditor({
  source,
  condition,
  onChange
}: {
  readonly source: FormField;
  readonly condition: DisplayCondition;
  readonly onChange: (condition: DisplayCondition) => void;
}) {
  if (condition.operator === "not_empty") return null;
  const update = (value: ConditionValue) => onChange({ ...condition, value });
  if (source.type === "checkbox") {
    return (
      <select value={String(condition.value)} onChange={(event) => update(event.currentTarget.value === "true")}>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }
  if (source.type === "number" || source.type === "rating") {
    return (
      <input
        aria-label="Condition value"
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
          <option key={option.value} value={option.value}>
            {option.value}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      aria-label="Condition value"
      type="text"
      value={typeof condition.value === "string" ? condition.value : ""}
      onChange={(event) => update(event.currentTarget.value)}
    />
  );
}

export interface FormBuilderProps {
  readonly schema: FormSchema;
  readonly onChange: (newSchema: FormSchema) => void;
}

export function FormBuilder({ schema, onChange }: FormBuilderProps) {
  const updateField = (fieldId: string, update: (field: FormField) => FormField) => {
    onChange({ ...schema, fields: schema.fields.map((field) => (field.id === fieldId ? update(field) : field)) });
  };

  const changeType = (fieldId: string, type: FieldType) => {
    onChange({
      ...schema,
      fields: schema.fields.map((field) => {
        if (field.id === fieldId) return normalizeField(field, type);
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
    onChange({
      ...schema,
      fields: schema.fields
        .filter((field) => field.id !== fieldId)
        .map((field) => {
          if (field.displayCondition?.questionId !== fieldId) return field;
          const { displayCondition: _condition, ...withoutCondition } = field;
          return withoutCondition as FormField;
        })
    });
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
    onChange({ ...schema, fields });
  };

  const addField = () => {
    const id = nextId(schema);
    onChange({ ...schema, fields: [...schema.fields, { id, type: "text", labelKey: `${id}.label` }] });
  };

  return (
    <section className="form-engine-builder" aria-label="Form builder">
      <div className="form-engine-builder__list">
        {schema.fields.map((field, index) => {
          const condition = field.displayCondition;
          const source =
            condition === undefined ? undefined : schema.fields.find((item) => item.id === condition.questionId);
          const availableSources = schema.fields.filter(
            (candidate) => candidate.id !== field.id && !createsCycle(schema, field.id, candidate.id)
          );
          return (
            <fieldset className="form-engine-builder__question" key={field.id}>
              <legend>{field.id}</legend>
              <div className="form-engine-builder__toolbar">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => moveField(index, -1)}
                  aria-label={`Move ${field.id} up`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={index === schema.fields.length - 1}
                  onClick={() => moveField(index, 1)}
                  aria-label={`Move ${field.id} down`}
                >
                  ↓
                </button>
                <button
                  type="button"
                  disabled={schema.fields.length === 1}
                  onClick={() => removeField(field.id)}
                  aria-label={`Delete ${field.id}`}
                >
                  Delete
                </button>
              </div>
              <div className="form-engine-builder__grid">
                <label>
                  Title key
                  <input
                    value={field.labelKey}
                    onChange={(event) =>
                      updateField(field.id, (current) => ({
                        ...current,
                        labelKey:
                          event.currentTarget.value.trim().length === 0 ? current.labelKey : event.currentTarget.value
                      }))
                    }
                  />
                </label>
                <label>
                  Type
                  <select
                    value={field.type}
                    onChange={(event) => changeType(field.id, event.currentTarget.value as FieldType)}
                  >
                    {FIELD_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
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
                  Required
                </label>
              </div>

              {field.type === "rating" ? (
                <div className="form-engine-builder__grid">
                  <label>
                    Minimum
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
                    Maximum
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
                  <strong>Options</strong>
                  {field.options.map((option, optionIndex) => (
                    <div className="form-engine-builder__option" key={`${field.id}-${option.value}-${option.labelKey}`}>
                      <input
                        aria-label={`${field.id} option value ${optionIndex + 1}`}
                        value={option.value}
                        onChange={(event) =>
                          updateField(field.id, (current) => {
                            if (!("options" in current)) return current;
                            const value = event.currentTarget.value;
                            if (
                              value.trim().length === 0 ||
                              current.options.some(
                                (item, itemIndex) => itemIndex !== optionIndex && item.value === value
                              )
                            ) {
                              return current;
                            }
                            return {
                              ...current,
                              options: current.options.map((item, itemIndex) =>
                                itemIndex === optionIndex ? { ...item, value } : item
                              )
                            };
                          })
                        }
                      />
                      <input
                        aria-label={`${field.id} option label ${optionIndex + 1}`}
                        value={option.labelKey}
                        onChange={(event) =>
                          updateField(field.id, (current) => {
                            if (!("options" in current)) return current;
                            const labelKey = event.currentTarget.value;
                            if (labelKey.trim().length === 0) return current;
                            return {
                              ...current,
                              options: current.options.map((item, itemIndex) =>
                                itemIndex === optionIndex ? { ...item, labelKey } : item
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
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      updateField(field.id, (current) =>
                        "options" in current
                          ? (() => {
                              const value = nextOptionValue(current.options);
                              return {
                                ...current,
                                options: [
                                  ...current.options,
                                  {
                                    value,
                                    labelKey: `${current.id}.${value}`
                                  }
                                ]
                              };
                            })()
                          : current
                      )
                    }
                  >
                    Add option
                  </button>
                </div>
              ) : null}

              <div className="form-engine-builder__condition">
                <label>
                  Display condition
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
                    <option value="">Always visible</option>
                    {availableSources.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.id}
                      </option>
                    ))}
                  </select>
                </label>
                {condition !== undefined && source !== undefined ? (
                  <>
                    <select
                      aria-label="Condition operator"
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
                          {operator}
                        </option>
                      ))}
                    </select>
                    <ConditionValueEditor
                      source={source}
                      condition={condition}
                      onChange={(next) => updateField(field.id, (current) => ({ ...current, displayCondition: next }))}
                    />
                  </>
                ) : null}
              </div>
            </fieldset>
          );
        })}
      </div>
      <button className="form-engine-builder__add" type="button" onClick={addField}>
        Add question
      </button>
    </section>
  );
}
