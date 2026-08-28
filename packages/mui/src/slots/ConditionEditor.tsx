import type {
  ConditionOperator,
  DisplayConditionGroup,
  DisplayRule,
  FieldDisplayCondition,
  FormField,
  FormSchema
} from "@form-engine-ts/core";
import {
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup
} from "@mui/material";

export interface ConditionEditorProps {
  readonly schema: FormSchema;
  readonly fieldId: string;
  readonly value?: DisplayRule;
  readonly onChange: (rule: DisplayRule | undefined) => void;
  readonly readOnly?: boolean;
}

const OPERATORS: readonly ConditionOperator[] = [
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "is_empty",
  "is_not_empty",
  "greater_than",
  "less_than"
];

function sourceIds(field: FormField): readonly string[] {
  if (field.displayRule === undefined)
    return field.displayCondition?.questionId === undefined ? [] : [field.displayCondition.questionId];
  const ids: string[] = [];
  const visit = (group: DisplayConditionGroup): void => {
    for (const condition of group.conditions) {
      if ("logic" in condition) visit(condition);
      else ids.push(condition.fieldId);
    }
  };
  visit(field.displayRule.condition);
  return ids;
}

function dependsOn(schema: FormSchema, startId: string, targetId: string, visited = new Set<string>()): boolean {
  if (startId === targetId) return true;
  if (visited.has(startId)) return false;
  visited.add(startId);
  const field = schema.fields.find((candidate) => candidate.id === startId);
  return field !== undefined && sourceIds(field).some((sourceId) => dependsOn(schema, sourceId, targetId, visited));
}

function operatorsFor(field: FormField | undefined): readonly ConditionOperator[] {
  if (field === undefined) return [];
  if (field.type === "checkbox" || field.type === "multi-select")
    return ["contains", "not_contains", "is_empty", "is_not_empty"];
  if (field.type === "text" || field.type === "textarea")
    return OPERATORS.filter((operator) =>
      ["equals", "not_equals", "contains", "not_contains", "is_empty", "is_not_empty"].includes(operator)
    );
  if (field.type === "number" || field.type === "rating")
    return ["equals", "not_equals", "greater_than", "less_than", "is_empty", "is_not_empty"];
  return ["equals", "not_equals", "is_empty", "is_not_empty"];
}

function conditionGroup(rule: DisplayRule | undefined): DisplayConditionGroup {
  return rule?.condition ?? { logic: "all", conditions: [] };
}

function conditionValue(
  field: FormField | undefined,
  condition: FieldDisplayCondition,
  onChange: (value: unknown) => void
) {
  if (["is_empty", "is_not_empty"].includes(condition.operator)) return null;
  if (field !== undefined && "options" in field) {
    return (
      <FormControl fullWidth size="small">
        <InputLabel>Value</InputLabel>
        <Select label="Value" value={String(condition.value ?? "")} onChange={(event) => onChange(event.target.value)}>
          {field.options.map((option) => (
            <MenuItem key={option.id} value={option.id}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  }
  return (
    <TextField
      label="Value"
      type={field?.type === "number" || field?.type === "rating" ? "number" : "text"}
      value={condition.value === undefined ? "" : String(condition.value)}
      onChange={(event) =>
        onChange(field?.type === "number" || field?.type === "rating" ? Number(event.target.value) : event.target.value)
      }
      fullWidth
      size="small"
    />
  );
}

export function ConditionEditor({ schema, fieldId, value, onChange, readOnly = false }: ConditionEditorProps) {
  const group = conditionGroup(value);
  const candidates = schema.fields.filter((field) => field.id !== fieldId && !dependsOn(schema, field.id, fieldId));
  const updateGroup = (nextGroup: DisplayConditionGroup): void =>
    onChange({ action: value?.action ?? "show", condition: nextGroup });
  const updateCondition = (index: number, nextCondition: FieldDisplayCondition): void => {
    const conditions = group.conditions.map((condition, conditionIndex) =>
      conditionIndex === index ? nextCondition : condition
    );
    updateGroup({ ...group, conditions });
  };
  return (
    <Stack spacing={1.5} data-testid={`condition-editor-${fieldId}`}>
      <ToggleButtonGroup
        exclusive
        value={group.logic}
        onChange={(_event, logic: "all" | "any" | null) =>
          logic === null ? undefined : updateGroup({ ...group, logic })
        }
        disabled={readOnly}
        size="small"
      >
        <ToggleButton value="all">All (AND)</ToggleButton>
        <ToggleButton value="any">Any (OR)</ToggleButton>
      </ToggleButtonGroup>
      <FormControl fullWidth size="small">
        <InputLabel>Action</InputLabel>
        <Select
          label="Action"
          value={value?.action ?? "show"}
          onChange={(event) => onChange({ action: event.target.value as "show" | "hide", condition: group })}
          disabled={readOnly}
        >
          <MenuItem value="show">Show when matched</MenuItem>
          <MenuItem value="hide">Hide when matched</MenuItem>
        </Select>
      </FormControl>
      {group.conditions.map((condition, index) => {
        if ("logic" in condition) return null;
        const source = schema.fields.find((field) => field.id === condition.fieldId);
        return (
          <Stack direction={{ xs: "column", md: "row" }} spacing={1} key={`${condition.fieldId}-${condition.operator}`}>
            <FormControl fullWidth size="small">
              <InputLabel>Question</InputLabel>
              <Select
                label="Question"
                value={condition.fieldId}
                onChange={(event) => {
                  const nextSource = schema.fields.find((field) => field.id === event.target.value);
                  const nextOperator = operatorsFor(nextSource)[0] ?? "equals";
                  updateCondition(index, { fieldId: event.target.value, operator: nextOperator });
                }}
                disabled={readOnly}
              >
                {candidates.map((candidate) => (
                  <MenuItem key={candidate.id} value={candidate.id}>
                    {candidate.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Operator</InputLabel>
              <Select
                label="Operator"
                value={condition.operator}
                onChange={(event) =>
                  updateCondition(index, { ...condition, operator: event.target.value as ConditionOperator })
                }
                disabled={readOnly}
              >
                {operatorsFor(source).map((operator) => (
                  <MenuItem key={operator} value={operator}>
                    {operator}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {conditionValue(source, condition, (nextValue) =>
              updateCondition(index, { ...condition, value: nextValue })
            )}
            <Button
              onClick={() =>
                updateGroup({
                  ...group,
                  conditions: group.conditions.filter((_item, itemIndex) => itemIndex !== index)
                })
              }
              disabled={readOnly}
            >
              Remove
            </Button>
          </Stack>
        );
      })}
      <Button
        variant="outlined"
        disabled={readOnly || candidates.length === 0}
        onClick={() => {
          const source = candidates[0];
          if (source === undefined) return;
          const operator = operatorsFor(source)[0] ?? "equals";
          updateGroup({ ...group, conditions: [...group.conditions, { fieldId: source.id, operator }] });
        }}
      >
        Add condition
      </Button>
    </Stack>
  );
}
