import type { ConditionOperator, ConditionValue, DisplayCondition, FormField } from "@form-engine-ts/core";
import type { FormBuilderComponents } from "./types";

export function defaultConditionValue(field: FormField): ConditionValue {
  if (field.type === "checkbox") return true;
  if (field.type === "number" || field.type === "rating") return field.min ?? 1;
  if ("options" in field) return field.options[0]?.id ?? "";
  return "";
}

export function conditionOperators(field: FormField): readonly ConditionOperator[] {
  if (field.type === "multi-select") return ["contains", "not_empty"];
  if (field.type === "text" || field.type === "textarea") {
    return ["equals", "not_equals", "contains", "not_empty"];
  }
  return ["equals", "not_equals", "not_empty"];
}

export function conditionWithValue(
  questionId: string,
  operator: ConditionOperator,
  value: ConditionValue
): DisplayCondition {
  return operator === "not_empty" ? { questionId, operator } : { questionId, operator, value };
}

export function ConditionValueEditor({
  source,
  condition,
  onChange,
  translate,
  components,
  readOnly = false
}: {
  readonly readOnly?: boolean;
  readonly source: FormField;
  readonly condition: DisplayCondition;
  readonly onChange: (condition: DisplayCondition) => void;
  readonly translate: (key: string, params?: Readonly<Record<string, string | number>>) => string;
  readonly components: Required<FormBuilderComponents>;
}) {
  const { Select, TextInput } = components;
  if (condition.operator === "not_empty") return null;
  const update = (value: ConditionValue) => onChange({ ...condition, value });
  if (source.type === "checkbox") {
    return (
      <Select
        disabled={readOnly}
        aria-label={translate("builder.conditionValue")}
        value={String(condition.value)}
        onChange={(value) => update(value === "true")}
        options={[
          { value: "true", label: translate("builder.conditionTrue") },
          { value: "false", label: translate("builder.conditionFalse") }
        ]}
      />
    );
  }
  if (source.type === "number" || source.type === "rating") {
    return (
      <TextInput
        disabled={readOnly}
        aria-label={translate("builder.conditionValue")}
        type="number"
        value={typeof condition.value === "number" ? String(condition.value) : ""}
        onChange={(value) => update(value === "" ? 0 : Number(value))}
      />
    );
  }
  if ("options" in source) {
    return (
      <Select
        disabled={readOnly}
        aria-label={translate("builder.conditionValue")}
        value={String(condition.value ?? "")}
        onChange={update}
        options={source.options.map((option) => ({ value: option.id, label: option.label }))}
      />
    );
  }
  return (
    <TextInput
      disabled={readOnly}
      aria-label={translate("builder.conditionValue")}
      value={typeof condition.value === "string" ? condition.value : ""}
      onChange={update}
    />
  );
}
