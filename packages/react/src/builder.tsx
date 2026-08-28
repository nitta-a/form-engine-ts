// biome-ignore-all lint/a11y/noLabelWithoutControl: injected input primitives render the associated control at runtime.
import {
  type AsyncTranslationAdapter,
  type ConditionOperator,
  type ConditionValue,
  DEFAULT_FIELD_TYPE_DEFINITIONS,
  type DisplayCondition,
  type FieldType,
  type FormField,
  type FormPolicy,
  type FormSchema,
  type JsonValue,
  type PopulateTranslationOptions,
  populateSchemaTranslations,
  type QuestionType,
  type TranslationAdapter,
  type TranslationReport
} from "@form-engine-ts/core";
import type { ReactElement, ReactNode } from "react";
import { Children, createContext, isValidElement, useContext, useState } from "react";
import {
  type BuilderActionError,
  type BuilderActionResult,
  type BuilderFactories,
  type BuilderTextTarget,
  useFormBuilder
} from "./hooks/useFormBuilder";
import { BUILDER_TRANSLATION_ALIASES, BUILDER_TRANSLATION_KEYS, resolveTranslation } from "./i18n";
import type {
  BuilderActionContext,
  BuilderActionIconType,
  BuilderButtonProps,
  BuilderCheckboxProps,
  BuilderErrorMessageProps,
  BuilderFieldsetProps,
  BuilderIconButtonProps,
  BuilderSectionProps,
  BuilderSelectOption,
  BuilderSelectProps,
  BuilderSlotActions,
  BuilderTextAreaProps,
  BuilderTextInputProps,
  FieldEditorControlsConfig,
  FieldPropertyControlMode,
  FieldTypeSelectOptionsConfig,
  FieldTypeSelectOptionsContext,
  FormBuilderComponents,
  FormBuilderSectionName,
  FormBuilderSlots,
  FormBuilderSubmissionSettingsOptions,
  ManualTranslationContext,
  ManualTranslationTarget
} from "./types";

function DefaultButton({
  id,
  className,
  disabled,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  "aria-labelledby": ariaLabelledBy,
  onClick,
  children,
  title,
  action,
  targetId
}: BuilderButtonProps) {
  return (
    <button
      id={id}
      className={className}
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-labelledby={ariaLabelledBy}
      title={title}
      data-builder-action={action}
      data-target-id={targetId}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function DefaultIconButton(props: BuilderIconButtonProps) {
  return (
    <DefaultButton
      {...(props.id === undefined ? {} : { id: props.id })}
      {...(props.className === undefined ? {} : { className: props.className })}
      {...(props.disabled === undefined ? {} : { disabled: props.disabled })}
      aria-label={props["aria-label"] ?? props.title}
      aria-describedby={props["aria-describedby"]}
      aria-labelledby={props["aria-labelledby"]}
      {...(props.title === undefined ? {} : { title: props.title })}
      {...(props.onClick === undefined ? {} : { onClick: props.onClick })}
    >
      {props.icon}
    </DefaultButton>
  );
}

function defaultIconFor(actionType: BuilderActionIconType): ReactNode {
  switch (actionType) {
    case "moveUp":
      return "↑";
    case "moveDown":
      return "↓";
    case "delete":
    case "close":
      return "×";
    case "add":
      return "+";
    case "dragHandle":
      return "⠿";
    case "edit":
      return "✎";
    case "settings":
      return "⚙";
    case "translate":
      return "文";
  }
}

function defaultFieldTypeIcon(type: QuestionType): ReactNode {
  switch (type) {
    case "text":
      return "T";
    case "textarea":
      return "≡";
    case "number":
      return "#";
    case "rating":
      return "★";
    case "select":
      return "▾";
    case "multi-select":
      return "☑";
    case "checkbox":
      return "□";
    case "radio":
      return "◉";
  }
}

function DefaultTextInput({
  id,
  className,
  disabled,
  readOnly,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  "aria-labelledby": ariaLabelledBy,
  name,
  label,
  required,
  error,
  helperText,
  value,
  onChange,
  placeholder,
  maxLength,
  inputMode,
  type = "text",
  min,
  max,
  step
}: BuilderTextInputProps) {
  const labelElement =
    label === undefined ? null : id === undefined ? <span>{label}</span> : <label htmlFor={id}>{label}</label>;
  return (
    <>
      {labelElement}
      <input
        id={id}
        name={name}
        className={className}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-labelledby={ariaLabelledBy}
        aria-invalid={error === true ? true : undefined}
        type={type === "text" ? undefined : type}
        inputMode={inputMode}
        min={min}
        max={max}
        step={step}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      {helperText === undefined || helperText.length === 0 ? null : <small id={ariaDescribedBy}>{helperText}</small>}
    </>
  );
}

function DefaultTextArea({
  id,
  className,
  disabled,
  readOnly,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  "aria-labelledby": ariaLabelledBy,
  name,
  label,
  required,
  error,
  helperText,
  value,
  onChange,
  rows,
  placeholder,
  maxLength
}: BuilderTextAreaProps) {
  const labelElement =
    label === undefined ? null : id === undefined ? <span>{label}</span> : <label htmlFor={id}>{label}</label>;
  return (
    <>
      {labelElement}
      <textarea
        id={id}
        name={name}
        className={className}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-labelledby={ariaLabelledBy}
        aria-invalid={error === true ? true : undefined}
        value={value}
        rows={rows}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      {helperText === undefined || helperText.length === 0 ? null : <small id={ariaDescribedBy}>{helperText}</small>}
    </>
  );
}

function DefaultSelect({
  id,
  className,
  disabled,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  "aria-labelledby": ariaLabelledBy,
  name,
  label,
  required,
  error,
  helperText,
  value,
  onChange,
  onKeyDown,
  options,
  renderOption,
  renderValue
}: BuilderSelectProps) {
  const normalizedOptions: readonly BuilderSelectOption[] = options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option
  );
  const selectedOption = normalizedOptions.find((option) => option.value === value);
  const labelElement =
    label === undefined ? null : id === undefined ? <span>{label}</span> : <label htmlFor={id}>{label}</label>;
  return (
    <>
      {labelElement}
      <select
        id={id}
        name={name}
        className={className}
        disabled={disabled}
        required={required}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-labelledby={ariaLabelledBy}
        aria-invalid={error === true ? true : undefined}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        onKeyDown={onKeyDown}
      >
        {normalizedOptions.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {renderOption === undefined ? option.label : renderOption(option)}
          </option>
        ))}
      </select>
      {renderValue === undefined ? null : <output>{renderValue(selectedOption)}</output>}
      {helperText === undefined || helperText.length === 0 ? null : <small id={ariaDescribedBy}>{helperText}</small>}
    </>
  );
}

function DefaultCheckbox({
  id,
  className,
  disabled,
  readOnly,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  "aria-labelledby": ariaLabelledBy,
  name,
  required,
  error,
  helperText,
  checked,
  onChange,
  label
}: BuilderCheckboxProps) {
  return (
    <>
      <label className={className}>
        <input
          id={id}
          name={name}
          type="checkbox"
          disabled={disabled || readOnly}
          required={required}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          aria-labelledby={ariaLabelledBy}
          aria-invalid={error === true ? true : undefined}
          checked={checked}
          onChange={(event) => onChange(event.currentTarget.checked)}
        />
        {label}
      </label>
      {helperText === undefined || helperText.length === 0 ? null : <small id={ariaDescribedBy}>{helperText}</small>}
    </>
  );
}

function DefaultSection({
  id,
  className,
  title,
  description,
  headingId,
  "aria-label": ariaLabel,
  onClickCapture,
  children
}: BuilderSectionProps) {
  return (
    <section
      id={id}
      className={className}
      aria-label={ariaLabel}
      aria-labelledby={title === undefined ? undefined : headingId}
      onClickCapture={onClickCapture}
    >
      {title === undefined ? null : <h2 id={headingId}>{title}</h2>}
      {description === undefined ? null : <p>{description}</p>}
      {children}
    </section>
  );
}

function DefaultFieldset({ className, legend, disabled, children }: BuilderFieldsetProps) {
  return (
    <fieldset className={className} disabled={disabled}>
      {legend === undefined ? null : <legend>{legend}</legend>}
      {children}
    </fieldset>
  );
}

function DefaultErrorMessage({ className, message }: BuilderErrorMessageProps) {
  return <p className={className}>{message}</p>;
}

const DEFAULT_COMPONENTS: Required<FormBuilderComponents> = {
  Button: DefaultButton,
  IconButton: DefaultIconButton,
  TextInput: DefaultTextInput,
  TextArea: DefaultTextArea,
  Select: DefaultSelect,
  Checkbox: DefaultCheckbox,
  Section: DefaultSection,
  Fieldset: DefaultFieldset,
  ErrorMessage: DefaultErrorMessage,
  renderIcon: defaultIconFor,
  renderFieldTypeIcon: defaultFieldTypeIcon
};

interface BuilderPrimitiveContextValue {
  readonly components: Required<FormBuilderComponents>;
  readonly readOnly: boolean;
  readonly unstyled: boolean;
}

const BuilderPrimitiveContext = createContext<BuilderPrimitiveContextValue>({
  components: DEFAULT_COMPONENTS,
  readOnly: false,
  unstyled: false
});

function withoutDefaultStyleClasses(className: string | undefined): string | undefined {
  const filtered = className
    ?.split(/\s+/u)
    .filter((name) => name.length > 0 && !name.startsWith("form-engine-builder") && !name.startsWith("feb-"))
    .join(" ");
  return filtered === undefined || filtered.length === 0 ? undefined : filtered;
}

function primitiveClassName(
  className: string | undefined,
  defaultClassName: string,
  unstyled: boolean
): string | undefined {
  const userClassName = unstyled ? withoutDefaultStyleClasses(className) : className;
  return (
    [unstyled ? undefined : defaultClassName, userClassName]
      .filter((value): value is string => value !== undefined)
      .join(" ") || undefined
  );
}

function BuilderButton(props: BuilderButtonProps) {
  const context = useContext(BuilderPrimitiveContext);
  const Component = context.components.Button;
  return (
    <Component
      {...props}
      className={primitiveClassName(props.className, "feb-button", context.unstyled)}
      disabled={context.readOnly || props.disabled === true}
      readOnly={context.readOnly || props.readOnly === true}
    />
  );
}

function BuilderIconButton(props: BuilderIconButtonProps) {
  const context = useContext(BuilderPrimitiveContext);
  const Component = context.components.IconButton;
  const icon =
    props.actionType === undefined
      ? (props.icon ?? undefined)
      : (context.components.renderIcon(props.actionType) ?? props.icon ?? defaultIconFor(props.actionType));
  return (
    <Component
      {...props}
      icon={icon}
      className={primitiveClassName(props.className, "feb-icon-button", context.unstyled)}
      disabled={context.readOnly || props.disabled === true}
      readOnly={context.readOnly || props.readOnly === true}
    />
  );
}

function BuilderTextInput(props: BuilderTextInputProps) {
  const context = useContext(BuilderPrimitiveContext);
  const Component = context.components.TextInput;
  return (
    <Component
      {...props}
      className={primitiveClassName(props.className, "feb-input", context.unstyled)}
      disabled={context.readOnly || props.disabled === true}
      readOnly={context.readOnly || props.readOnly === true}
    />
  );
}

function BuilderTextArea(props: BuilderTextAreaProps) {
  const context = useContext(BuilderPrimitiveContext);
  const Component = context.components.TextArea;
  return (
    <Component
      {...props}
      className={primitiveClassName(props.className, "feb-textarea", context.unstyled)}
      disabled={context.readOnly || props.disabled === true}
      readOnly={context.readOnly || props.readOnly === true}
    />
  );
}

function BuilderSelect(props: BuilderSelectProps) {
  const context = useContext(BuilderPrimitiveContext);
  const Component = context.components.Select;
  return (
    <Component
      {...props}
      className={primitiveClassName(props.className, "feb-select", context.unstyled)}
      disabled={context.readOnly || props.disabled === true}
      readOnly={context.readOnly || props.readOnly === true}
    />
  );
}

function BuilderCheckbox(props: BuilderCheckboxProps) {
  const context = useContext(BuilderPrimitiveContext);
  const Component = context.components.Checkbox;
  return (
    <Component
      {...props}
      className={primitiveClassName(props.className, "feb-checkbox", context.unstyled)}
      disabled={context.readOnly || props.disabled === true}
      readOnly={context.readOnly || props.readOnly === true}
    />
  );
}

function BuilderSection(props: BuilderSectionProps) {
  const Component = useContext(BuilderPrimitiveContext).components.Section;
  return <Component {...props} />;
}

function BuilderFieldset(props: BuilderFieldsetProps) {
  const context = useContext(BuilderPrimitiveContext);
  const Component = context.components.Fieldset;
  return <Component {...props} disabled={context.readOnly || props.disabled === true} />;
}

function BuilderErrorMessage(props: BuilderErrorMessageProps) {
  const context = useContext(BuilderPrimitiveContext);
  const Component = context.components.ErrorMessage;
  return (
    <div className={primitiveClassName(props.className, "form-engine-builder__error", context.unstyled)}>
      <Component message={props.message} />
    </div>
  );
}

const GUARDED_COMPONENTS: Omit<Required<FormBuilderComponents>, "renderIcon" | "renderFieldTypeIcon"> = {
  Button: BuilderButton,
  IconButton: BuilderIconButton,
  TextInput: BuilderTextInput,
  TextArea: BuilderTextArea,
  Select: BuilderSelect,
  Checkbox: BuilderCheckbox,
  Section: BuilderSection,
  Fieldset: BuilderFieldset,
  ErrorMessage: BuilderErrorMessage
};

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

const DEFAULT_FIELD_EDITOR_CONTROL_MODE: FieldPropertyControlMode = "editable";

export function resolveFieldEditorControls(
  config: FieldEditorControlsConfig = {}
): Required<FieldEditorControlsConfig> {
  return {
    title: config.title ?? DEFAULT_FIELD_EDITOR_CONTROL_MODE,
    description: config.description ?? DEFAULT_FIELD_EDITOR_CONTROL_MODE,
    required: config.required ?? DEFAULT_FIELD_EDITOR_CONTROL_MODE,
    typeSelect: config.typeSelect ?? DEFAULT_FIELD_EDITOR_CONTROL_MODE,
    options: config.options ?? DEFAULT_FIELD_EDITOR_CONTROL_MODE,
    displayConditions: config.displayConditions ?? DEFAULT_FIELD_EDITOR_CONTROL_MODE,
    textLimits: config.textLimits ?? DEFAULT_FIELD_EDITOR_CONTROL_MODE,
    ratingBounds: config.ratingBounds ?? DEFAULT_FIELD_EDITOR_CONTROL_MODE,
    numberLimits: config.numberLimits ?? DEFAULT_FIELD_EDITOR_CONTROL_MODE
  };
}

export function resolveFieldTypeSelectOptions(
  options: readonly BuilderSelectOption<QuestionType>[],
  config: FieldTypeSelectOptionsConfig | undefined,
  context: FieldTypeSelectOptionsContext
): readonly BuilderSelectOption<QuestionType>[] {
  let resolved = [...options];
  if (config?.transform !== undefined) resolved = [...config.transform(resolved, context)];
  if (config?.order !== undefined) {
    const ranks = new Map(config.order.map((type, index) => [type, index]));
    resolved.sort((left, right) => {
      const leftRank = ranks.get(left.value) ?? config.order?.length ?? 0;
      const rightRank = ranks.get(right.value) ?? config.order?.length ?? 0;
      return leftRank - rightRank;
    });
  }
  if (config?.sort !== undefined) resolved.sort((left, right) => config.sort?.(left, right, context) ?? 0);
  return resolved;
}

const BUILDER_DEFAULTS: Readonly<Record<string, string>> = {
  "builder.formBuilder": "Form builder",
  "builder.basicSettings": "Basic settings",
  "builder.formTitle": "Form title",
  "builder.formDescription": "Form description",
  "builder.description": "Description",
  "builder.moveUp": "Move {{title}} up",
  "builder.moveDown": "Move {{title}} down",
  "builder.delete": "Delete {{title}}",
  "builder.deleteAction": "Delete",
  "builder.questionTitle": "質問文 / Question Title",
  "builder.questionTitlePlaceholder": "Example: Tell us what we could improve",
  "builder.newQuestionTitle": "New question",
  "builder.completionMessage": "Completion message",
  "builder.type": "Type",
  "builder.required": "Required",
  "builder.minimum": "Minimum",
  "builder.maximum": "Maximum",
  "builder.minimumLength": "Minimum length",
  "builder.maximumLength": "Maximum length",
  "builder.pattern": "Pattern",
  "builder.step": "Step",
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
  "builder.pages": "Page manager",
  "builder.enablePages": "Enable multi-step pages",
  "builder.addPage": "Add page",
  "builder.newPage": "New page",
  "builder.pageTitle": "Page title",
  "builder.pageDescription": "Page description",
  "builder.pageQuestion": "Question to move to the new page",
  "builder.questionPage": "Page",
  "builder.pageCondition": "Page display condition",
  "builder.unassigned": "Unassigned",
  "builder.localization": "Localization",
  "builder.defaultLocale": "Default locale",
  "builder.supportedLocales": "Supported locales",
  "builder.addLocale": "Add locale",
  "builder.editLocale": "Edit locale",
  "builder.autoTranslate": "Translate all text",
  "builder.translating": "Translating…",
  "builder.translationLocale": "Translation locale",
  "builder.selectLocale": "Select a locale to edit translations.",
  "builder.localization.selectLocaleToAdd": "Select a locale to add",
  "builder.localization.noLocalesConfigured": "Translations not configured",
  "builder.localization.localesConfiguredSummary": "{{count}} locales configured",
  "builder.localization.allLocalesAdded": "すべての候補言語が追加済みです",
  "builder.localization.maxLocalesReached": "登録可能な最大言語数（{{max}}）に達しました",
  "builder.translation": "{{locale}} translation",
  "builder.translatedFormTitle": "Translated form title",
  "builder.translatedFormDescription": "Translated form description",
  "builder.translatedCompletionMessage": "Translated completion message",
  "builder.translatedQuestionTitle": "Translated question title",
  "builder.translatedDescription": "Translated description",
  "builder.actions.moveUp": "Move up",
  "builder.actions.moveDown": "Move down",
  "builder.actions.delete": "Delete",
  "builder.actions.add": "Add",
  "builder.actions.edit": "Edit",
  "builder.actions.settings": "Settings",
  "builder.actions.translate": "Translate",
  "builder.actions.close": "Close",
  "builder.actions.dragHandle": "Reorder",
  "builder.translationUnavailable": "Provide an async translation adapter to enable automatic translation.",
  "builder.fields.selectType": "Select field type",
  "builder.fields.typeText": "Text",
  "builder.fields.typeTextarea": "Textarea",
  "builder.fields.typeNumber": "Number",
  "builder.fields.typeRating": "Rating",
  "builder.fields.typeSelect": "Select",
  "builder.fields.typeMultiSelect": "Multi-select",
  "builder.fields.typeCheckbox": "Checkbox",
  "builder.fields.typeRadio": "Radio",
  "builder.fieldCategory.text": "Text",
  "builder.fieldCategory.choice": "Choice",
  "builder.fieldCategory.number": "Number",
  "builder.fieldCategory.advanced": "Advanced",
  "builder.fieldTypeDescription.text": "A single-line text answer",
  "builder.fieldTypeDescription.textarea": "A long-form text answer",
  "builder.fieldTypeDescription.number": "A numeric answer",
  "builder.fieldTypeDescription.rating": "A rating scale answer",
  "builder.fieldTypeDescription.radio": "A single-choice answer",
  "builder.fieldTypeDescription.checkbox": "A yes/no answer",
  "builder.fieldTypeDescription.select": "A dropdown choice",
  "builder.fieldTypeDescription.multi-select": "Multiple choices",
  "builder.actions.addField": "Add question",
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
  "builder.operator.not_empty": "is not empty",
  "builder.submissionSettings": "Submission settings",
  "builder.showConfirmationBeforeSubmit": "Show confirmation before submit",
  "builder.confirmationRenderMode": "Confirmation display mode"
};

interface BuilderSectionGroupProps {
  readonly name: FormBuilderSectionName;
  readonly children: ReactNode;
}

function BuilderSectionGroup({ children }: BuilderSectionGroupProps) {
  return children;
}

function sectionGroupName(node: ReactNode): FormBuilderSectionName | undefined {
  if (!isValidElement<BuilderSectionGroupProps>(node) || node.type !== BuilderSectionGroup) return undefined;
  return node.props.name;
}

function OrderedBuilderSections({
  order,
  children
}: {
  readonly order?: readonly FormBuilderSectionName[];
  readonly children: ReactNode;
}) {
  if (order === undefined) return children;
  const ranks = new Map(order.map((name, index) => [name, index]));
  const groups = Children.toArray(children) as ReactElement<BuilderSectionGroupProps>[];
  return groups
    .map((group, index) => ({ group, index, rank: ranks.get(sectionGroupName(group) ?? "questions") ?? order.length }))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map(({ group }) => group);
}

function fieldTypeKey(type: FieldType): string {
  return (
    DEFAULT_FIELD_TYPE_DEFINITIONS.find((definition) => definition.type === type)?.labelKey ??
    `builder.fieldType.${type}`
  );
}

function operatorKey(operator: ConditionOperator): string {
  return `builder.operator.${operator}`;
}

function manualTranslationContext(
  schema: FormSchema,
  locale: string,
  target: ManualTranslationTarget,
  property: "title" | "description" | "label" | "completionMessage",
  translatedText: string
): ManualTranslationContext | undefined {
  if (target.kind === "form") {
    if (property !== "title" && property !== "description" && property !== "completionMessage") return undefined;
    return {
      locale,
      kind: "form",
      nodeId: schema.id,
      property,
      sourceText: schema[property] ?? "",
      translatedText,
      ...(schema.translationMetadata?.[locale]?.[property] === undefined
        ? {}
        : { existingTranslationMetadata: schema.translationMetadata[locale]?.[property] })
    };
  }
  if (target.id === undefined) return undefined;
  if (target.kind === "field") {
    const field = schema.fields.find((candidate) => candidate.id === target.id);
    if (field === undefined || (property !== "title" && property !== "description")) return undefined;
    return {
      locale,
      kind: "field",
      nodeId: field.id,
      property,
      sourceText: field[property] ?? "",
      translatedText,
      ...(field.translationMetadata?.[locale]?.[property] === undefined
        ? {}
        : { existingTranslationMetadata: field.translationMetadata[locale]?.[property] })
    };
  }
  if (target.kind === "page") {
    const page = schema.pages?.find((candidate) => candidate.id === target.id);
    if (page === undefined || (property !== "title" && property !== "description")) return undefined;
    return {
      locale,
      kind: "page",
      nodeId: page.id,
      property,
      sourceText: page[property] ?? "",
      translatedText,
      ...(page.translationMetadata?.[locale]?.[property] === undefined
        ? {}
        : { existingTranslationMetadata: page.translationMetadata[locale]?.[property] })
    };
  }
  if (property !== "label") return undefined;
  const option = schema.fields
    .filter((field) => "options" in field)
    .flatMap((field) => field.options)
    .find((candidate) => candidate.id === target.id);
  if (option === undefined) return undefined;
  return {
    locale,
    kind: "option",
    nodeId: option.id,
    property,
    sourceText: option.label,
    translatedText,
    ...(option.translationMetadata?.[locale]?.[property] === undefined
      ? {}
      : { existingTranslationMetadata: option.translationMetadata[locale]?.[property] })
  };
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

function conditionWithValue(questionId: string, operator: ConditionOperator, value: ConditionValue): DisplayCondition {
  return operator === "not_empty" ? { questionId, operator } : { questionId, operator, value };
}

function ConditionValueEditor({
  source,
  condition,
  onChange,
  translate,
  components
}: {
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
        value={String(condition.value ?? "")}
        onChange={update}
        options={source.options.map((option) => ({ value: option.id, label: option.label }))}
      />
    );
  }
  return (
    <TextInput
      aria-label={translate("builder.conditionValue")}
      value={typeof condition.value === "string" ? condition.value : ""}
      onChange={update}
    />
  );
}

export function resolveInitialFieldType(
  defaultType?: QuestionType,
  allowedTypes?: readonly QuestionType[]
): QuestionType | null {
  if (defaultType !== undefined && (allowedTypes === undefined || allowedTypes.includes(defaultType))) {
    return defaultType;
  }
  if (allowedTypes !== undefined && allowedTypes.length > 0) return allowedTypes[0] ?? null;
  if (allowedTypes === undefined || allowedTypes.includes("text")) return "text";
  return null;
}

export interface FormBuilderFeatures {
  readonly pages?: boolean;
  readonly localization?: boolean;
  readonly conditions?: boolean;
}

export interface FormBuilderProps {
  readonly schema: FormSchema;
  readonly onChange: (newSchema: FormSchema) => void;
  readonly locale?: string;
  readonly translator?: TranslationAdapter;
  readonly translationAdapter?: AsyncTranslationAdapter;
  readonly translationOptions?: PopulateTranslationOptions;
  readonly onTranslationReport?: (report: TranslationReport) => void;
  readonly policy?: FormPolicy;
  readonly idFactory?: (kind: "field" | "option" | "page", existingIds: ReadonlySet<string>) => string;
  readonly factories?: BuilderFactories;
  readonly className?: string;
  readonly defaultFieldType?: QuestionType;
  readonly onActionError?: (error: BuilderActionError, context: BuilderActionContext) => void;
  readonly createManualTranslationMetadata?: (
    context: ManualTranslationContext
  ) => Readonly<Record<string, JsonValue>> | undefined;
  readonly readOnly?: boolean;
  readonly features?: FormBuilderFeatures;
  readonly fieldEditorControls?: FieldEditorControlsConfig;
  readonly fieldTypeOptions?: FieldTypeSelectOptionsConfig;
  readonly components?: FormBuilderComponents;
  readonly slots?: FormBuilderSlots;
  readonly sectionOrder?: readonly FormBuilderSectionName[];
  readonly disableDefaultStyles?: boolean;
  readonly unstyled?: boolean;
  readonly fieldEditorMode?: "all" | "single";
  readonly activeFieldId?: string;
  readonly defaultActiveFieldId?: string;
  readonly onActiveFieldChange?: (fieldId: string | undefined) => void;
  readonly submissionSettingsOptions?: FormBuilderSubmissionSettingsOptions;
}

export function FormBuilder({
  schema,
  onChange,
  locale = "en",
  translator,
  translationAdapter,
  translationOptions,
  onTranslationReport,
  policy,
  idFactory,
  factories,
  className = "",
  defaultFieldType,
  onActionError,
  createManualTranslationMetadata,
  readOnly = false,
  features,
  fieldEditorControls,
  fieldTypeOptions,
  components: componentOverrides,
  slots,
  sectionOrder,
  disableDefaultStyles = false,
  unstyled = false,
  fieldEditorMode = "all",
  activeFieldId,
  defaultActiveFieldId,
  onActiveFieldChange,
  submissionSettingsOptions
}: FormBuilderProps) {
  const resolvedComponents: Required<FormBuilderComponents> = { ...DEFAULT_COMPONENTS, ...componentOverrides };
  const components: Required<FormBuilderComponents> = {
    ...GUARDED_COMPONENTS,
    renderIcon: resolvedComponents.renderIcon,
    renderFieldTypeIcon: resolvedComponents.renderFieldTypeIcon
  };
  const defaultStylesDisabled = disableDefaultStyles || unstyled;
  const builderClass = (value: string): string | undefined => (defaultStylesDisabled ? undefined : value);
  const { Button, Checkbox, ErrorMessage, Fieldset, IconButton, Section, Select, TextArea, TextInput } = components;
  const ToolbarSlot = slots?.toolbar;
  const FieldEditorSlot = slots?.fieldEditor;
  const OptionEditorSlot = slots?.optionEditor;
  const PagesSlot = slots?.pages;
  const LocalizationSlot = slots?.localization;
  const TranslationActionsSlot = slots?.translationActions;
  const resolvedSectionOrder = sectionOrder ?? slots?.sectionOrder;
  const headless = useFormBuilder({
    schema,
    onChange,
    ...(policy === undefined ? {} : { policy }),
    ...(idFactory === undefined ? {} : { idFactory }),
    ...(factories === undefined ? {} : { factories }),
    fieldEditorMode,
    ...(activeFieldId === undefined ? {} : { activeFieldId }),
    ...(defaultActiveFieldId === undefined ? {} : { defaultActiveFieldId }),
    ...(onActiveFieldChange === undefined ? {} : { onActiveFieldChange })
  });
  const [newPageQuestionId, setNewPageQuestionId] = useState("");
  const [newLocale, setNewLocale] = useState("");
  const [editingLocale, setEditingLocale] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [translationReport, setTranslationReport] = useState<TranslationReport>();
  const translate = (key: string, params: Record<string, unknown> = {}) =>
    resolveTranslation(
      key,
      BUILDER_TRANSLATION_ALIASES[key] === undefined ? [] : [BUILDER_TRANSLATION_ALIASES[key]],
      translator,
      BUILDER_DEFAULTS,
      params,
      locale
    );
  const pagesEnabled = features?.pages ?? true;
  const localizationEnabled = features?.localization ?? true;
  const conditionsEnabled = features?.conditions ?? true;
  const executeAction = (run: () => BuilderActionResult, context: BuilderActionContext): BuilderActionResult => {
    if (readOnly) return { success: true };
    const result = run();
    if (!result.success) onActionError?.(result.error, context);
    return result;
  };
  const updateField = (fieldId: string, updater: (field: FormField) => FormField, params?: Record<string, unknown>) =>
    executeAction(() => headless.updateField(fieldId, updater), {
      action: "updateField",
      targetId: fieldId,
      ...(params === undefined ? {} : { params })
    });
  const changeType = (fieldId: string, type: FieldType) =>
    executeAction(() => headless.changeFieldType(fieldId, type), {
      action: "changeFieldType",
      targetId: fieldId,
      params: { type }
    });
  const removeField = (fieldId: string) =>
    executeAction(() => headless.removeField(fieldId), { action: "removeField", targetId: fieldId });
  const initialFieldType = resolveInitialFieldType(defaultFieldType, policy?.allowedFieldTypes);
  const maxFieldsReached = policy?.maxFields !== undefined && schema.fields.length >= policy.maxFields;

  const moveField = (index: number, offset: -1 | 1) => {
    const target = index + offset;
    const field = schema.fields[index];
    if (field !== undefined) {
      executeAction(() => headless.moveField(field.id, target), {
        action: "moveField",
        targetId: field.id,
        params: { targetIndex: target }
      });
    }
  };

  const addField = () => {
    if (initialFieldType === null) return;
    executeAction(() => headless.addField(initialFieldType), { action: "addField" });
  };

  const enablePages = () => {
    if (schema.pages === undefined) executeAction(() => headless.addPage(), { action: "addPage" });
  };

  const pageForField = (fieldId: string) => schema.pages?.find((page) => page.questionIds.includes(fieldId));
  const movablePageQuestions =
    schema.pages?.flatMap((page) => (page.questionIds.length > 1 ? page.questionIds : [])) ?? [];

  const addPage = () => {
    if (schema.pages === undefined) {
      enablePages();
      return;
    }
    const questionId = movablePageQuestions.includes(newPageQuestionId) ? newPageQuestionId : movablePageQuestions[0];
    if (questionId === undefined) return;
    executeAction(() => headless.addPage(questionId), {
      action: "addPage",
      targetId: questionId,
      params: { questionId }
    });
    setNewPageQuestionId("");
  };

  const removePage = (pageIndex: number) => {
    const page = schema.pages?.[pageIndex];
    if (page !== undefined)
      executeAction(() => headless.removePage(page.id), { action: "removePage", targetId: page.id });
  };

  const movePage = (pageIndex: number, offset: -1 | 1) => {
    const target = pageIndex + offset;
    const page = schema.pages?.[pageIndex];
    if (page !== undefined) {
      executeAction(() => headless.movePage(page.id, target), {
        action: "movePage",
        targetId: page.id,
        params: { targetIndex: target }
      });
    }
  };

  const updatePage = (
    pageId: string,
    update: (page: NonNullable<FormSchema["pages"]>[number]) => NonNullable<FormSchema["pages"]>[number]
  ) => {
    executeAction(() => headless.updatePage(pageId, update), {
      action: "updatePage",
      targetId: pageId
    });
  };

  const assignFieldToPage = (fieldId: string, pageId: string) => {
    executeAction(() => headless.assignFieldToPage(fieldId, pageId), {
      action: "assignFieldToPage",
      targetId: fieldId,
      params: { pageId }
    });
  };

  const addLocale = () => {
    if (readOnly) return;
    const normalized = newLocale.trim();
    if (normalized.length === 0) return;
    const result = executeAction(() => headless.addLocale(normalized), {
      action: "addLocale",
      params: { locale: normalized }
    });
    if (!result.success) return;
    setEditingLocale(normalized);
    setNewLocale("");
  };

  const setDefaultLocale = (locale: string) =>
    executeAction(() => headless.setDefaultLocale(locale), {
      action: "setDefaultLocale",
      params: { locale }
    });

  const translateAll = async () => {
    if (readOnly || translationAdapter === undefined || editingLocale.length === 0) return;
    setIsTranslating(true);
    setTranslationError(null);
    try {
      const translationPolicy = policy ?? translationOptions?.policy;
      const populated = await populateSchemaTranslations(schema, [editingLocale], translationAdapter, {
        overwrite: "missing-only",
        ...translationOptions,
        ...(translationPolicy === undefined ? {} : { policy: translationPolicy })
      });
      onChange(populated.schema);
      setTranslationReport(populated.report);
      onTranslationReport?.(populated.report);
    } catch (cause) {
      setTranslationReport(undefined);
      setTranslationError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setIsTranslating(false);
    }
  };

  const setManualTranslation = (
    targetLocale: string,
    target: ManualTranslationTarget,
    property: "title" | "description" | "label" | "completionMessage",
    text: string
  ): BuilderActionResult => {
    if (readOnly) return { success: true };
    const normalizedLocale = targetLocale.trim();
    const context = manualTranslationContext(schema, normalizedLocale, target, property, text);
    const metadata = context === undefined ? undefined : createManualTranslationMetadata?.(context);
    return executeAction(
      () =>
        headless.setLocaleTranslation(
          normalizedLocale,
          target,
          property,
          text,
          metadata === undefined ? undefined : { metadata }
        ),
      {
        action: "setManualTranslation",
        ...(target.id === undefined ? {} : { targetId: target.id }),
        params: { locale: normalizedLocale, kind: target.kind, property }
      }
    );
  };

  const updateManualTranslation = (context: ManualTranslationContext) => {
    const target: ManualTranslationTarget =
      context.kind === "form" ? { kind: "form" } : { kind: context.kind, id: context.nodeId };
    setManualTranslation(context.locale, target, context.property, context.translatedText);
  };

  const updateFormTranslation = (property: "title" | "description" | "completionMessage", translatedText: string) => {
    if (editingLocale.length === 0) return;
    updateManualTranslation({
      locale: editingLocale,
      kind: "form",
      nodeId: schema.id,
      property,
      sourceText: schema[property] ?? "",
      translatedText,
      ...(schema.translationMetadata?.[editingLocale]?.[property] === undefined
        ? {}
        : { existingTranslationMetadata: schema.translationMetadata[editingLocale]?.[property] })
    });
  };

  const setSourceText = (target: BuilderTextTarget, property: string, text: string) =>
    executeAction(() => headless.setSourceText(target, property, text), {
      action: "setSourceText",
      ...(target.id === undefined ? {} : { targetId: target.id }),
      params: { kind: target.kind, property }
    });
  const updateOption = (fieldId: string, optionId: string, label: string) =>
    executeAction(() => headless.updateOption(fieldId, optionId, (option) => ({ ...option, label })), {
      action: "updateOption",
      targetId: optionId,
      params: { fieldId }
    });
  const addOption = (fieldId: string) =>
    executeAction(() => headless.addOption(fieldId), { action: "addOption", targetId: fieldId });
  const removeOption = (fieldId: string, optionId: string) =>
    executeAction(() => headless.removeOption(fieldId, optionId), {
      action: "removeOption",
      targetId: optionId,
      params: { fieldId }
    });
  const moveOption = (fieldId: string, optionId: string, targetIndex: number) =>
    executeAction(() => headless.moveOption(fieldId, optionId, targetIndex), {
      action: "moveOption",
      targetId: optionId,
      params: { fieldId, targetIndex }
    });
  const setDisplayCondition = (fieldId: string, condition?: DisplayCondition) =>
    executeAction(() => headless.setDisplayCondition(fieldId, condition), {
      action: "setDisplayCondition",
      targetId: fieldId,
      ...(condition === undefined ? {} : { params: { condition } })
    });
  const registeredLocales = new Set([
    ...(schema.defaultLocale === undefined ? [] : [schema.defaultLocale]),
    ...(schema.supportedLocales ?? [])
  ]);
  const availableAllowedLocales = policy?.allowedLocales?.filter((candidate) => !registeredLocales.has(candidate));
  const localeLimitReached = policy?.maxLocales !== undefined && registeredLocales.size >= policy.maxLocales;
  const actions: BuilderSlotActions = {
    addField: (type, pageId) =>
      executeAction(() => headless.addField(type, pageId), {
        action: "addField",
        ...(pageId === undefined ? { params: { type } } : { targetId: pageId, params: { type, pageId } })
      }),
    removeField: (fieldId) =>
      executeAction(() => headless.removeField(fieldId), { action: "removeField", targetId: fieldId }),
    moveField: (fieldId, targetIndex) =>
      executeAction(() => headless.moveField(fieldId, targetIndex), {
        action: "moveField",
        targetId: fieldId,
        params: { targetIndex }
      }),
    updateField: (fieldId, updater) =>
      executeAction(() => headless.updateField(fieldId, updater), { action: "updateField", targetId: fieldId }),
    changeFieldType: (fieldId, type) =>
      executeAction(() => headless.changeFieldType(fieldId, type), {
        action: "changeFieldType",
        targetId: fieldId,
        params: { type }
      }),
    addOption: (fieldId) =>
      executeAction(() => headless.addOption(fieldId), { action: "addOption", targetId: fieldId }),
    updateOption: (fieldId, optionId, updater) =>
      executeAction(() => headless.updateOption(fieldId, optionId, updater), {
        action: "updateOption",
        targetId: optionId,
        params: { fieldId }
      }),
    removeOption: (fieldId, optionId) =>
      executeAction(() => headless.removeOption(fieldId, optionId), {
        action: "removeOption",
        targetId: optionId,
        params: { fieldId }
      }),
    moveOption: (fieldId, optionId, targetIndex) =>
      executeAction(() => headless.moveOption(fieldId, optionId, targetIndex), {
        action: "moveOption",
        targetId: optionId,
        params: { fieldId, targetIndex }
      }),
    addPage: (questionId) =>
      executeAction(() => headless.addPage(questionId), {
        action: "addPage",
        ...(questionId === undefined ? {} : { targetId: questionId, params: { questionId } })
      }),
    updatePage: (pageId, updater) =>
      executeAction(() => headless.updatePage(pageId, updater), { action: "updatePage", targetId: pageId }),
    removePage: (pageId) =>
      executeAction(() => headless.removePage(pageId), { action: "removePage", targetId: pageId }),
    movePage: (pageId, targetIndex) =>
      executeAction(() => headless.movePage(pageId, targetIndex), {
        action: "movePage",
        targetId: pageId,
        params: { targetIndex }
      }),
    assignFieldToPage: (fieldId, pageId) =>
      executeAction(() => headless.assignFieldToPage(fieldId, pageId), {
        action: "assignFieldToPage",
        targetId: fieldId,
        params: { pageId }
      }),
    setDisplayCondition: (fieldId, condition) =>
      executeAction(() => headless.setDisplayCondition(fieldId, condition), {
        action: "setDisplayCondition",
        targetId: fieldId,
        ...(condition === undefined ? {} : { params: { condition } })
      }),
    setSourceText: (target, property, text) =>
      executeAction(() => headless.setSourceText(target, property, text), {
        action: "setSourceText",
        ...(target.id === undefined ? {} : { targetId: target.id }),
        params: { property, text }
      }),
    setLocaleTranslation: (targetLocale, target, property, text, options) =>
      executeAction(() => headless.setLocaleTranslation(targetLocale, target, property, text, options), {
        action: "setLocaleTranslation",
        ...(target.id === undefined ? {} : { targetId: target.id }),
        params: { locale: targetLocale, property }
      }),
    setManualTranslation,
    addLocale: (targetLocale) =>
      executeAction(() => headless.addLocale(targetLocale), {
        action: "addLocale",
        params: { locale: targetLocale }
      }),
    setDefaultLocale: (targetLocale) =>
      executeAction(() => headless.setDefaultLocale(targetLocale), {
        action: "setDefaultLocale",
        params: { locale: targetLocale }
      })
  };

  return (
    <BuilderPrimitiveContext.Provider
      value={{ components: resolvedComponents, readOnly, unstyled: defaultStylesDisabled }}
    >
      <Section
        className={defaultStylesDisabled ? className || undefined : `form-engine-builder ${className}`.trim()}
        aria-label={translate("builder.formBuilder")}
        onClickCapture={(event) => {
          if (readOnly) return;
          if (!(event.target instanceof HTMLElement)) return;
          const actionTarget = event.target.closest<HTMLElement>("[data-builder-action]");
          if (actionTarget?.dataset.builderAction === "addField" && maxFieldsReached && initialFieldType !== null)
            addField();
          if (actionTarget?.dataset.builderAction === "addLocale" && localeLimitReached && newLocale.trim().length > 0)
            addLocale();
          if (actionTarget?.dataset.builderAction !== "addOption") return;
          const fieldId = actionTarget.dataset.targetId;
          const field = schema.fields.find((candidate) => candidate.id === fieldId);
          if (
            fieldId !== undefined &&
            field !== undefined &&
            "options" in field &&
            policy?.maxOptionsPerField !== undefined &&
            field.options.length >= policy.maxOptionsPerField
          ) {
            addOption(fieldId);
          }
        }}
      >
        <Fieldset className={builderClass("form-engine-builder__controls")} disabled={readOnly}>
          <OrderedBuilderSections {...(resolvedSectionOrder === undefined ? {} : { order: resolvedSectionOrder })}>
            <BuilderSectionGroup name="basicSettings">
              <Section
                className={builderClass("form-engine-builder__basic-settings")}
                headingId="builder-basic-settings-heading"
                title={translate("builder.basicSettings")}
              >
                <div className={builderClass("form-engine-builder__grid")}>
                  <div className={builderClass("form-engine-builder__field")}>
                    <TextInput
                      id="builder-form-title"
                      name="title"
                      label={translate("builder.formTitle")}
                      required
                      error={schema.title.trim().length === 0}
                      helperText={schema.title.trim().length === 0 ? translate("builder.required") : ""}
                      aria-describedby={schema.title.trim().length === 0 ? "builder-form-title-error" : undefined}
                      value={schema.title}
                      onChange={(value) => setSourceText({ kind: "form" }, "title", value)}
                    />
                  </div>
                  <div className={builderClass("form-engine-builder__field")}>
                    <TextArea
                      id="builder-form-description"
                      name="description"
                      label={translate("builder.formDescription")}
                      rows={3}
                      value={schema.description ?? ""}
                      onChange={(value) => setSourceText({ kind: "form" }, "description", value)}
                    />
                  </div>
                </div>
              </Section>
            </BuilderSectionGroup>
            <BuilderSectionGroup name="submissionSettings">
              {submissionSettingsOptions?.enabled ? (
                <Section
                  className={builderClass("form-engine-builder__submission-settings")}
                  title={translate("builder.submissionSettings")}
                >
                  <Checkbox
                    id="builder-show-confirmation"
                    label={translate("builder.showConfirmationBeforeSubmit")}
                    checked={schema.submissionSettings?.showConfirmationBeforeSubmit === true}
                    onChange={(checked) =>
                      onChange({
                        ...schema,
                        submissionSettings: { ...schema.submissionSettings, showConfirmationBeforeSubmit: checked }
                      })
                    }
                  />
                  <Select
                    id="builder-confirmation-render-mode"
                    label={translate("builder.confirmationRenderMode")}
                    value={schema.submissionSettings?.confirmationRenderMode ?? "inline"}
                    options={[
                      { value: "dialog", label: "Dialog" },
                      { value: "inline", label: "Inline" },
                      { value: "replace", label: "Replace" }
                    ]}
                    onChange={(value) => {
                      if (value !== "dialog" && value !== "inline" && value !== "replace") return;
                      onChange({
                        ...schema,
                        submissionSettings: { ...schema.submissionSettings, confirmationRenderMode: value }
                      });
                    }}
                  />
                </Section>
              ) : null}
            </BuilderSectionGroup>
            {resolvedSectionOrder === undefined ? null : (
              <BuilderSectionGroup name="completionMessage">
                <Section headingId="builder-completion-message-heading" title={translate("builder.completionMessage")}>
                  <TextInput
                    id="builder-completion-message"
                    label={translate("builder.completionMessage")}
                    value={schema.completionMessage ?? ""}
                    onChange={(value) => setSourceText({ kind: "form" }, "completionMessage", value)}
                  />
                </Section>
              </BuilderSectionGroup>
            )}
            <BuilderSectionGroup name="questions">
              {pagesEnabled ? (
                PagesSlot === undefined ? (
                  <Section
                    className={builderClass("form-engine-builder__pages")}
                    headingId="builder-pages-heading"
                    title={translate("builder.pages")}
                  >
                    {schema.pages === undefined ? (
                      <Button onClick={enablePages}>{translate("builder.enablePages")}</Button>
                    ) : (
                      <>
                        {schema.pages.map((page, pageIndex) => {
                          const priorQuestionIds = new Set(
                            schema.pages?.slice(0, pageIndex).flatMap((item) => item.questionIds)
                          );
                          const availableSources = schema.fields.filter((field) => priorQuestionIds.has(field.id));
                          const source = schema.fields.find((field) => field.id === page.displayCondition?.questionId);
                          return (
                            <Fieldset
                              className={builderClass("form-engine-builder__page")}
                              legend={page.title ?? `${translate("builder.newPage")} ${pageIndex + 1}`}
                              key={page.id}
                            >
                              <div className={builderClass("form-engine-builder__toolbar")}>
                                {ToolbarSlot === undefined ? (
                                  <>
                                    <IconButton
                                      actionType="moveUp"
                                      title={translate("builder.moveUp", { title: page.title ?? page.id })}
                                      disabled={pageIndex === 0}
                                      onClick={() => movePage(pageIndex, -1)}
                                    />
                                    <IconButton
                                      actionType="moveDown"
                                      title={translate("builder.moveDown", { title: page.title ?? page.id })}
                                      disabled={pageIndex === (schema.pages?.length ?? 0) - 1}
                                      onClick={() => movePage(pageIndex, 1)}
                                    />
                                    <IconButton
                                      actionType="delete"
                                      title={translate("builder.delete", { title: page.title ?? page.id })}
                                      onClick={() => removePage(pageIndex)}
                                    />
                                  </>
                                ) : (
                                  <ToolbarSlot
                                    schema={schema}
                                    translate={translate}
                                    kind="page"
                                    targetId={page.id}
                                    index={pageIndex}
                                    total={schema.pages?.length ?? 0}
                                    title={page.title ?? page.id}
                                    onMoveUp={() => movePage(pageIndex, -1)}
                                    onMoveDown={() => movePage(pageIndex, 1)}
                                    onRemove={() => removePage(pageIndex)}
                                    readOnly={readOnly}
                                    actions={actions}
                                    components={components}
                                  />
                                )}
                              </div>
                              <div className={builderClass("form-engine-builder__grid")}>
                                <div className={builderClass("form-engine-builder__field")}>
                                  <TextInput
                                    id={`builder-page-${page.id}-title`}
                                    label={translate("builder.pageTitle")}
                                    value={page.title ?? ""}
                                    onChange={(value) => {
                                      updatePage(page.id, (current) => {
                                        if (value.length > 0) return { ...current, title: value };
                                        const { title: _title, ...withoutTitle } = current;
                                        return withoutTitle;
                                      });
                                    }}
                                  />
                                </div>
                                <div className={builderClass("form-engine-builder__field")}>
                                  <TextInput
                                    id={`builder-page-${page.id}-description`}
                                    label={translate("builder.pageDescription")}
                                    value={page.description ?? ""}
                                    onChange={(value) => {
                                      updatePage(page.id, (current) => {
                                        if (value.length > 0) return { ...current, description: value };
                                        const { description: _description, ...withoutDescription } = current;
                                        return withoutDescription;
                                      });
                                    }}
                                  />
                                </div>
                              </div>
                              {!localizationEnabled || editingLocale.length === 0 ? null : (
                                <div className={builderClass("form-engine-builder__translation-editor")}>
                                  <strong>{editingLocale}</strong>
                                  <div className={builderClass("form-engine-builder__grid")}>
                                    <div className={builderClass("form-engine-builder__field")}>
                                      <TextInput
                                        id={`builder-page-${page.id}-${editingLocale}-title`}
                                        label={translate("builder.pageTitle")}
                                        value={page.translations?.[editingLocale]?.title ?? ""}
                                        onChange={(value) =>
                                          updateManualTranslation({
                                            locale: editingLocale,
                                            kind: "page",
                                            nodeId: page.id,
                                            property: "title",
                                            sourceText: page.title ?? "",
                                            translatedText: value,
                                            ...(page.translationMetadata?.[editingLocale]?.title === undefined
                                              ? {}
                                              : {
                                                  existingTranslationMetadata:
                                                    page.translationMetadata[editingLocale]?.title
                                                })
                                          })
                                        }
                                      />
                                    </div>
                                    <div className={builderClass("form-engine-builder__field")}>
                                      <TextInput
                                        id={`builder-page-${page.id}-${editingLocale}-description`}
                                        label={translate("builder.pageDescription")}
                                        value={page.translations?.[editingLocale]?.description ?? ""}
                                        onChange={(value) =>
                                          updateManualTranslation({
                                            locale: editingLocale,
                                            kind: "page",
                                            nodeId: page.id,
                                            property: "description",
                                            sourceText: page.description ?? "",
                                            translatedText: value,
                                            ...(page.translationMetadata?.[editingLocale]?.description === undefined
                                              ? {}
                                              : {
                                                  existingTranslationMetadata:
                                                    page.translationMetadata[editingLocale]?.description
                                                })
                                          })
                                        }
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                              {conditionsEnabled ? (
                                <div className={builderClass("form-engine-builder__condition")}>
                                  <div className={builderClass("form-engine-builder__field")}>
                                    <Select
                                      id={`builder-page-${page.id}-condition`}
                                      label={translate("builder.pageCondition")}
                                      value={page.displayCondition?.questionId ?? ""}
                                      onChange={(value) => {
                                        const selected = schema.fields.find((field) => field.id === value);
                                        updatePage(page.id, (current) => {
                                          if (selected === undefined) {
                                            const { displayCondition: _condition, ...withoutCondition } = current;
                                            return withoutCondition;
                                          }
                                          return {
                                            ...current,
                                            displayCondition: conditionWithValue(
                                              selected.id,
                                              conditionOperators(selected)[0] ?? "not_empty",
                                              defaultConditionValue(selected)
                                            )
                                          };
                                        });
                                      }}
                                      options={[
                                        { value: "", label: translate("builder.alwaysVisible") },
                                        ...availableSources.map((field) => ({ value: field.id, label: field.title }))
                                      ]}
                                    />
                                  </div>
                                  {page.displayCondition !== undefined && source !== undefined ? (
                                    <>
                                      <Select
                                        aria-label={translate("builder.conditionOperator")}
                                        value={page.displayCondition.operator}
                                        onChange={(value) => {
                                          const operator = value as ConditionOperator;
                                          updatePage(page.id, (current) => ({
                                            ...current,
                                            displayCondition: conditionWithValue(
                                              source.id,
                                              operator,
                                              defaultConditionValue(source)
                                            )
                                          }));
                                        }}
                                        options={conditionOperators(source).map((operator) => ({
                                          value: operator,
                                          label: translate(operatorKey(operator))
                                        }))}
                                      />
                                      <ConditionValueEditor
                                        source={source}
                                        condition={page.displayCondition}
                                        onChange={(condition) =>
                                          updatePage(page.id, (current) => ({
                                            ...current,
                                            displayCondition: condition
                                          }))
                                        }
                                        translate={translate}
                                        components={components}
                                      />
                                    </>
                                  ) : null}
                                </div>
                              ) : null}
                            </Fieldset>
                          );
                        })}
                        <div className={builderClass("form-engine-builder__page-add")}>
                          <div className={builderClass("form-engine-builder__field")}>
                            <Select
                              id="builder-page-question"
                              label={translate("builder.pageQuestion")}
                              value={newPageQuestionId}
                              disabled={movablePageQuestions.length === 0}
                              onChange={setNewPageQuestionId}
                              options={[
                                { value: "", label: "—" },
                                ...schema.fields
                                  .filter((field) => movablePageQuestions.includes(field.id))
                                  .map((field) => ({ value: field.id, label: field.title }))
                              ]}
                            />
                          </div>
                          <Button disabled={movablePageQuestions.length === 0} onClick={addPage}>
                            {translate("builder.addPage")}
                          </Button>
                        </div>
                      </>
                    )}
                  </Section>
                ) : (
                  <PagesSlot
                    schema={schema}
                    translate={translate}
                    currentLocale={editingLocale}
                    {...(features === undefined ? {} : { features })}
                    readOnly={readOnly}
                    actions={actions}
                    components={components}
                  />
                )
              ) : null}
            </BuilderSectionGroup>

            <BuilderSectionGroup name="localization">
              {localizationEnabled ? (
                LocalizationSlot === undefined ? (
                  <Section
                    className={builderClass("form-engine-builder__localization")}
                    headingId="builder-localization-heading"
                    title={translate("builder.localization")}
                  >
                    {resolvedSectionOrder === undefined ? (
                      <div className={builderClass("form-engine-builder__field")}>
                        <TextInput
                          id="builder-completion-message"
                          label={translate("builder.completionMessage")}
                          value={schema.completionMessage ?? ""}
                          onChange={(value) => setSourceText({ kind: "form" }, "completionMessage", value)}
                        />
                      </div>
                    ) : null}
                    <div className={builderClass("form-engine-builder__grid")}>
                      <div className={builderClass("form-engine-builder__field")}>
                        <TextInput
                          id="builder-default-locale"
                          label={translate("builder.defaultLocale")}
                          value={schema.defaultLocale ?? ""}
                          onChange={setDefaultLocale}
                        />
                      </div>
                      <div className={builderClass("form-engine-builder__field")}>
                        {availableAllowedLocales === undefined ? (
                          <TextInput
                            id="builder-new-locale"
                            label={translate("builder.addLocale")}
                            value={newLocale}
                            onChange={setNewLocale}
                          />
                        ) : (
                          <Select
                            id="builder-new-locale"
                            label={translate("builder.addLocale")}
                            value={newLocale}
                            onChange={setNewLocale}
                            options={[
                              { value: "", label: "—" },
                              ...availableAllowedLocales.map((candidate) => ({ value: candidate, label: candidate }))
                            ]}
                          />
                        )}
                      </div>
                      <Button
                        action="addLocale"
                        disabled={newLocale.trim().length === 0 || localeLimitReached}
                        onClick={addLocale}
                      >
                        {translate("builder.addLocale")}
                      </Button>
                      <div className={builderClass("form-engine-builder__field")}>
                        <Select
                          id="builder-edit-locale"
                          label={translate("builder.editLocale")}
                          value={editingLocale}
                          onChange={setEditingLocale}
                          options={[
                            { value: "", label: "—" },
                            ...(schema.supportedLocales ?? [])
                              .filter((item) => item !== schema.defaultLocale)
                              .map((item) => ({ value: item, label: item }))
                          ]}
                        />
                      </div>
                      {TranslationActionsSlot === undefined ? (
                        <Button
                          disabled={translationAdapter === undefined || editingLocale.length === 0 || isTranslating}
                          onClick={() => void translateAll()}
                        >
                          {translate("builder.autoTranslate")}
                        </Button>
                      ) : (
                        <TranslationActionsSlot
                          schema={schema}
                          translate={translate}
                          currentLocale={editingLocale}
                          onAutoTranslate={() => void translateAll()}
                          isTranslating={isTranslating}
                          {...(translationError === null ? {} : { translationError })}
                          {...(translationReport === undefined ? {} : { translationReport })}
                          onClearTranslationError={() => setTranslationError(null)}
                          translationAdapterAvailable={translationAdapter !== undefined}
                          readOnly={readOnly}
                          actions={actions}
                          components={components}
                        />
                      )}
                    </div>
                    {translationAdapter === undefined ? <p>{translate("builder.translationUnavailable")}</p> : null}
                    {translationError === null ? null : <ErrorMessage message={translationError} />}
                    {editingLocale.length === 0 ? null : (
                      <div className={builderClass("form-engine-builder__grid")}>
                        <div className={builderClass("form-engine-builder__field")}>
                          <TextInput
                            id={`builder-${editingLocale}-form-title`}
                            label={translate("builder.questionTitle")}
                            value={schema.translations?.[editingLocale]?.title ?? ""}
                            onChange={(value) => updateFormTranslation("title", value)}
                          />
                        </div>
                        <div className={builderClass("form-engine-builder__field")}>
                          <TextInput
                            id={`builder-${editingLocale}-form-description`}
                            label={translate("builder.pageDescription")}
                            value={schema.translations?.[editingLocale]?.description ?? ""}
                            onChange={(value) => updateFormTranslation("description", value)}
                          />
                        </div>
                        <div className={builderClass("form-engine-builder__field")}>
                          <TextInput
                            id={`builder-${editingLocale}-completion-message`}
                            label={translate("builder.completionMessage")}
                            value={schema.translations?.[editingLocale]?.completionMessage ?? ""}
                            onChange={(value) => updateFormTranslation("completionMessage", value)}
                          />
                        </div>
                      </div>
                    )}
                  </Section>
                ) : (
                  <LocalizationSlot
                    schema={schema}
                    translate={translate}
                    currentLocale={editingLocale}
                    onCurrentLocaleChange={setEditingLocale}
                    onAutoTranslate={() => void translateAll()}
                    isTranslating={isTranslating}
                    {...(translationError === null ? {} : { translationError })}
                    {...(policy === undefined ? {} : { policy })}
                    translationAdapterAvailable={translationAdapter !== undefined}
                    readOnly={readOnly}
                    actions={actions}
                    components={components}
                  />
                )
              ) : null}
            </BuilderSectionGroup>

            <BuilderSectionGroup name="questions">
              <div className={builderClass("form-engine-builder__list")}>
                {schema.fields.map((field, index) => {
                  const controls = resolveFieldEditorControls(fieldEditorControls);
                  const editorState = headless.getFieldEditorProps?.(field.id) ?? {
                    isActive: true,
                    isVisible: true,
                    onSelect: () => undefined
                  };
                  const condition = field.displayCondition;
                  const source =
                    condition === undefined
                      ? undefined
                      : schema.fields.find((item) => item.id === condition.questionId);
                  const availableSources = schema.fields.slice(0, index);
                  if (!editorState.isVisible) {
                    return (
                      <div
                        key={field.id}
                        className={builderClass("form-engine-builder__question-preview")}
                        data-field-id={field.id}
                      >
                        <button type="button" onClick={editorState.onSelect}>
                          {field.title}
                        </button>
                      </div>
                    );
                  }
                  if (FieldEditorSlot !== undefined) {
                    return (
                      <FieldEditorSlot
                        key={field.id}
                        schema={schema}
                        field={field}
                        index={index}
                        currentLocale={editingLocale}
                        translate={translate}
                        {...(slots === undefined ? {} : { slots })}
                        {...(policy === undefined ? {} : { policy })}
                        {...(features === undefined ? {} : { features })}
                        {...(fieldEditorControls === undefined ? {} : { fieldEditorControls })}
                        {...(fieldTypeOptions === undefined ? {} : { fieldTypeOptions })}
                        readOnly={readOnly}
                        actions={actions}
                        components={components}
                      />
                    );
                  }
                  return (
                    <Fieldset
                      className={builderClass("form-engine-builder__question")}
                      legend={field.title}
                      key={field.id}
                    >
                      <div className={builderClass("form-engine-builder__toolbar")}>
                        {ToolbarSlot === undefined ? (
                          <>
                            <IconButton
                              actionType="moveUp"
                              title={translate("builder.moveUp", { title: field.title })}
                              disabled={index === 0}
                              onClick={() => moveField(index, -1)}
                            />
                            <IconButton
                              actionType="moveDown"
                              title={translate("builder.moveDown", { title: field.title })}
                              disabled={index === schema.fields.length - 1}
                              onClick={() => moveField(index, 1)}
                            />
                            <IconButton
                              actionType="delete"
                              disabled={schema.fields.length === 1}
                              onClick={() => removeField(field.id)}
                              aria-label={translate("builder.delete", { title: field.title })}
                              title={translate("builder.delete", { title: field.title })}
                            />
                          </>
                        ) : (
                          <ToolbarSlot
                            schema={schema}
                            translate={translate}
                            kind="field"
                            targetId={field.id}
                            index={index}
                            total={schema.fields.length}
                            title={field.title}
                            onMoveUp={() => moveField(index, -1)}
                            onMoveDown={() => moveField(index, 1)}
                            onRemove={() => removeField(field.id)}
                            readOnly={readOnly}
                            actions={actions}
                            components={components}
                          />
                        )}
                      </div>
                      <div className={builderClass("form-engine-builder__grid")}>
                        {controls.title === "hidden" ? null : (
                          <div className={builderClass("form-engine-builder__field")}>
                            <TextInput
                              id={`builder-field-${field.id}-title`}
                              name={`fields.${field.id}.title`}
                              label={translate("builder.questionTitle")}
                              required={true}
                              error={field.title.trim().length === 0}
                              helperText={field.title.trim().length === 0 ? translate("builder.required") : ""}
                              aria-describedby={
                                field.title.trim().length === 0 ? `builder-field-${field.id}-title-error` : undefined
                              }
                              value={field.title}
                              placeholder={translate("builder.questionTitlePlaceholder")}
                              readOnly={controls.title === "readOnly"}
                              onChange={(value) =>
                                updateField(field.id, (current) => ({
                                  ...current,
                                  title: value.trim().length === 0 ? current.title : value
                                }))
                              }
                            />
                          </div>
                        )}
                        {controls.typeSelect === "hidden" ? null : (
                          <div className={builderClass("form-engine-builder__field")}>
                            <Select
                              id={`builder-field-${field.id}-type`}
                              label={translate("builder.type")}
                              value={field.type}
                              disabled={controls.typeSelect === "readOnly"}
                              onChange={(value) => changeType(field.id, value as FieldType)}
                              options={resolveFieldTypeSelectOptions(
                                FIELD_TYPES.filter(
                                  (type) =>
                                    policy?.allowedFieldTypes === undefined || policy.allowedFieldTypes.includes(type)
                                ).map((type) => ({ value: type, label: translate(fieldTypeKey(type)) })),
                                fieldTypeOptions,
                                { currentType: field.type, allowedTypes: policy?.allowedFieldTypes ?? FIELD_TYPES }
                              )}
                            />
                          </div>
                        )}
                        {controls.required === "hidden" ? null : (
                          <Checkbox
                            className={builderClass("form-engine-builder__check")}
                            checked={field.required === true}
                            disabled={controls.required === "readOnly"}
                            onChange={(checked) =>
                              updateField(field.id, (current) => ({ ...current, required: checked }))
                            }
                            label={translate("builder.required")}
                          />
                        )}
                      </div>

                      {controls.description === "hidden" ? null : (
                        <div className={builderClass("form-engine-builder__field")}>
                          <TextArea
                            id={`builder-field-${field.id}-description`}
                            name={`fields.${field.id}.description`}
                            label={translate("builder.description")}
                            value={field.description ?? ""}
                            readOnly={controls.description === "readOnly"}
                            onChange={(value) =>
                              updateField(field.id, (current) => {
                                if (value.length > 0) return { ...current, description: value };
                                const { description: _description, ...remaining } = current;
                                return remaining;
                              })
                            }
                          />
                        </div>
                      )}

                      {!pagesEnabled || schema.pages === undefined ? null : (
                        <div className={builderClass("form-engine-builder__field")}>
                          <Select
                            id={`builder-field-${field.id}-page`}
                            label={translate("builder.questionPage")}
                            value={pageForField(field.id)?.id ?? ""}
                            onChange={(value) => assignFieldToPage(field.id, value)}
                            options={schema.pages.map((page, pageIndex) => ({
                              value: page.id,
                              label: page.title ?? `${translate("builder.newPage")} ${pageIndex + 1}`
                            }))}
                          />
                        </div>
                      )}

                      {!localizationEnabled || editingLocale.length === 0 ? null : (
                        <div className={builderClass("form-engine-builder__translation-editor")}>
                          <strong>{editingLocale}</strong>
                          <div className={builderClass("form-engine-builder__grid")}>
                            <div className={builderClass("form-engine-builder__field")}>
                              <TextInput
                                id={`builder-field-${field.id}-${editingLocale}-title`}
                                label={translate("builder.questionTitle")}
                                value={field.translations?.[editingLocale]?.title ?? ""}
                                onChange={(value) =>
                                  updateManualTranslation({
                                    locale: editingLocale,
                                    kind: "field",
                                    nodeId: field.id,
                                    property: "title",
                                    sourceText: field.title,
                                    translatedText: value,
                                    ...(field.translationMetadata?.[editingLocale]?.title === undefined
                                      ? {}
                                      : {
                                          existingTranslationMetadata: field.translationMetadata[editingLocale]?.title
                                        })
                                  })
                                }
                              />
                            </div>
                            {controls.description === "hidden" ? null : (
                              <div className={builderClass("form-engine-builder__field")}>
                                <TextInput
                                  id={`builder-field-${field.id}-${editingLocale}-description`}
                                  label={translate("builder.pageDescription")}
                                  value={field.translations?.[editingLocale]?.description ?? ""}
                                  readOnly={controls.description === "readOnly"}
                                  onChange={(value) =>
                                    updateManualTranslation({
                                      locale: editingLocale,
                                      kind: "field",
                                      nodeId: field.id,
                                      property: "description",
                                      sourceText: field.description ?? "",
                                      translatedText: value,
                                      ...(field.translationMetadata?.[editingLocale]?.description === undefined
                                        ? {}
                                        : {
                                            existingTranslationMetadata:
                                              field.translationMetadata[editingLocale]?.description
                                          })
                                    })
                                  }
                                />
                              </div>
                            )}
                          </div>
                          {"options" in field
                            ? field.options.map((option, optionIndex) => (
                                <div className={builderClass("form-engine-builder__field")} key={option.id}>
                                  <TextInput
                                    id={`builder-option-${option.id}-${editingLocale}`}
                                    label={`${translate("builder.optionLabel", { index: optionIndex + 1 })} (${editingLocale})`}
                                    value={option.translations?.[editingLocale] ?? ""}
                                    onChange={(value) =>
                                      updateManualTranslation({
                                        locale: editingLocale,
                                        kind: "option",
                                        nodeId: option.id,
                                        property: "label",
                                        sourceText: option.label,
                                        translatedText: value,
                                        ...(option.translationMetadata?.[editingLocale]?.label === undefined
                                          ? {}
                                          : {
                                              existingTranslationMetadata:
                                                option.translationMetadata[editingLocale]?.label
                                            })
                                      })
                                    }
                                  />
                                </div>
                              ))
                            : null}
                        </div>
                      )}

                      {field.type === "rating" && controls.ratingBounds !== "hidden" ? (
                        <div className={builderClass("form-engine-builder__grid")}>
                          <div className={builderClass("form-engine-builder__field")}>
                            <TextInput
                              id={`builder-field-${field.id}-minimum`}
                              label={translate("builder.minimum")}
                              type="number"
                              value={String(field.min ?? 1)}
                              readOnly={controls.ratingBounds === "readOnly"}
                              onChange={(value) => {
                                const min = Number(value);
                                if (!Number.isInteger(min)) return;
                                updateField(field.id, (current) =>
                                  current.type === "rating"
                                    ? { ...current, min, max: Math.max(min, current.max ?? 5) }
                                    : current
                                );
                              }}
                            />
                          </div>
                          <div className={builderClass("form-engine-builder__field")}>
                            <TextInput
                              id={`builder-field-${field.id}-maximum`}
                              label={translate("builder.maximum")}
                              type="number"
                              value={String(field.max ?? 5)}
                              readOnly={controls.ratingBounds === "readOnly"}
                              onChange={(value) => {
                                const max = Number(value);
                                if (!Number.isInteger(max)) return;
                                updateField(field.id, (current) =>
                                  current.type === "rating"
                                    ? { ...current, min: Math.min(current.min ?? 1, max), max }
                                    : current
                                );
                              }}
                            />
                          </div>
                        </div>
                      ) : null}

                      {(field.type === "text" || field.type === "textarea") && controls.textLimits !== "hidden" ? (
                        <div className={builderClass("form-engine-builder__grid")}>
                          <div className={builderClass("form-engine-builder__field")}>
                            <TextInput
                              id={`builder-field-${field.id}-min-length`}
                              label={translate("builder.minimumLength")}
                              type="number"
                              value={field.minLength === undefined ? "" : String(field.minLength)}
                              readOnly={controls.textLimits === "readOnly"}
                              onChange={(value) =>
                                updateField(field.id, (current) => {
                                  if (current.type !== "text" && current.type !== "textarea") return current;
                                  const parsed = value.trim().length === 0 ? undefined : Number(value);
                                  return parsed === undefined || !Number.isInteger(parsed) || parsed < 0
                                    ? current
                                    : { ...current, minLength: parsed };
                                })
                              }
                            />
                          </div>
                          <div className={builderClass("form-engine-builder__field")}>
                            <TextInput
                              id={`builder-field-${field.id}-max-length`}
                              label={translate("builder.maximumLength")}
                              type="number"
                              value={field.maxLength === undefined ? "" : String(field.maxLength)}
                              readOnly={controls.textLimits === "readOnly"}
                              onChange={(value) =>
                                updateField(field.id, (current) => {
                                  if (current.type !== "text" && current.type !== "textarea") return current;
                                  const parsed = value.trim().length === 0 ? undefined : Number(value);
                                  return parsed === undefined || !Number.isInteger(parsed) || parsed < 0
                                    ? current
                                    : { ...current, maxLength: parsed };
                                })
                              }
                            />
                          </div>
                          <div className={builderClass("form-engine-builder__field")}>
                            <TextInput
                              id={`builder-field-${field.id}-pattern`}
                              label={translate("builder.pattern")}
                              value={field.pattern ?? ""}
                              readOnly={controls.textLimits === "readOnly"}
                              onChange={(value) =>
                                updateField(field.id, (current) => {
                                  if (current.type !== "text" && current.type !== "textarea") return current;
                                  return value.length === 0 ? current : { ...current, pattern: value };
                                })
                              }
                            />
                          </div>
                        </div>
                      ) : null}

                      {field.type === "number" && controls.numberLimits !== "hidden" ? (
                        <div className={builderClass("form-engine-builder__grid")}>
                          {(["min", "max", "step"] as const).map((property) => (
                            <div className={builderClass("form-engine-builder__field")} key={property}>
                              <TextInput
                                id={`builder-field-${field.id}-${property}`}
                                label={translate(
                                  property === "step"
                                    ? "builder.step"
                                    : property === "min"
                                      ? "builder.minimum"
                                      : "builder.maximum"
                                )}
                                type="number"
                                value={field[property] === undefined ? "" : String(field[property])}
                                readOnly={controls.numberLimits === "readOnly"}
                                onChange={(value) =>
                                  updateField(field.id, (current) => {
                                    if (current.type !== "number") return current;
                                    if (value.trim().length === 0) {
                                      const { [property]: _removed, ...remaining } = current;
                                      return remaining;
                                    }
                                    const parsed = Number(value);
                                    return Number.isFinite(parsed) ? { ...current, [property]: parsed } : current;
                                  })
                                }
                              />
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {"options" in field && controls.options !== "hidden" ? (
                        <div className={builderClass("form-engine-builder__options")}>
                          <strong>{translate("builder.options")}</strong>
                          {field.options.map((option, optionIndex) =>
                            OptionEditorSlot === undefined ? (
                              <div className={builderClass("form-engine-builder__option")} key={option.id}>
                                <TextInput
                                  id={`builder-option-${option.id}`}
                                  label={translate("builder.optionLabel", { index: optionIndex + 1 })}
                                  value={option.label}
                                  placeholder={translate("builder.optionLabelPlaceholder")}
                                  readOnly={controls.options === "readOnly"}
                                  onChange={(value) =>
                                    value.trim().length === 0 ? undefined : updateOption(field.id, option.id, value)
                                  }
                                />
                                {ToolbarSlot === undefined ? (
                                  <>
                                    <IconButton
                                      actionType="moveUp"
                                      title={translate("builder.moveUp", { title: option.label })}
                                      disabled={controls.options === "readOnly" || optionIndex === 0}
                                      onClick={() => moveOption(field.id, option.id, optionIndex - 1)}
                                    />
                                    <IconButton
                                      actionType="moveDown"
                                      title={translate("builder.moveDown", { title: option.label })}
                                      disabled={
                                        controls.options === "readOnly" || optionIndex === field.options.length - 1
                                      }
                                      onClick={() => moveOption(field.id, option.id, optionIndex + 1)}
                                    />
                                    <IconButton
                                      actionType="delete"
                                      disabled={controls.options === "readOnly" || field.options.length === 1}
                                      onClick={() => removeOption(field.id, option.id)}
                                      title={translate("builder.remove")}
                                    />
                                  </>
                                ) : (
                                  <ToolbarSlot
                                    schema={schema}
                                    translate={translate}
                                    kind="option"
                                    targetId={option.id}
                                    index={optionIndex}
                                    total={field.options.length}
                                    title={option.label}
                                    onMoveUp={() => moveOption(field.id, option.id, optionIndex - 1)}
                                    onMoveDown={() => moveOption(field.id, option.id, optionIndex + 1)}
                                    onRemove={() => removeOption(field.id, option.id)}
                                    readOnly={readOnly || controls.options === "readOnly"}
                                    actions={actions}
                                    components={components}
                                  />
                                )}
                              </div>
                            ) : (
                              <OptionEditorSlot
                                key={option.id}
                                schema={schema}
                                field={field}
                                option={option}
                                index={optionIndex}
                                currentLocale={editingLocale}
                                translate={translate}
                                readOnly={readOnly || controls.options === "readOnly"}
                                actions={actions}
                                components={components}
                              />
                            )
                          )}
                          <Button
                            action="addOption"
                            targetId={field.id}
                            disabled={
                              controls.options === "readOnly" ||
                              (policy?.maxOptionsPerField !== undefined &&
                                field.options.length >= policy.maxOptionsPerField)
                            }
                            onClick={() => addOption(field.id)}
                          >
                            {translate("builder.addOption")}
                          </Button>
                        </div>
                      ) : null}

                      {conditionsEnabled && controls.displayConditions !== "hidden" ? (
                        <div className={builderClass("form-engine-builder__condition")}>
                          <div className={builderClass("form-engine-builder__field")}>
                            <Select
                              id={`builder-field-${field.id}-condition`}
                              label={translate("builder.displayCondition")}
                              value={condition?.questionId ?? ""}
                              onChange={(value) => {
                                const selected = schema.fields.find((item) => item.id === value);
                                setDisplayCondition(
                                  field.id,
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
                                ...availableSources.map((candidate) => ({
                                  value: candidate.id,
                                  label: candidate.title
                                }))
                              ]}
                            />
                          </div>
                          {condition !== undefined && source !== undefined ? (
                            <>
                              <Select
                                aria-label={translate("builder.conditionOperator")}
                                value={condition.operator}
                                onChange={(value) => {
                                  const operator = value as ConditionOperator;
                                  setDisplayCondition(
                                    field.id,
                                    conditionWithValue(source.id, operator, defaultConditionValue(source))
                                  );
                                }}
                                options={conditionOperators(source).map((operator) => ({
                                  value: operator,
                                  label: translate(operatorKey(operator))
                                }))}
                              />
                              <ConditionValueEditor
                                source={source}
                                condition={condition}
                                onChange={(next) => setDisplayCondition(field.id, next)}
                                translate={translate}
                                components={components}
                              />
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </Fieldset>
                  );
                })}
              </div>
            </BuilderSectionGroup>
            <BuilderSectionGroup name="addQuestion">
              <Button
                className={builderClass("form-engine-builder__add")}
                action="addField"
                disabled={initialFieldType === null || maxFieldsReached}
                onClick={addField}
              >
                {translate(BUILDER_TRANSLATION_KEYS.ADD_FIELD)}
              </Button>
            </BuilderSectionGroup>
          </OrderedBuilderSections>
        </Fieldset>
      </Section>
    </BuilderPrimitiveContext.Provider>
  );
}
