import type { DisplayCondition, FormPage, FormSchema } from "@form-engine-ts/core";
import {
  ConditionValueEditor,
  conditionOperators,
  conditionWithValue,
  defaultConditionValue
} from "./builderConditions";
import type { BuilderPagesSlotProps } from "./types";

export interface BuilderPageConditionEditorProps {
  readonly className?: string;
  readonly fieldClassName?: string;
  readonly schema: FormSchema;
  readonly page: FormPage;
  readonly components: BuilderPagesSlotProps["components"];
  readonly translate: BuilderPagesSlotProps["translate"];
  readonly readOnly?: boolean;
  readonly onChange: (condition: DisplayCondition | undefined) => void;
}

/** Page conditions share the default builder behavior and injected UI primitives. */
export function BuilderPageConditionEditor({
  className,
  fieldClassName,
  schema,
  page,
  components,
  translate,
  readOnly = false,
  onChange
}: BuilderPageConditionEditorProps) {
  const { Select } = components;
  const index = schema.pages?.findIndex((candidate) => candidate.id === page.id) ?? -1;
  const priorIds = new Set(schema.pages?.slice(0, Math.max(0, index)).flatMap((item) => item.questionIds));
  const sources = schema.fields.filter((field) => priorIds.has(field.id));
  const source = schema.fields.find((field) => field.id === page.displayCondition?.questionId);
  return (
    <div className={className}>
      <div className={fieldClassName}>
        <Select
          id={`builder-page-${page.id}-condition`}
          label={translate("builder.pageCondition")}
          disabled={readOnly}
          value={page.displayCondition?.questionId ?? ""}
          onChange={(value) => {
            const selected = sources.find((field) => field.id === value);
            onChange(
              selected === undefined
                ? undefined
                : conditionWithValue(
                    selected.id,
                    conditionOperators(selected)[0] ?? "not_empty",
                    defaultConditionValue(selected)
                  )
            );
          }}
          options={[
            { value: "", label: translate("builder.alwaysVisible") },
            ...sources.map((field) => ({ value: field.id, label: field.title }))
          ]}
        />
      </div>
      {page.displayCondition === undefined || source === undefined ? null : (
        <>
          <Select
            aria-label={translate("builder.conditionOperator")}
            disabled={readOnly}
            value={page.displayCondition.operator}
            onChange={(value) => {
              const operator = conditionOperators(source).find((candidate) => candidate === value);
              if (operator !== undefined)
                onChange(conditionWithValue(source.id, operator, defaultConditionValue(source)));
            }}
            options={conditionOperators(source).map((operator) => ({
              value: operator,
              label: translate(`builder.operator.${operator}`)
            }))}
          />
          <ConditionValueEditor
            readOnly={readOnly}
            source={source}
            condition={page.displayCondition}
            onChange={(condition) => {
              if (!readOnly) onChange(condition);
            }}
            translate={translate}
            components={components}
          />
        </>
      )}
    </div>
  );
}
