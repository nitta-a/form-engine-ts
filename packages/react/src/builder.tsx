// biome-ignore-all lint/a11y/noLabelWithoutControl: injected input primitives render the associated control at runtime.
import {
  type AsyncTranslationAdapter,
  type ConditionOperator,
  type ConditionValue,
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
import { createContext, useContext, useState } from "react";
import {
  type BuilderActionError,
  type BuilderActionResult,
  type BuilderFactories,
  type BuilderTextTarget,
  useFormBuilder
} from "./hooks/useFormBuilder";
import type {
  BuilderActionContext,
  BuilderButtonProps,
  BuilderCheckboxProps,
  BuilderFieldsetProps,
  BuilderIconButtonProps,
  BuilderSectionProps,
  BuilderSelectProps,
  BuilderTextAreaProps,
  BuilderTextInputProps,
  FormBuilderActions,
  FormBuilderComponents,
  FormBuilderSlots,
  ManualTranslationContext
} from "./types";

function DefaultButton({
  id,
  className,
  disabled,
  "aria-label": ariaLabel,
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
      {...(props.onClick === undefined ? {} : { onClick: props.onClick })}
    >
      {props.icon}
    </DefaultButton>
  );
}

function DefaultTextInput({
  id,
  className,
  disabled,
  readOnly,
  "aria-label": ariaLabel,
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
  return (
    <>
      <input
        id={id}
        name={name}
        className={className}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        aria-label={ariaLabel ?? label}
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
      {helperText === undefined || helperText.length === 0 ? null : <small>{helperText}</small>}
    </>
  );
}

function DefaultTextArea({
  id,
  className,
  disabled,
  readOnly,
  "aria-label": ariaLabel,
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
  return (
    <>
      <textarea
        id={id}
        name={name}
        className={className}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        aria-label={ariaLabel ?? label}
        aria-invalid={error === true ? true : undefined}
        value={value}
        rows={rows}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      {helperText === undefined || helperText.length === 0 ? null : <small>{helperText}</small>}
    </>
  );
}

function DefaultSelect({
  id,
  className,
  disabled,
  "aria-label": ariaLabel,
  name,
  label,
  required,
  error,
  helperText,
  value,
  onChange,
  options
}: BuilderSelectProps) {
  return (
    <>
      <select
        id={id}
        name={name}
        className={className}
        disabled={disabled}
        required={required}
        aria-label={ariaLabel ?? label}
        aria-invalid={error === true ? true : undefined}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      {helperText === undefined || helperText.length === 0 ? null : <small>{helperText}</small>}
    </>
  );
}

function DefaultCheckbox({
  id,
  className,
  disabled,
  "aria-label": ariaLabel,
  checked,
  onChange,
  label
}: BuilderCheckboxProps) {
  return (
    <label className={className}>
      <input
        id={id}
        type="checkbox"
        disabled={disabled}
        aria-label={ariaLabel}
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      {label}
    </label>
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

function DefaultErrorMessage({ message }: { readonly message: string }) {
  return <p className="form-engine-builder__error">{message}</p>;
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
  ErrorMessage: DefaultErrorMessage
};

interface BuilderPrimitiveContextValue {
  readonly components: Required<FormBuilderComponents>;
  readonly readOnly: boolean;
}

const BuilderPrimitiveContext = createContext<BuilderPrimitiveContextValue>({
  components: DEFAULT_COMPONENTS,
  readOnly: false
});

function BuilderButton(props: BuilderButtonProps) {
  const context = useContext(BuilderPrimitiveContext);
  const Component = context.components.Button;
  return <Component {...props} disabled={context.readOnly || props.disabled === true} readOnly={context.readOnly} />;
}

function BuilderIconButton(props: BuilderIconButtonProps) {
  const context = useContext(BuilderPrimitiveContext);
  const Component = context.components.IconButton;
  return <Component {...props} disabled={context.readOnly || props.disabled === true} readOnly={context.readOnly} />;
}

function BuilderTextInput(props: BuilderTextInputProps) {
  const context = useContext(BuilderPrimitiveContext);
  const Component = context.components.TextInput;
  return <Component {...props} disabled={context.readOnly || props.disabled === true} readOnly={context.readOnly} />;
}

function BuilderTextArea(props: BuilderTextAreaProps) {
  const context = useContext(BuilderPrimitiveContext);
  const Component = context.components.TextArea;
  return <Component {...props} disabled={context.readOnly || props.disabled === true} readOnly={context.readOnly} />;
}

function BuilderSelect(props: BuilderSelectProps) {
  const context = useContext(BuilderPrimitiveContext);
  const Component = context.components.Select;
  return <Component {...props} disabled={context.readOnly || props.disabled === true} readOnly={context.readOnly} />;
}

function BuilderCheckbox(props: BuilderCheckboxProps) {
  const context = useContext(BuilderPrimitiveContext);
  const Component = context.components.Checkbox;
  return <Component {...props} disabled={context.readOnly || props.disabled === true} readOnly={context.readOnly} />;
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

function BuilderErrorMessage(props: { readonly message: string }) {
  const Component = useContext(BuilderPrimitiveContext).components.ErrorMessage;
  return <Component {...props} />;
}

const GUARDED_COMPONENTS: Required<FormBuilderComponents> = {
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

const BUILDER_DEFAULTS: Readonly<Record<string, string>> = {
  "builder.formBuilder": "Form builder",
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
  "builder.localization": "Localization",
  "builder.defaultLocale": "Default locale",
  "builder.supportedLocales": "Supported locales",
  "builder.addLocale": "Add locale",
  "builder.editLocale": "Edit locale",
  "builder.autoTranslate": "Translate all text",
  "builder.translationUnavailable": "Provide an async translation adapter to enable automatic translation.",
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
  readonly components?: FormBuilderComponents;
  readonly slots?: FormBuilderSlots;
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
  components: componentOverrides,
  slots
}: FormBuilderProps) {
  const resolvedComponents: Required<FormBuilderComponents> = { ...DEFAULT_COMPONENTS, ...componentOverrides };
  const components = GUARDED_COMPONENTS;
  const { Button, Checkbox, ErrorMessage, Fieldset, IconButton, Section, Select, TextInput } = components;
  const ToolbarSlot = slots?.toolbar;
  const FieldEditorSlot = slots?.fieldEditor;
  const OptionEditorSlot = slots?.optionEditor;
  const PagesSlot = slots?.pages;
  const LocalizationSlot = slots?.localization;
  const TranslationActionsSlot = slots?.translationActions;
  const headless = useFormBuilder({
    schema,
    onChange,
    ...(policy === undefined ? {} : { policy }),
    ...(idFactory === undefined ? {} : { idFactory }),
    ...(factories === undefined ? {} : { factories })
  });
  const [newPageQuestionId, setNewPageQuestionId] = useState("");
  const [newLocale, setNewLocale] = useState("");
  const [editingLocale, setEditingLocale] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [translationReport, setTranslationReport] = useState<TranslationReport>();
  const translate = (key: string, params: Readonly<Record<string, string | number>> = {}) => {
    const translated = translator?.translate(key, locale, params);
    return translated === undefined ? interpolate(BUILDER_DEFAULTS[key] ?? key, params) : translated;
  };
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

  const updateManualTranslation = (context: ManualTranslationContext) => {
    if (readOnly) return;
    const metadata = createManualTranslationMetadata?.(context);
    const target =
      context.kind === "form" ? ({ kind: "form" } as const) : ({ kind: context.kind, id: context.nodeId } as const);
    executeAction(
      () =>
        headless.setLocaleTranslation(
          context.locale,
          target,
          context.property,
          context.translatedText,
          metadata === undefined ? undefined : { metadata }
        ),
      {
        action: "setLocaleTranslation",
        targetId: context.nodeId,
        params: { locale: context.locale, kind: context.kind, property: context.property }
      }
    );
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
  const actions: FormBuilderActions = {
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
    <BuilderPrimitiveContext.Provider value={{ components: resolvedComponents, readOnly }}>
      <Section
        className={`form-engine-builder ${className}`.trim()}
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
        <Fieldset className="form-engine-builder__controls" disabled={readOnly}>
          {pagesEnabled ? (
            PagesSlot === undefined ? (
              <Section
                className="form-engine-builder__pages"
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
                          className="form-engine-builder__page"
                          legend={page.title ?? `${translate("builder.newPage")} ${pageIndex + 1}`}
                          key={page.id}
                        >
                          <div className="form-engine-builder__toolbar">
                            {ToolbarSlot === undefined ? (
                              <>
                                <IconButton
                                  icon="↑"
                                  title={translate("builder.moveUp", { title: page.title ?? page.id })}
                                  disabled={pageIndex === 0}
                                  onClick={() => movePage(pageIndex, -1)}
                                />
                                <IconButton
                                  icon="↓"
                                  title={translate("builder.moveDown", { title: page.title ?? page.id })}
                                  disabled={pageIndex === (schema.pages?.length ?? 0) - 1}
                                  onClick={() => movePage(pageIndex, 1)}
                                />
                                <Button onClick={() => removePage(pageIndex)} variant="danger">
                                  {translate("builder.deleteAction")}
                                </Button>
                              </>
                            ) : (
                              <ToolbarSlot
                                schema={schema}
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
                          <div className="form-engine-builder__grid">
                            <label>
                              {translate("builder.pageTitle")}
                              <TextInput
                                value={page.title ?? ""}
                                onChange={(value) => {
                                  updatePage(page.id, (current) => {
                                    if (value.length > 0) return { ...current, title: value };
                                    const { title: _title, ...withoutTitle } = current;
                                    return withoutTitle;
                                  });
                                }}
                              />
                            </label>
                            <label>
                              {translate("builder.pageDescription")}
                              <TextInput
                                value={page.description ?? ""}
                                onChange={(value) => {
                                  updatePage(page.id, (current) => {
                                    if (value.length > 0) return { ...current, description: value };
                                    const { description: _description, ...withoutDescription } = current;
                                    return withoutDescription;
                                  });
                                }}
                              />
                            </label>
                          </div>
                          {!localizationEnabled || editingLocale.length === 0 ? null : (
                            <div className="form-engine-builder__translation-editor">
                              <strong>{editingLocale}</strong>
                              <div className="form-engine-builder__grid">
                                <label>
                                  {translate("builder.pageTitle")}
                                  <TextInput
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
                                </label>
                                <label>
                                  {translate("builder.pageDescription")}
                                  <TextInput
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
                                </label>
                              </div>
                            </div>
                          )}
                          {conditionsEnabled ? (
                            <div className="form-engine-builder__condition">
                              <label>
                                {translate("builder.pageCondition")}
                                <Select
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
                              </label>
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
                                      updatePage(page.id, (current) => ({ ...current, displayCondition: condition }))
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
                    <div className="form-engine-builder__page-add">
                      <label>
                        {translate("builder.pageQuestion")}
                        <Select
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
                      </label>
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
                currentLocale={editingLocale}
                readOnly={readOnly}
                actions={actions}
                components={components}
              />
            )
          ) : null}

          {localizationEnabled ? (
            LocalizationSlot === undefined ? (
              <Section
                className="form-engine-builder__localization"
                headingId="builder-localization-heading"
                title={translate("builder.localization")}
              >
                <label>
                  {translate("builder.completionMessage")}
                  <TextInput
                    value={schema.completionMessage ?? ""}
                    onChange={(value) => setSourceText({ kind: "form" }, "completionMessage", value)}
                  />
                </label>
                <div className="form-engine-builder__grid">
                  <label>
                    {translate("builder.defaultLocale")}
                    <TextInput value={schema.defaultLocale ?? ""} onChange={setDefaultLocale} />
                  </label>
                  <label htmlFor="builder-new-locale">
                    {translate("builder.addLocale")}
                    {availableAllowedLocales === undefined ? (
                      <TextInput id="builder-new-locale" value={newLocale} onChange={setNewLocale} />
                    ) : (
                      <Select
                        id="builder-new-locale"
                        value={newLocale}
                        onChange={setNewLocale}
                        options={[
                          { value: "", label: "—" },
                          ...availableAllowedLocales.map((candidate) => ({ value: candidate, label: candidate }))
                        ]}
                      />
                    )}
                  </label>
                  <Button
                    action="addLocale"
                    disabled={newLocale.trim().length === 0 || localeLimitReached}
                    onClick={addLocale}
                  >
                    {translate("builder.addLocale")}
                  </Button>
                  <label>
                    {translate("builder.editLocale")}
                    <Select
                      value={editingLocale}
                      onChange={setEditingLocale}
                      options={[
                        { value: "", label: "—" },
                        ...(schema.supportedLocales ?? [])
                          .filter((item) => item !== schema.defaultLocale)
                          .map((item) => ({ value: item, label: item }))
                      ]}
                    />
                  </label>
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
                      currentLocale={editingLocale}
                      onAutoTranslate={() => void translateAll()}
                      isTranslating={isTranslating}
                      {...(translationError === null ? {} : { translationError })}
                      {...(translationReport === undefined ? {} : { translationReport })}
                      onClearTranslationError={() => setTranslationError(null)}
                      readOnly={readOnly}
                      actions={actions}
                      components={components}
                    />
                  )}
                </div>
                {translationAdapter === undefined ? <p>{translate("builder.translationUnavailable")}</p> : null}
                {translationError === null ? null : <ErrorMessage message={translationError} />}
                {editingLocale.length === 0 ? null : (
                  <div className="form-engine-builder__grid">
                    <label>
                      {translate("builder.questionTitle")}
                      <TextInput
                        value={schema.translations?.[editingLocale]?.title ?? ""}
                        onChange={(value) => updateFormTranslation("title", value)}
                      />
                    </label>
                    <label>
                      {translate("builder.pageDescription")}
                      <TextInput
                        value={schema.translations?.[editingLocale]?.description ?? ""}
                        onChange={(value) => updateFormTranslation("description", value)}
                      />
                    </label>
                    <label>
                      {translate("builder.completionMessage")}
                      <TextInput
                        value={schema.translations?.[editingLocale]?.completionMessage ?? ""}
                        onChange={(value) => updateFormTranslation("completionMessage", value)}
                      />
                    </label>
                  </div>
                )}
              </Section>
            ) : (
              <LocalizationSlot
                schema={schema}
                currentLocale={editingLocale}
                onCurrentLocaleChange={setEditingLocale}
                onAutoTranslate={() => void translateAll()}
                isTranslating={isTranslating}
                {...(translationError === null ? {} : { translationError })}
                readOnly={readOnly}
                actions={actions}
                components={components}
              />
            )
          ) : null}

          <div className="form-engine-builder__list">
            {schema.fields.map((field, index) => {
              const condition = field.displayCondition;
              const source =
                condition === undefined ? undefined : schema.fields.find((item) => item.id === condition.questionId);
              const availableSources = schema.fields.slice(0, index);
              if (FieldEditorSlot !== undefined) {
                return (
                  <FieldEditorSlot
                    key={field.id}
                    schema={schema}
                    field={field}
                    index={index}
                    currentLocale={editingLocale}
                    {...(policy === undefined ? {} : { policy })}
                    readOnly={readOnly}
                    actions={actions}
                    components={components}
                  />
                );
              }
              return (
                <Fieldset className="form-engine-builder__question" legend={field.title} key={field.id}>
                  <div className="form-engine-builder__toolbar">
                    {ToolbarSlot === undefined ? (
                      <>
                        <IconButton
                          icon="↑"
                          title={translate("builder.moveUp", { title: field.title })}
                          disabled={index === 0}
                          onClick={() => moveField(index, -1)}
                        />
                        <IconButton
                          icon="↓"
                          title={translate("builder.moveDown", { title: field.title })}
                          disabled={index === schema.fields.length - 1}
                          onClick={() => moveField(index, 1)}
                        />
                        <Button
                          disabled={schema.fields.length === 1}
                          onClick={() => removeField(field.id)}
                          aria-label={translate("builder.delete", { title: field.title })}
                          variant="danger"
                        >
                          {translate("builder.deleteAction")}
                        </Button>
                      </>
                    ) : (
                      <ToolbarSlot
                        schema={schema}
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
                  <div className="form-engine-builder__grid">
                    <label>
                      {translate("builder.questionTitle")}
                      <TextInput
                        name={`fields.${field.id}.title`}
                        label={translate("builder.questionTitle")}
                        required={true}
                        error={field.title.trim().length === 0}
                        helperText={field.title.trim().length === 0 ? translate("builder.required") : ""}
                        value={field.title}
                        placeholder={translate("builder.questionTitlePlaceholder")}
                        onChange={(value) =>
                          updateField(field.id, (current) => ({
                            ...current,
                            title: value.trim().length === 0 ? current.title : value
                          }))
                        }
                      />
                    </label>
                    <label>
                      {translate("builder.type")}
                      <Select
                        value={field.type}
                        onChange={(value) => changeType(field.id, value as FieldType)}
                        options={FIELD_TYPES.filter(
                          (type) => policy?.allowedFieldTypes === undefined || policy.allowedFieldTypes.includes(type)
                        ).map((type) => ({ value: type, label: translate(fieldTypeKey(type)) }))}
                      />
                    </label>
                    <Checkbox
                      className="form-engine-builder__check"
                      checked={field.required === true}
                      onChange={(checked) => updateField(field.id, (current) => ({ ...current, required: checked }))}
                      label={translate("builder.required")}
                    />
                  </div>

                  {!pagesEnabled || schema.pages === undefined ? null : (
                    <label>
                      {translate("builder.questionPage")}
                      <Select
                        value={pageForField(field.id)?.id ?? ""}
                        onChange={(value) => assignFieldToPage(field.id, value)}
                        options={schema.pages.map((page, pageIndex) => ({
                          value: page.id,
                          label: page.title ?? `${translate("builder.newPage")} ${pageIndex + 1}`
                        }))}
                      />
                    </label>
                  )}

                  {!localizationEnabled || editingLocale.length === 0 ? null : (
                    <div className="form-engine-builder__translation-editor">
                      <strong>{editingLocale}</strong>
                      <div className="form-engine-builder__grid">
                        <label>
                          {translate("builder.questionTitle")}
                          <TextInput
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
                        </label>
                        <label>
                          {translate("builder.pageDescription")}
                          <TextInput
                            value={field.translations?.[editingLocale]?.description ?? ""}
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
                                      existingTranslationMetadata: field.translationMetadata[editingLocale]?.description
                                    })
                              })
                            }
                          />
                        </label>
                      </div>
                      {"options" in field
                        ? field.options.map((option, optionIndex) => (
                            <label key={option.id}>
                              {translate("builder.optionLabel", { index: optionIndex + 1 })} ({editingLocale})
                              <TextInput
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
                                          existingTranslationMetadata: option.translationMetadata[editingLocale]?.label
                                        })
                                  })
                                }
                              />
                            </label>
                          ))
                        : null}
                    </div>
                  )}

                  {field.type === "rating" ? (
                    <div className="form-engine-builder__grid">
                      <label>
                        {translate("builder.minimum")}
                        <TextInput
                          type="number"
                          value={String(field.min ?? 1)}
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
                      </label>
                      <label>
                        {translate("builder.maximum")}
                        <TextInput
                          type="number"
                          value={String(field.max ?? 5)}
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
                      </label>
                    </div>
                  ) : null}

                  {"options" in field ? (
                    <div className="form-engine-builder__options">
                      <strong>{translate("builder.options")}</strong>
                      {field.options.map((option, optionIndex) =>
                        OptionEditorSlot === undefined ? (
                          <div className="form-engine-builder__option" key={option.id}>
                            <TextInput
                              aria-label={translate("builder.optionLabel", { index: optionIndex + 1 })}
                              value={option.label}
                              placeholder={translate("builder.optionLabelPlaceholder")}
                              onChange={(value) =>
                                value.trim().length === 0 ? undefined : updateOption(field.id, option.id, value)
                              }
                            />
                            {ToolbarSlot === undefined ? (
                              <>
                                <IconButton
                                  icon="↑"
                                  title={translate("builder.moveUp", { title: option.label })}
                                  disabled={optionIndex === 0}
                                  onClick={() => moveOption(field.id, option.id, optionIndex - 1)}
                                />
                                <IconButton
                                  icon="↓"
                                  title={translate("builder.moveDown", { title: option.label })}
                                  disabled={optionIndex === field.options.length - 1}
                                  onClick={() => moveOption(field.id, option.id, optionIndex + 1)}
                                />
                                <Button
                                  disabled={field.options.length === 1}
                                  onClick={() => removeOption(field.id, option.id)}
                                  variant="danger"
                                >
                                  {translate("builder.remove")}
                                </Button>
                              </>
                            ) : (
                              <ToolbarSlot
                                schema={schema}
                                kind="option"
                                targetId={option.id}
                                index={optionIndex}
                                total={field.options.length}
                                title={option.label}
                                onMoveUp={() => moveOption(field.id, option.id, optionIndex - 1)}
                                onMoveDown={() => moveOption(field.id, option.id, optionIndex + 1)}
                                onRemove={() => removeOption(field.id, option.id)}
                                readOnly={readOnly}
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
                            readOnly={readOnly}
                            actions={actions}
                            components={components}
                          />
                        )
                      )}
                      <Button
                        action="addOption"
                        targetId={field.id}
                        disabled={
                          policy?.maxOptionsPerField !== undefined && field.options.length >= policy.maxOptionsPerField
                        }
                        onClick={() => addOption(field.id)}
                      >
                        {translate("builder.addOption")}
                      </Button>
                    </div>
                  ) : null}

                  {conditionsEnabled ? (
                    <div className="form-engine-builder__condition">
                      <label>
                        {translate("builder.displayCondition")}
                        <Select
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
                            ...availableSources.map((candidate) => ({ value: candidate.id, label: candidate.title }))
                          ]}
                        />
                      </label>
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
          <Button
            className="form-engine-builder__add"
            action="addField"
            disabled={initialFieldType === null || maxFieldsReached}
            onClick={addField}
          >
            {translate("builder.addQuestion")}
          </Button>
        </Fieldset>
      </Section>
    </BuilderPrimitiveContext.Provider>
  );
}
