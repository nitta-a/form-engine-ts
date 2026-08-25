import type { ConditionOperator, FieldType, FormField } from "@form-engine-ts/core";
import type { BuilderFieldEditorSlotProps, FormBuilderSlots } from "@form-engine-ts/react";
import { Card, Stack, Typography } from "@mui/material";
import type { ComponentType } from "react";
import type { MuiAdapterOptions } from "../types";
import { resolveMuiAdapterOptions } from "../types";
import { createMuiOptionEditorSlot } from "./OptionEditor";
import { createMuiToolbarSlot } from "./Toolbar";

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

function isFieldType(value: string): value is FieldType {
  return FIELD_TYPES.some((type) => type === value);
}

function conditionOperators(field: FormField): readonly ConditionOperator[] {
  if (field.type === "multi-select") return ["contains", "not_empty"];
  if (field.type === "text" || field.type === "textarea") {
    return ["equals", "not_equals", "contains", "not_empty"];
  }
  return ["equals", "not_equals", "not_empty"];
}

function isConditionOperator(value: string): value is ConditionOperator {
  return ["equals", "not_equals", "contains", "not_empty"].some((operator) => operator === value);
}

function numericValue(value: string): number | undefined {
  if (value.trim().length === 0) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function updateBound(field: FormField, property: "min" | "max", value: string): FormField {
  if (field.type !== "number" && field.type !== "rating") return field;
  const nextValue = numericValue(value);
  if (nextValue !== undefined) return { ...field, [property]: nextValue };
  const { [property]: _removed, ...remaining } = field;
  return remaining;
}

export function createMuiFieldEditorSlot(options?: MuiAdapterOptions): ComponentType<BuilderFieldEditorSlotProps> {
  const resolved = resolveMuiAdapterOptions(options);
  const Toolbar = createMuiToolbarSlot(options);
  const OptionEditor = createMuiOptionEditorSlot(options);
  return function MuiFieldEditor({
    schema,
    field,
    index,
    currentLocale,
    policy,
    features,
    readOnly,
    actions,
    components,
    translate
  }: BuilderFieldEditorSlotProps) {
    const { Button, Checkbox, Select, TextArea, TextInput } = components;
    const allowedTypes = policy?.allowedFieldTypes ?? FIELD_TYPES;
    const pageId = schema.pages?.find((page) => page.questionIds.includes(field.id))?.id ?? "";
    const condition = field.displayCondition;
    const conditionSources = schema.fields.slice(0, index);
    const conditionSource = conditionSources.find((source) => source.id === condition?.questionId);
    const titleErrorId = field.title.trim().length === 0 ? `mui-field-${field.id}-title-error` : undefined;
    return (
      <Card
        {...resolved.muiSlotProps?.card}
        data-mui-slot="field-editor"
        variant="outlined"
        sx={resolved.muiSlotProps?.card?.sx ?? { mb: resolved.dense ? 1 : 2, p: resolved.dense ? 1.5 : 2 }}
      >
        <Toolbar
          schema={schema}
          translate={translate}
          kind="field"
          targetId={field.id}
          index={index}
          total={schema.fields.length}
          title={field.title}
          onMoveUp={() => actions.moveField(field.id, index - 1)}
          onMoveDown={() => actions.moveField(field.id, index + 1)}
          onRemove={() => actions.removeField(field.id)}
          readOnly={readOnly}
          actions={actions}
          components={components}
        />
        <Stack {...resolved.muiSlotProps?.stack} spacing={resolved.dense ? 1 : 2}>
          <Typography variant="subtitle1" fontWeight="bold">
            {field.title}
          </Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={resolved.dense ? 1 : 2}>
            <TextInput
              id={`mui-field-${field.id}-title`}
              name={`fields.${field.id}.title`}
              label={translate("builder.questionTitle")}
              value={field.title}
              required
              error={field.title.trim().length === 0}
              helperText={field.title.trim().length === 0 ? translate("builder.required") : ""}
              aria-describedby={titleErrorId}
              disabled={readOnly}
              onChange={(value) => actions.setSourceText({ kind: "field", id: field.id }, "title", value)}
            />
            <Select
              id={`mui-field-${field.id}-type`}
              name={`fields.${field.id}.type`}
              label={translate("builder.type")}
              value={allowedTypes.includes(field.type) ? field.type : ""}
              options={FIELD_TYPES.filter((type) => allowedTypes.includes(type)).map((type) => ({
                value: type,
                label: translate(`builder.fieldType.${type}`)
              }))}
              disabled={readOnly}
              onChange={(value) => {
                if (isFieldType(value)) actions.changeFieldType(field.id, value);
              }}
            />
          </Stack>
          <TextArea
            id={`mui-field-${field.id}-description`}
            name={`fields.${field.id}.description`}
            label={translate("builder.description")}
            value={field.description ?? ""}
            rows={resolved.dense ? 2 : 3}
            disabled={readOnly}
            onChange={(value) => actions.setSourceText({ kind: "field", id: field.id }, "description", value)}
          />
          <Checkbox
            id={`mui-field-${field.id}-required`}
            name={`fields.${field.id}.required`}
            label={translate("builder.required")}
            checked={field.required}
            disabled={readOnly}
            onChange={(checked) => actions.updateField(field.id, (current) => ({ ...current, required: checked }))}
          />
          {features?.pages === false || schema.pages === undefined ? null : (
            <Select
              id={`mui-field-${field.id}-page`}
              label={translate("builder.questionPage")}
              value={pageId}
              options={[
                { value: "", label: translate("builder.unassigned") },
                ...schema.pages.map((page) => ({ value: page.id, label: page.title ?? page.id }))
              ]}
              disabled={readOnly}
              onChange={(value) => actions.assignFieldToPage(field.id, value.length === 0 ? null : value)}
            />
          )}
          {field.type === "number" || field.type === "rating" ? (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={resolved.dense ? 1 : 2}>
              <TextInput
                id={`mui-field-${field.id}-minimum`}
                label={translate("builder.minimum")}
                type="number"
                value={field.min === undefined ? "" : String(field.min)}
                disabled={readOnly}
                onChange={(value) => actions.updateField(field.id, (current) => updateBound(current, "min", value))}
              />
              <TextInput
                id={`mui-field-${field.id}-maximum`}
                label={translate("builder.maximum")}
                type="number"
                value={field.max === undefined ? "" : String(field.max)}
                disabled={readOnly}
                onChange={(value) => actions.updateField(field.id, (current) => updateBound(current, "max", value))}
              />
            </Stack>
          ) : null}
          {features?.conditions === false || conditionSources.length === 0 ? null : (
            <Stack direction={{ xs: "column", md: "row" }} spacing={resolved.dense ? 1 : 2}>
              <Select
                id={`mui-field-${field.id}-condition-source`}
                label={translate("builder.displayCondition")}
                value={condition?.questionId ?? ""}
                options={[
                  { value: "", label: translate("builder.alwaysVisible") },
                  ...conditionSources.map((source) => ({ value: source.id, label: source.title }))
                ]}
                disabled={readOnly}
                onChange={(value) =>
                  actions.setDisplayCondition(
                    field.id,
                    value.length === 0 ? undefined : { questionId: value, operator: "equals", value: "" }
                  )
                }
              />
              {condition === undefined ? null : (
                <>
                  <Select
                    id={`mui-field-${field.id}-condition-operator`}
                    label={translate("builder.conditionOperator")}
                    value={condition.operator}
                    options={(conditionSource === undefined ? [] : conditionOperators(conditionSource)).map(
                      (operator) => ({ value: operator, label: translate(`builder.operator.${operator}`) })
                    )}
                    disabled={readOnly}
                    onChange={(value) => {
                      if (!isConditionOperator(value)) return;
                      actions.setDisplayCondition(
                        field.id,
                        value === "not_empty"
                          ? { questionId: condition.questionId, operator: value }
                          : { ...condition, operator: value, value: condition.value ?? "" }
                      );
                    }}
                  />
                  {condition.operator === "not_empty" ? null : (
                    <TextInput
                      id={`mui-field-${field.id}-condition-value`}
                      label={translate("builder.conditionValue")}
                      value={condition.value === undefined ? "" : String(condition.value)}
                      disabled={readOnly}
                      onChange={(value) => actions.setDisplayCondition(field.id, { ...condition, value })}
                    />
                  )}
                </>
              )}
            </Stack>
          )}
          {currentLocale.length === 0 ? null : (
            <Stack spacing={resolved.dense ? 1 : 2}>
              <Typography variant="subtitle2">
                {translate("builder.translation", {
                  locale: resolved.getLocaleLabel?.(currentLocale) ?? currentLocale
                })}
              </Typography>
              <TextInput
                id={`mui-field-${field.id}-${currentLocale}-title`}
                label={translate("builder.translatedQuestionTitle")}
                value={field.translations?.[currentLocale]?.title ?? ""}
                disabled={readOnly}
                onChange={(value) =>
                  actions.setLocaleTranslation(currentLocale, { kind: "field", id: field.id }, "title", value)
                }
              />
              <TextArea
                id={`mui-field-${field.id}-${currentLocale}-description`}
                label={translate("builder.translatedDescription")}
                value={field.translations?.[currentLocale]?.description ?? ""}
                disabled={readOnly}
                onChange={(value) =>
                  actions.setLocaleTranslation(currentLocale, { kind: "field", id: field.id }, "description", value)
                }
              />
            </Stack>
          )}
          {"options" in field ? (
            <Stack data-mui-slot="options" spacing={resolved.dense ? 1 : 2}>
              <Typography variant="subtitle2">{translate("builder.options")}</Typography>
              {field.options.map((option, optionIndex) => (
                <OptionEditor
                  key={option.id}
                  schema={schema}
                  field={field}
                  option={option}
                  index={optionIndex}
                  currentLocale={currentLocale}
                  translate={translate}
                  readOnly={readOnly}
                  actions={actions}
                  components={components}
                />
              ))}
              <Button
                action="addOption"
                targetId={field.id}
                disabled={
                  readOnly ||
                  (policy?.maxOptionsPerField !== undefined && field.options.length >= policy.maxOptionsPerField)
                }
                onClick={() => actions.addOption(field.id)}
              >
                {translate("builder.addOption")}
              </Button>
            </Stack>
          ) : null}
        </Stack>
      </Card>
    );
  };
}

export const MuiFieldEditorSlot: NonNullable<FormBuilderSlots["fieldEditor"]> = createMuiFieldEditorSlot();
