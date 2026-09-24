import {
  type BaseSubmissionMetadata,
  calculateProgress,
  createSubmissionId,
  deserializeSubmissionErrorFromTrpc,
  type FieldType,
  type FormField,
  type FormPolicy,
  type FormSchema,
  FormSubmissionError,
  type FormValue,
  type FormValues,
  getFormAcceptanceStatus,
  getFormContentMode,
  isFormSubmissionSerializedError,
  isFormValue,
  isRadioTextAnswer,
  type SubmissionGuardContext,
  selectedOptionId,
  selectVisibleAnswers,
  shuffleOptions,
  type TranslationAdapter,
  type ValidationIssue,
  validateAnswers
} from "@form-engine-ts/core";
import type { SensitiveDataFinding } from "@form-engine-ts/privacy";
import type * as React from "react";
import {
  type ComponentType,
  type FormEvent,
  Fragment,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from "react";
import { createLocalStorageSubmissionAttemptStore, type SubmissionAttempt } from "./attempt";
import { FormProvider, useForm } from "./context";
import { useFormTelemetry } from "./hooks/useFormTelemetry";
import { FormEngineI18nProviderScopeContext, useFormEngineI18n } from "./i18n/provider";
import type { SubmissionReceipt } from "./receipt";
import type { ScopedSubmissionController, SubmissionController } from "./submission";
import type { SubmissionIdentity } from "./submissionIdentity";
import type {
  BeforeSubmit,
  ChoiceFieldTypeLayoutMap,
  ChoiceGroupSlotProps,
  FieldComponentProps,
  FieldError,
  FormAcceptanceProps,
  FormDraftResumeSlotProps,
  FormRendererAppearance,
  FormRendererClassNames,
  FormRendererComponents,
  FormRendererFieldConfig,
  FormRendererMessages,
  FormRendererSlotProps,
  FormRendererSlots,
  FormSubmissionGuard,
  FormSubmissionMetadata,
  FormSubmitHandler,
  FormSubmitStatus,
  FormSubmittedAnswerItem,
  FormSuccessRenderMode,
  FormTelemetryOptions,
  RadioTextInputSlotProps,
  RenderSubmitButtonProps,
  RespondentButtonProps,
  RespondentCheckboxProps,
  RespondentRadioProps,
  RespondentRatingProps,
  RespondentSelectProps,
  RespondentTextAreaProps,
  RespondentTextInputProps,
  SubmissionConfirmationOptions,
  SubmissionConfirmationRenderMode,
  SubmissionGuard,
  SubmissionProtectionProps,
  SubmitResponse,
  SubmitResult,
  TypedFormSubmitHandler
} from "./types";

export type { FieldComponentProps, FormRendererComponents } from "./types";

const isChoiceFieldType = (type: FieldType): boolean =>
  type === "radio" || type === "checkbox" || type === "multi-select" || type === "select";

function joinClassNames(...names: readonly (string | undefined)[]): string | undefined {
  const value = names.filter((name): name is string => name !== undefined && name.length > 0).join(" ");
  return value.length === 0 ? undefined : value;
}

function resolveScrollBehavior(
  options: import("./types").FormPageTransitionOptions | undefined
): "smooth" | "auto" | undefined {
  if (options?.scroll === "none") return undefined;
  if (options?.scroll === "instant") return "auto";
  if (
    options?.respectReducedMotion !== false &&
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return "auto";
  return "smooth";
}

export function resolveChoiceFieldLayout(
  type: FieldType,
  appearance?: FormRendererAppearance,
  groupedChoiceFieldsLegacy = false
): "default" | "grouped" {
  if (groupedChoiceFieldsLegacy) return "grouped";
  const config = appearance?.choiceField;
  if (config === undefined) return "default";
  if (typeof config === "string") return config;
  return config[type as keyof ChoiceFieldTypeLayoutMap] ?? "default";
}

export type FieldComponents = Partial<Record<FieldType, ComponentType<FieldComponentProps>>>;

function describedBy(
  field: FormField,
  error: ValidationIssue | undefined,
  helpId: string,
  errorId: string
): string | undefined {
  const ids = [field.description === undefined ? undefined : helpId, error === undefined ? undefined : errorId].filter(
    Boolean
  );
  return ids.length === 0 ? undefined : ids.join(" ");
}

function optionAccessibleName(
  option: { readonly id: string; readonly label: string },
  a11y: FieldComponentProps["a11y"]
): string {
  return a11y?.optionAriaLabelGenerator?.(option.id, option.label) ?? option.label;
}

function defaultRadioTextInput({
  inputId,
  label,
  value,
  disabled,
  readOnly,
  onChange
}: RadioTextInputSlotProps): ReactNode {
  return (
    <label className="fe-radio-text-input" htmlFor={inputId}>
      <span>{label}</span>
      <input
        id={inputId}
        type="text"
        value={value}
        disabled={disabled}
        readOnly={readOnly}
        aria-label={label}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  );
}

function defaultTextInput({
  type = "text",
  value,
  onChange,
  onBlur,
  onFocus,
  field: _field,
  label: _label,
  description: _description,
  error: _error,
  helperText: _helperText,
  errorText: _errorText,
  ...props
}: RespondentTextInputProps): ReactNode {
  return (
    <input
      {...props}
      type={type}
      value={value ?? ""}
      onBlur={() => onBlur?.()}
      onFocus={() => onFocus?.()}
      onChange={(event) =>
        onChange(
          type === "number"
            ? event.currentTarget.value === ""
              ? undefined
              : event.currentTarget.valueAsNumber
            : event.currentTarget.value
        )
      }
    />
  );
}

function defaultTextArea({
  value,
  onChange,
  onBlur,
  onFocus,
  field: _field,
  label: _label,
  description: _description,
  error: _error,
  helperText: _helperText,
  errorText: _errorText,
  ...props
}: RespondentTextAreaProps): ReactNode {
  return (
    <textarea
      {...props}
      value={value ?? ""}
      onBlur={() => onBlur?.()}
      onFocus={() => onFocus?.()}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  );
}

function defaultSelect({
  value,
  options,
  onChange,
  field: _field,
  label: _label,
  description: _description,
  error: _error,
  helperText: _helperText,
  errorText: _errorText,
  ...props
}: RespondentSelectProps): ReactNode {
  return (
    <select {...props} value={value ?? ""} onChange={(event) => onChange(event.currentTarget.value || undefined)}>
      <option value="">—</option>
      {options.map((option) => (
        <option value={option.id} key={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function defaultCheckbox({
  checked,
  onChange,
  field: _field,
  label: _label,
  description: _description,
  error: _error,
  helperText: _helperText,
  errorText: _errorText,
  ...props
}: RespondentCheckboxProps): ReactNode {
  return (
    <input {...props} type="checkbox" checked={checked} onChange={(event) => onChange(event.currentTarget.checked)} />
  );
}

function defaultRadio({
  checked,
  onChange,
  onKeyDown,
  field: _field,
  label: _label,
  description: _description,
  error: _error,
  helperText: _helperText,
  errorText: _errorText,
  ...props
}: RespondentRadioProps): ReactNode {
  return (
    <input
      {...props}
      type="radio"
      checked={checked}
      onKeyDown={(event) => onKeyDown?.(event)}
      onChange={(event) => onChange(event.currentTarget.checked)}
    />
  );
}

function defaultRating({
  value,
  checked,
  min,
  max: _max,
  onChange,
  field: _field,
  label: _label,
  description: _description,
  error: _error,
  helperText: _helperText,
  errorText: _errorText,
  ...props
}: RespondentRatingProps): ReactNode {
  return (
    <input
      {...props}
      type="radio"
      value={value ?? ""}
      checked={checked}
      min={min}
      onChange={() => onChange(value ?? min)}
    />
  );
}

function RequiredMark({
  required,
  className = "fe-required"
}: {
  readonly required: boolean | undefined;
  readonly className?: string;
}) {
  return required ? (
    <span className={className} aria-hidden="true">
      {" "}
      *
    </span>
  ) : null;
}

function FieldMessage({ props }: { readonly props: FieldComponentProps }) {
  return (
    <>
      {props.field.description === undefined && props.a11y?.customDescription === undefined ? null : (
        <div id={props.helpId} className={joinClassNames("fe-help", props.classNames?.help)}>
          {props.a11y?.customDescription ?? props.field.description}
        </div>
      )}
      {props.error === undefined ? null : (
        <div id={props.errorId} className={joinClassNames("fe-error", props.classNames?.error)}>
          {props.translate(props.error.messageKey, props.error.params)}
        </div>
      )}
    </>
  );
}

function requiredIndicator(required: boolean, a11y: FieldComponentProps["a11y"]): ReactNode {
  if (a11y?.requiredIndicator === false) return null;
  if (typeof a11y?.requiredIndicator === "string") return <span className="fe-required">{a11y.requiredIndicator}</span>;
  return <RequiredMark required={required} />;
}

function fieldDataAttributes(field: FormField, error: ValidationIssue | undefined, disabled?: boolean) {
  return {
    "data-field-id": field.id,
    "data-field-type": field.type,
    "data-required": field.required === true ? "true" : "false",
    "data-invalid": error === undefined ? "false" : "true",
    "data-disabled": disabled === true ? "true" : "false"
  } as const;
}

function GroupedChoiceDescription({ props }: { readonly props: FieldComponentProps }) {
  return props.field.description === undefined ? null : (
    <div id={props.helpId} className={joinClassNames("fe-field-description", props.classNames?.help)}>
      {props.field.description}
    </div>
  );
}

function GroupedChoiceError({ props }: { readonly props: FieldComponentProps }) {
  return props.error === undefined ? null : (
    <div id={props.errorId} className={joinClassNames("fe-field-error", props.classNames?.error)} role="alert">
      {props.translate(props.error.messageKey, props.error.params)}
    </div>
  );
}

function ChoiceGroupFrame({
  props,
  children,
  className,
  slotProps,
  renderChoiceGroup,
  disabled,
  readOnly,
  submitStatus,
  submittedValue
}: {
  readonly props: FieldComponentProps;
  readonly children: ReactNode;
  readonly className: string;
  readonly slotProps?: FormRendererSlotProps["choiceGroup"] | undefined;
  readonly renderChoiceGroup?: FormRendererSlots["renderChoiceGroup"] | undefined;
  readonly disabled?: boolean | undefined;
  readonly readOnly?: boolean | undefined;
  readonly submitStatus?: FormSubmitStatus | undefined;
  readonly submittedValue?: unknown;
}) {
  const { field, error, translate } = props;
  const groupError: FieldError | undefined =
    error === undefined ? undefined : { ...error, message: translate(error.messageKey, error.params) };
  const groupProps: ChoiceGroupSlotProps = {
    field,
    value: props.value,
    ...(submittedValue === undefined ? {} : { submittedValue }),
    ...(submitStatus === undefined ? {} : { submitStatus }),
    title: field.title,
    ...(field.description === undefined ? {} : { description: field.description }),
    ...(field.required === undefined ? {} : { required: field.required }),
    ...(groupError === undefined ? {} : { error: groupError }),
    ...(disabled === undefined ? {} : { disabled }),
    ...(readOnly === undefined ? {} : { readOnly }),
    children,
    className
  };
  if (renderChoiceGroup !== undefined) return <>{renderChoiceGroup(groupProps)}</>;
  return (
    <fieldset
      className={className}
      {...fieldDataAttributes(field, error, disabled)}
      disabled={disabled}
      aria-describedby={describedBy(field, error, props.helpId, props.errorId)}
      style={slotProps?.style}
    >
      <legend
        className={joinClassNames("fe-choice-legend", props.classNames?.fieldLabel, props.classNames?.choiceLegend)}
      >
        {field.title}
        <RequiredMark required={field.required} className="fe-required-badge" />
      </legend>
      <GroupedChoiceDescription props={props} />
      {children}
      <GroupedChoiceError props={props} />
    </fieldset>
  );
}

function DefaultField({
  groupedChoiceFields,
  appearance,
  choiceGroupSlotProps,
  renderChoiceGroup,
  disabled,
  readOnly,
  submitStatus,
  submittedValue,
  renderChoiceOptionAfter,
  renderChoiceOption,
  renderRadioTextInput,
  primitiveComponents = {},
  radioTextInputEnabled,
  ...props
}: FieldComponentProps & {
  readonly groupedChoiceFields: boolean;
  readonly appearance?: FormRendererAppearance | undefined;
  readonly choiceGroupSlotProps?: FormRendererSlotProps["choiceGroup"] | undefined;
  readonly renderChoiceGroup?: FormRendererSlots["renderChoiceGroup"] | undefined;
  readonly disabled?: boolean | undefined;
  readonly readOnly?: boolean | undefined;
  readonly submitStatus?: FormSubmitStatus | undefined;
  readonly submittedValue?: unknown;
  readonly renderChoiceOptionAfter?: FormRendererSlots["renderChoiceOptionAfter"];
  readonly renderChoiceOption?: FormRendererSlots["renderChoiceOption"];
  readonly renderRadioTextInput?: FormRendererSlots["renderRadioTextInput"];
  readonly primitiveComponents?: FormRendererComponents;
  readonly radioTextInputEnabled: boolean;
  readonly optionOrderSeed?: string;
  readonly ratingDisplay?: "number" | "stars";
  readonly ratingStarSize?: number;
}) {
  const { field, value, setValue, inputId, error, translate } = props;
  const selectedOption = selectedOptionId(value);
  const orderedOptions =
    "options" in field && field.shuffleOptions === true && props.optionOrderSeed !== undefined
      ? shuffleOptions(field.options, props.optionOrderSeed)
      : "options" in field
        ? field.options
        : [];
  const isGroupedChoiceField =
    isChoiceFieldType(field.type) &&
    resolveChoiceFieldLayout(field.type, appearance, groupedChoiceFields) === "grouped";
  const choiceGroupClassName =
    joinClassNames(
      "fe-choice-group",
      `fe-field--${field.type}`,
      props.classNames?.choiceGroup,
      choiceGroupSlotProps?.className
    ) ?? "fe-choice-group";
  const ariaProps = {
    "aria-label": props.a11y?.ariaLabel,
    "aria-describedby":
      [props.a11y?.ariaDescribedBy, describedBy(field, error, props.helpId, props.errorId)]
        .filter((value): value is string => value !== undefined)
        .join(" ") || undefined,
    "aria-invalid": error === undefined ? undefined : true,
    "aria-required": field.required === true ? true : undefined
  } as const;
  const primitiveBase = {
    field,
    name: field.id,
    label: field.title,
    ...(field.description === undefined ? {} : { description: field.description }),
    required: field.required,
    disabled,
    readOnly,
    error: error !== undefined,
    helperText: field.description,
    ...(error === undefined ? {} : { errorText: translate(error.messageKey, error.params) }),
    className: props.classNames?.fieldInput,
    ...ariaProps
  };
  const Checkbox = primitiveComponents.Checkbox ?? defaultCheckbox;
  const Radio = primitiveComponents.Radio ?? defaultRadio;
  const Rating = primitiveComponents.Rating ?? defaultRating;
  const Select = primitiveComponents.Select ?? defaultSelect;
  const TextArea = primitiveComponents.TextArea ?? defaultTextArea;
  const TextInput = primitiveComponents.TextInput ?? defaultTextInput;

  if (field.type === "checkbox") {
    if (isGroupedChoiceField) {
      return (
        <ChoiceGroupFrame
          props={props}
          className={choiceGroupClassName}
          slotProps={choiceGroupSlotProps}
          renderChoiceGroup={renderChoiceGroup}
          disabled={disabled}
          readOnly={readOnly}
          submitStatus={submitStatus}
          submittedValue={submittedValue}
        >
          <div className={joinClassNames("fe-choice-options", props.classNames?.choiceOptions)}>
            <label className={joinClassNames("fe-choice-option", props.classNames?.choiceOption)} htmlFor={inputId}>
              <Checkbox
                {...primitiveBase}
                id={inputId}
                checked={value === true}
                aria-label={props.a11y?.ariaLabel ?? field.title}
                onChange={(checked) => setValue(checked)}
              />
              <span>{field.title}</span>
            </label>
          </div>
        </ChoiceGroupFrame>
      );
    }
    return (
      <div
        className={joinClassNames("fe-field fe-field--checkbox", props.classNames?.field)}
        {...fieldDataAttributes(field, error, disabled)}
      >
        <label className={joinClassNames("fe-check-label", props.classNames?.choiceOption)} htmlFor={inputId}>
          <Checkbox
            {...primitiveBase}
            id={inputId}
            checked={value === true}
            onChange={(checked) => setValue(checked)}
          />
          <span>
            {field.title}
            {requiredIndicator(field.required, props.a11y)}
          </span>
        </label>
        <FieldMessage props={props} />
      </div>
    );
  }

  if (field.type === "radio" || field.type === "multi-select") {
    const selected = Array.isArray(value) ? value : [];
    if (isGroupedChoiceField) {
      const isRadio = field.type === "radio";
      return (
        <ChoiceGroupFrame
          props={props}
          className={choiceGroupClassName}
          slotProps={choiceGroupSlotProps}
          renderChoiceGroup={renderChoiceGroup}
          disabled={disabled}
          readOnly={readOnly}
          submitStatus={submitStatus}
          submittedValue={submittedValue}
        >
          <div className={joinClassNames("fe-choice-options", props.classNames?.choiceOptions)}>
            {orderedOptions.map((option, index) => {
              const optionId = `${inputId}-${index}`;
              const checked = isRadio ? selectedOption === option.id : selected.includes(option.id);
              const radioField = field.type === "radio" ? field : undefined;
              const textInput =
                radioTextInputEnabled && radioField !== undefined && checked && option.textInput === true
                  ? (renderRadioTextInput ?? defaultRadioTextInput)({
                      field: radioField,
                      option,
                      inputId: `${optionId}-text`,
                      value: isRadioTextAnswer(value) && value.optionId === option.id ? value.text : "",
                      label: translate("form.optionText", { option: option.label }),
                      ...(disabled === undefined ? {} : { disabled }),
                      ...(readOnly === undefined ? {} : { readOnly }),
                      onChange: (text) => setValue({ optionId: option.id, text })
                    })
                  : null;
              const Option = isRadio ? Radio : Checkbox;
              const optionChange = (checked: boolean) => {
                if (isRadio) {
                  if (!checked) return;
                  setValue(
                    radioTextInputEnabled && option.textInput === true ? { optionId: option.id, text: "" } : option.id
                  );
                  return;
                }
                setValue(checked ? [...selected, option.id] : selected.filter((item) => item !== option.id));
              };
              const optionContent = (
                <>
                  <Option
                    {...primitiveBase}
                    id={optionId}
                    value={option.id}
                    checked={checked}
                    aria-label={optionAccessibleName(option, props.a11y)}
                    aria-required={isRadio && field.required ? true : undefined}
                    required={isRadio && field.required}
                    onKeyDown={
                      isRadio
                        ? (event) => {
                            if (
                              event.key !== "ArrowDown" &&
                              event.key !== "ArrowRight" &&
                              event.key !== "ArrowUp" &&
                              event.key !== "ArrowLeft"
                            )
                              return;
                            event.preventDefault();
                            const offset = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
                            const nextIndex = (index + offset + orderedOptions.length) % orderedOptions.length;
                            const nextOption = orderedOptions[nextIndex];
                            if (nextOption === undefined) return;
                            setValue(
                              radioTextInputEnabled && nextOption.textInput === true
                                ? { optionId: nextOption.id, text: "" }
                                : nextOption.id
                            );
                            document.getElementById(`${inputId}-${nextIndex}`)?.focus();
                          }
                        : undefined
                    }
                    onChange={optionChange}
                  />
                  <span>{option.label}</span>
                  {renderChoiceOptionAfter?.({ field, option, checked })}
                </>
              );
              const optionElement = renderChoiceOption?.({
                field,
                option,
                inputId: optionId,
                inputType: isRadio ? "radio" : "checkbox",
                checked,
                ...(disabled === undefined ? {} : { disabled }),
                ...(readOnly === undefined ? {} : { readOnly }),
                onChange: optionChange,
                ...(submittedValue === undefined ? {} : { submittedValue }),
                ...(submitStatus === undefined ? {} : { submitStatus }),
                children: optionContent
              }) ?? (
                <label
                  className={joinClassNames("fe-choice-option", props.classNames?.choiceOption)}
                  htmlFor={optionId}
                  data-option-id={option.id}
                  data-selected={checked ? "true" : "false"}
                >
                  {optionContent}
                </label>
              );
              return (
                <Fragment key={option.id}>
                  {optionElement}
                  {textInput}
                </Fragment>
              );
            })}
          </div>
        </ChoiceGroupFrame>
      );
    }
    if (field.type === "radio") {
      const labelId = `${inputId}-label`;
      return (
        <fieldset
          className={joinClassNames("fe-field fe-field--radio", props.classNames?.field)}
          {...fieldDataAttributes(field, error, disabled)}
          aria-describedby={describedBy(field, error, props.helpId, props.errorId)}
        >
          <legend id={labelId} className={joinClassNames("fe-label", props.classNames?.fieldLabel)}>
            {field.title}
            {requiredIndicator(field.required, props.a11y)}
          </legend>
          {orderedOptions.map((option, index) => {
            const optionId = `${inputId}-${index}`;
            const checked = selectedOption === option.id;
            const textInput =
              radioTextInputEnabled && checked && option.textInput === true
                ? (renderRadioTextInput ?? defaultRadioTextInput)({
                    field,
                    option,
                    inputId: `${optionId}-text`,
                    value: isRadioTextAnswer(value) && value.optionId === option.id ? value.text : "",
                    label: translate("form.optionText", { option: option.label }),
                    ...(disabled === undefined ? {} : { disabled }),
                    ...(readOnly === undefined ? {} : { readOnly }),
                    onChange: (text) => setValue({ optionId: option.id, text })
                  })
                : null;
            const optionChange = (checked: boolean) => {
              if (!checked) return;
              setValue(
                radioTextInputEnabled && option.textInput === true ? { optionId: option.id, text: "" } : option.id
              );
            };
            const optionContent = (
              <>
                <Radio
                  {...primitiveBase}
                  id={optionId}
                  value={option.id}
                  checked={checked}
                  aria-label={optionAccessibleName(option, props.a11y)}
                  required={field.required}
                  onKeyDown={(event) => {
                    if (
                      event.key !== "ArrowDown" &&
                      event.key !== "ArrowRight" &&
                      event.key !== "ArrowUp" &&
                      event.key !== "ArrowLeft"
                    )
                      return;
                    event.preventDefault();
                    const offset = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
                    const nextIndex = (index + offset + orderedOptions.length) % orderedOptions.length;
                    const nextOption = orderedOptions[nextIndex];
                    if (nextOption === undefined) return;
                    setValue(
                      radioTextInputEnabled && nextOption.textInput === true
                        ? { optionId: nextOption.id, text: "" }
                        : nextOption.id
                    );
                    document.getElementById(`${inputId}-${nextIndex}`)?.focus();
                  }}
                  onChange={optionChange}
                />
                <span>{option.label}</span>
                {renderChoiceOptionAfter?.({ field, option, checked })}
              </>
            );
            const optionElement = renderChoiceOption?.({
              field,
              option,
              inputId: optionId,
              inputType: "radio",
              checked,
              ...(disabled === undefined ? {} : { disabled }),
              ...(readOnly === undefined ? {} : { readOnly }),
              onChange: optionChange,
              ...(submittedValue === undefined ? {} : { submittedValue }),
              ...(submitStatus === undefined ? {} : { submitStatus }),
              children: optionContent
            }) ?? (
              <label
                className={joinClassNames("fe-check-label", props.classNames?.choiceOption)}
                htmlFor={optionId}
                data-option-id={option.id}
                data-selected={checked ? "true" : "false"}
              >
                {optionContent}
              </label>
            );
            return (
              <Fragment key={option.id}>
                {optionElement}
                {textInput}
              </Fragment>
            );
          })}
          <FieldMessage props={props} />
        </fieldset>
      );
    }
    return (
      <fieldset
        className={joinClassNames(`fe-field fe-field--${field.type}`, props.classNames?.field)}
        {...fieldDataAttributes(field, error, disabled)}
        aria-describedby={describedBy(field, error, props.helpId, props.errorId)}
      >
        <legend className={joinClassNames("fe-label", props.classNames?.fieldLabel)}>
          {field.title}
          {requiredIndicator(field.required, props.a11y)}
        </legend>
        {orderedOptions.map((option, index) => {
          const optionId = `${inputId}-${index}`;
          const checked = field.type === "radio" ? value === option.id : selected.includes(option.id);
          const optionChange = (nextChecked: boolean) =>
            setValue(nextChecked ? [...selected, option.id] : selected.filter((item) => item !== option.id));
          const optionContent = (
            <>
              <Checkbox
                {...primitiveBase}
                id={optionId}
                value={option.id}
                checked={checked}
                aria-label={optionAccessibleName(option, props.a11y)}
                onChange={optionChange}
              />
              <span>{option.label}</span>
              {renderChoiceOptionAfter?.({ field, option, checked })}
            </>
          );
          const optionElement = renderChoiceOption?.({
            field,
            option,
            inputId: optionId,
            inputType: "checkbox",
            checked,
            ...(disabled === undefined ? {} : { disabled }),
            ...(readOnly === undefined ? {} : { readOnly }),
            onChange: optionChange,
            ...(submittedValue === undefined ? {} : { submittedValue }),
            ...(submitStatus === undefined ? {} : { submitStatus }),
            children: optionContent
          }) ?? (
            <label
              className={joinClassNames("fe-check-label", props.classNames?.choiceOption)}
              htmlFor={optionId}
              data-option-id={option.id}
              data-selected={checked ? "true" : "false"}
            >
              {optionContent}
            </label>
          );
          return <Fragment key={option.id}>{optionElement}</Fragment>;
        })}
        <FieldMessage props={props} />
      </fieldset>
    );
  }

  if (field.type === "rating") {
    const min = field.min ?? 1;
    const max = field.max ?? 5;
    return (
      <fieldset
        className={joinClassNames("fe-field fe-field--rating", props.classNames?.field)}
        {...fieldDataAttributes(field, error, disabled)}
        aria-describedby={describedBy(field, error, props.helpId, props.errorId)}
      >
        <legend className={joinClassNames("fe-label", props.classNames?.fieldLabel)}>
          {field.title}
          {requiredIndicator(field.required, props.a11y)}
        </legend>
        <div className="fe-rating-options" data-rating-display={props.ratingDisplay ?? "number"}>
          {Array.from({ length: max - min + 1 }, (_, index) => min + index).map((rating) => {
            const optionId = `${inputId}-${rating}`;
            return (
              <label
                className={joinClassNames("fe-rating-label", props.classNames?.choiceOption)}
                htmlFor={optionId}
                key={rating}
                data-option-id={rating}
                data-selected={value === rating ? "true" : "false"}
                data-filled={typeof value === "number" && rating <= value ? "true" : "false"}
              >
                <Rating
                  {...primitiveBase}
                  id={optionId}
                  name={field.id}
                  value={rating}
                  checked={value === rating}
                  min={min}
                  max={max}
                  {...(props.ratingDisplay === "stars" ? { "aria-label": String(rating) } : {})}
                  onChange={() => setValue(rating)}
                />
                <span
                  aria-hidden={props.ratingDisplay === "stars" ? true : undefined}
                  style={props.ratingStarSize === undefined ? undefined : { fontSize: props.ratingStarSize }}
                >
                  {props.ratingDisplay === "stars" ? "★" : rating}
                </span>
              </label>
            );
          })}
        </div>
        <FieldMessage props={props} />
      </fieldset>
    );
  }

  const label = (
    <label className={joinClassNames("fe-label", props.classNames?.fieldLabel)} htmlFor={inputId}>
      {field.title}
      {requiredIndicator(field.required, props.a11y)}
    </label>
  );
  let control: ReactNode;
  if (field.type === "textarea") {
    control = (
      <TextArea
        {...primitiveBase}
        id={inputId}
        value={typeof value === "string" ? value : ""}
        minLength={field.minLength}
        maxLength={field.maxLength}
        {...(field.pattern === undefined ? {} : { pattern: field.pattern })}
        placeholder={field.placeholderKey === undefined ? undefined : translate(field.placeholderKey)}
        onChange={(nextValue) => setValue(nextValue)}
      />
    );
  } else if (field.type === "number") {
    control = (
      <TextInput
        {...primitiveBase}
        id={inputId}
        type="number"
        min={field.min}
        max={field.max}
        step={field.step}
        placeholder={field.placeholderKey === undefined ? undefined : translate(field.placeholderKey)}
        value={typeof value === "number" ? value : undefined}
        onChange={(nextValue) => setValue(typeof nextValue === "number" ? nextValue : undefined)}
      />
    );
  } else if (
    field.type === "date" ||
    field.type === "time" ||
    field.type === "email" ||
    field.type === "tel" ||
    field.type === "url"
  ) {
    const autoComplete =
      field.type === "email" ? "email" : field.type === "tel" ? "tel" : field.type === "url" ? "url" : undefined;
    control = (
      <TextInput
        {...primitiveBase}
        id={inputId}
        type={field.type}
        autoComplete={autoComplete}
        min={field.type === "date" ? field.minDate : field.type === "time" ? field.minTime : undefined}
        max={field.type === "date" ? field.maxDate : field.type === "time" ? field.maxTime : undefined}
        placeholder={field.placeholderKey === undefined ? undefined : translate(field.placeholderKey)}
        value={typeof value === "string" ? value : ""}
        onChange={(nextValue) => setValue(typeof nextValue === "string" ? nextValue : undefined)}
      />
    );
  } else if (field.type === "select") {
    control = (
      <Select
        {...primitiveBase}
        id={inputId}
        aria-label={isGroupedChoiceField ? (props.a11y?.ariaLabel ?? field.title) : props.a11y?.ariaLabel}
        value={typeof value === "string" ? value : ""}
        options={orderedOptions}
        onChange={(nextValue) => setValue(nextValue)}
      />
    );
  } else {
    const placeholderKey = "placeholderKey" in field ? field.placeholderKey : undefined;
    control = (
      <TextInput
        {...primitiveBase}
        id={inputId}
        type="text"
        placeholder={placeholderKey === undefined ? undefined : translate(placeholderKey)}
        value={typeof value === "string" ? value : ""}
        {...("minLength" in field && field.minLength === undefined
          ? {}
          : { minLength: "minLength" in field ? field.minLength : undefined })}
        {...("maxLength" in field && field.maxLength === undefined
          ? {}
          : { maxLength: "maxLength" in field ? field.maxLength : undefined })}
        {...("pattern" in field && field.pattern !== undefined ? { pattern: field.pattern } : {})}
        onChange={(nextValue) => setValue(typeof nextValue === "string" ? nextValue : undefined)}
      />
    );
  }
  if (isGroupedChoiceField) {
    return (
      <ChoiceGroupFrame
        props={props}
        className={choiceGroupClassName}
        slotProps={choiceGroupSlotProps}
        renderChoiceGroup={renderChoiceGroup}
        disabled={disabled}
        readOnly={readOnly}
        submitStatus={submitStatus}
        submittedValue={submittedValue}
      >
        <div className={joinClassNames("fe-choice-options", props.classNames?.choiceOptions)}>{control}</div>
      </ChoiceGroupFrame>
    );
  }
  return (
    <div
      className={joinClassNames(`fe-field fe-field--${field.type}`, props.classNames?.field)}
      {...fieldDataAttributes(field, error, disabled)}
    >
      {label}
      {control}
      {(field.type === "text" || field.type === "textarea") && field.maxLength !== undefined
        ? (props.renderCharacterCount?.({
            fieldId: field.id,
            current: typeof value === "string" ? value.length : 0,
            max: field.maxLength
          }) ?? (
            <div className={joinClassNames("fe-character-count", props.classNames?.characterCount)} aria-live="polite">
              {typeof value === "string" ? value.length : 0} / {field.maxLength}
            </div>
          ))
        : null}
      <FieldMessage props={props} />
    </div>
  );
}

export interface FormRendererPresentationProps extends SubmissionProtectionProps {
  readonly components?: FieldComponents;
  readonly primitiveComponents?: FormRendererComponents;
  readonly className?: string;
  readonly appearance?: FormRendererAppearance;
  readonly pageTransition?: import("./types").FormPageTransitionOptions;
  readonly slotProps?: FormRendererSlotProps;
  /** @deprecated Use appearance.choiceField="grouped" instead. */
  readonly groupedChoiceFields?: boolean;
  /**
   * Controls where the completion message is rendered after a successful submission.
   * Defaults to "append" for backwards compatibility.
   */
  readonly successRenderMode?: FormSuccessRenderMode;
  readonly submissionConfirmation?: SubmissionConfirmationOptions;
  /** @deprecated Use submissionConfirmation.renderMode instead. */
  readonly submissionConfirmationRenderMode?: SubmissionConfirmationRenderMode;
  readonly showHiddenFieldsInSummary?: boolean;
  readonly fieldsClassName?: string;
  readonly classNames?: FormRendererClassNames;
  /** @deprecated Use successRenderMode="replace" instead. */
  readonly hideFormOnSuccess?: boolean;
  readonly successMessageKey?: string;
  readonly errorMessageKey?: string;
  readonly attemptIdFactory?: () => string;
  readonly acceptance?: FormAcceptanceProps;
  readonly challengeToken?: string | (() => string | Promise<string>);
  readonly clientKey?: string;
  /** Seed used to keep shuffled choice options stable for a respondent. */
  readonly optionOrderSeed?: string;
  readonly ratingDisplay?: "number" | "stars";
  readonly ratingStarSize?: number;
  readonly estimateSecondsPerQuestion?: number;
  /** Metadata copied into the submission context for typed application integrations. */
  readonly submissionMetadata?: BaseSubmissionMetadata;
  readonly messages?: Partial<FormRendererMessages>;
  readonly messageResolver?: (key: keyof FormRendererMessages, defaultText: string) => string;
  readonly autoSaveKey?: string;
  readonly draftResume?: { readonly maxAgeMs?: number };
  readonly beforeSubmit?: BeforeSubmit;
  readonly onDraftSave?: (draft: FormValues) => void;
  readonly fieldConfig?: Readonly<Record<string, FormRendererFieldConfig>>;
  readonly slots?: FormRendererSlots;
  /** Optional controller used directly for submission lifecycle, retry, and attempt identity. */
  readonly controller?: SubmissionController<SubmitResponse> | ScopedSubmissionController<BaseSubmissionMetadata>;
  readonly telemetry?: FormTelemetryOptions;
  /** @deprecated Use controller instead. */
  readonly submissionController?:
    | SubmissionController<SubmitResponse>
    | ScopedSubmissionController<BaseSubmissionMetadata>;
}

export interface StandaloneFormRendererProps extends FormRendererPresentationProps {
  readonly schema: FormSchema;
  readonly policy?: FormPolicy;
  readonly locale?: string;
  readonly translator?: TranslationAdapter;
  readonly initialValues?: FormValues;
  readonly resetOnSuccess?: boolean;
  readonly onSubmit?: FormSubmitHandler;
}

export interface TypedFormRendererPresentationProps<TMeta extends BaseSubmissionMetadata = FormSubmissionMetadata>
  extends Omit<FormRendererPresentationProps, "submissionMetadata" | "submissionIdentity"> {
  readonly submissionMetadata?: TMeta;
  readonly submissionIdentity?: SubmissionIdentity<TMeta>;
}

export interface TypedStandaloneFormRendererProps<TMeta extends BaseSubmissionMetadata = FormSubmissionMetadata>
  extends TypedFormRendererPresentationProps<TMeta> {
  readonly schema: FormSchema;
  readonly policy?: FormPolicy;
  readonly locale?: string;
  readonly translator?: TranslationAdapter;
  readonly initialValues?: FormValues;
  readonly resetOnSuccess?: boolean;
  readonly onSubmit?: TypedFormSubmitHandler<TMeta>;
}

export type TypedFormRendererProps<TMeta extends BaseSubmissionMetadata = FormSubmissionMetadata> =
  | TypedFormRendererPresentationProps<TMeta>
  | TypedStandaloneFormRendererProps<TMeta>;

export type FormRendererProps = FormRendererPresentationProps | StandaloneFormRendererProps;

function isScopedSubmissionController(
  controller: SubmissionController<SubmitResponse> | ScopedSubmissionController<BaseSubmissionMetadata>
): controller is ScopedSubmissionController<BaseSubmissionMetadata> {
  return "scope" in controller.getState();
}

function createControllerSubmitHandler<TMeta extends BaseSubmissionMetadata>(
  controller: SubmissionController<SubmitResponse, TMeta> | ScopedSubmissionController<TMeta>
): TypedFormSubmitHandler<TMeta> {
  return async (answers, context) => {
    const result = isScopedSubmissionController(
      controller as SubmissionController<SubmitResponse> | ScopedSubmissionController<BaseSubmissionMetadata>
    )
      ? await (controller as ScopedSubmissionController<TMeta>).submit(answers, context.locale)
      : await (controller as SubmissionController<SubmitResponse, TMeta>).submit(answers, context);
    if (result.status === "error") throw result.error;
    if (result.status === "cancelled") throw new Error("Submission was cancelled.");
    if (result.response === undefined) return undefined;
    if (
      isScopedSubmissionController(
        controller as SubmissionController<SubmitResponse> | ScopedSubmissionController<BaseSubmissionMetadata>
      )
    ) {
      const state = (controller as ScopedSubmissionController<TMeta>).getState();
      return {
        ...(state.submission?.id === undefined ? {} : { submissionId: state.submission.id }),
        ...(state.submission?.submittedAt === undefined ? {} : { submittedAt: state.submission.submittedAt }),
        ...(result.response.receiptId === undefined ? {} : { receiptId: result.response.receiptId })
      };
    }
    return result.response;
  };
}

interface StoredDraft {
  readonly formId: string;
  readonly formVersion: number;
  readonly values: Readonly<Record<string, FormValue>>;
  readonly savedAt: string;
  readonly pageId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function displaySubmittedValue(field: FormField, value: unknown, translate: (key: string) => string): string {
  if (value === undefined || value === null) return "";
  if (field.type === "checkbox") return value === true ? translate("form.yes") : translate("form.no");
  if (field.type === "multi-select" && Array.isArray(value)) {
    const labels = new Map(field.options.map((option) => [option.id, option.label]));
    return value.map((item) => labels.get(item) ?? item).join(", ");
  }
  if (field.type === "radio" || field.type === "select") {
    const optionId = selectedOptionId(value);
    if (optionId === undefined) return String(value);
    const label = field.options.find((option) => option.id === optionId)?.label ?? optionId;
    return isRadioTextAnswer(value) && value.text.length > 0 ? `${label} — ${value.text}` : label;
  }
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function buildSubmittedItems(
  schema: FormSchema,
  answers: FormValues,
  visibility: Readonly<Record<string, boolean>>,
  translate: (key: string) => string,
  showHiddenFields: boolean
): readonly FormSubmittedAnswerItem[] {
  return schema.fields
    .filter((field) => showHiddenFields || visibility[field.id] === true)
    .map((field) => ({
      fieldId: field.id,
      title: field.title,
      type: field.type,
      rawValue: answers[field.id],
      displayValue: displaySubmittedValue(field, answers[field.id], translate),
      visible: visibility[field.id] === true,
      ...(field.metadata === undefined ? {} : { metadata: field.metadata })
    }));
}

function formatRendererMessage(template: string, params: Readonly<Record<string, string | number>> = {}): string {
  return template.replace(/\{\{?(\w+)\}\}?/gu, (token, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : token
  );
}

function parseDraft(serialized: string): StoredDraft | null {
  try {
    const value: unknown = JSON.parse(serialized);
    if (
      !isRecord(value) ||
      typeof value.formId !== "string" ||
      typeof value.formVersion !== "number" ||
      !Number.isInteger(value.formVersion) ||
      typeof value.savedAt !== "string" ||
      !isRecord(value.values) ||
      !Object.values(value.values).every(isFormValue)
    ) {
      return null;
    }
    return {
      formId: value.formId,
      formVersion: value.formVersion,
      savedAt: value.savedAt,
      ...(typeof value.pageId === "string" ? { pageId: value.pageId } : {}),
      values: Object.fromEntries(
        Object.entries(value.values).filter((entry): entry is [string, FormValue] => isFormValue(entry[1]))
      )
    };
  } catch {
    return null;
  }
}

const DEFAULT_RENDERER_MESSAGES: Readonly<Record<"en" | "ja", FormRendererMessages>> = {
  en: {
    submitButton: "Submit",
    submittingButton: "Submitting...",
    retryButton: "Retry",
    requiredField: "This field is required.",
    validationSummary: "There is {{count}} validation error.",
    validationSummaryPlural: "There are {{count}} validation errors.",
    alreadySubmittedTitle: "Already Submitted",
    alreadySubmittedMessage: "Already submitted.",
    formClosedTitle: "Form closed",
    formClosedMessage: "This form is closed.",
    formNotYetOpenTitle: "Not open yet",
    formNotYetOpenMessage: "This form is not open yet.",
    responseLimitReachedTitle: "Response limit reached",
    responseLimitReachedMessage: "This form has reached its response limit.",
    progressLabel: "Progress",
    remainingQuestions: "{{count}} remaining",
    serverErrorSummary: "Submission failed. Please check your answers and try again.",
    confirmSensitiveDataTitle: "Sensitive data may be included",
    confirmSensitiveDataMessage: "The following answers may contain personal information. Continue submitting?",
    confirmButton: "Proceed",
    cancelButton: "Cancel",
    draftResumeTitle: "Continue your response",
    draftResumeMessage: "A saved response from this browser is available. It has not been submitted.",
    draftResumeContinue: "Continue where you left off",
    draftResumeStartOver: "Start over",
    draftResumeEnabled: "Save my response on this device for 7 days",
    draftResumeDisabled: "Do not save my response on this device",
    draftSaved: "Saved on this device",
    draftSaveFailed: "This response could not be saved on this device.",
    draftDeleteFailed: "The saved response could not be removed."
  },
  ja: {
    submitButton: "送信する",
    submittingButton: "送信中...",
    retryButton: "再送信する",
    requiredField: "この項目は必須です",
    validationSummary: "{{count}}件の入力エラーがあります。",
    validationSummaryPlural: "{{count}}件の入力エラーがあります。",
    alreadySubmittedTitle: "回答済みです",
    alreadySubmittedMessage: "このアンケートにはすでに回答しています。",
    formClosedTitle: "受付終了",
    formClosedMessage: "このフォームの受付は終了しています。",
    formNotYetOpenTitle: "受付開始前",
    formNotYetOpenMessage: "このフォームはまだ受付を開始していません。",
    responseLimitReachedTitle: "回答上限に達しました",
    responseLimitReachedMessage: "このフォームは回答上限に達しています。",
    progressLabel: "進捗",
    remainingQuestions: "残り{{count}}問",
    serverErrorSummary: "送信に失敗しました。内容をご確認の上、再度お試しください。",
    confirmSensitiveDataTitle: "個人情報が含まれている可能性があります",
    confirmSensitiveDataMessage: "以下の項目に個人情報とみられる記述があります。このまま送信してもよろしいですか？",
    confirmButton: "このまま送信",
    cancelButton: "修正する",
    draftResumeTitle: "回答を続ける",
    draftResumeMessage: "このブラウザーに保存された未送信の回答があります。",
    draftResumeContinue: "続きから回答する",
    draftResumeStartOver: "最初から回答する",
    draftResumeEnabled: "この端末に回答を7日間保存する",
    draftResumeDisabled: "この端末に回答を保存しない",
    draftSaved: "この端末に一時保存しました",
    draftSaveFailed: "この端末に回答を保存できませんでした。",
    draftDeleteFailed: "保存された回答を削除できませんでした。"
  }
};

function maskSensitiveValue(finding: SensitiveDataFinding): string | undefined {
  if (finding.maskedText !== undefined) return finding.maskedText;
  const value = finding.matchedText;
  if (value === undefined) return undefined;
  if (finding.type === "email") {
    const separator = value.indexOf("@");
    if (separator > 0) return `${value.slice(0, Math.min(2, separator))}***${value.slice(separator)}`;
  }
  if (finding.type === "phone" || finding.type === "postal_code") return "***";
  return value.length <= 2 ? "***" : `${value.slice(0, 2)}***`;
}

function sensitiveValueForDisplay(
  finding: SensitiveDataFinding,
  mode: "full" | "masked" | "type" | "hidden"
): string | undefined {
  if (mode === "hidden" || mode === "type") return undefined;
  return mode === "full" ? finding.matchedText : maskSensitiveValue(finding);
}

function ContextFormRenderer<TMeta extends BaseSubmissionMetadata = FormSubmissionMetadata>({
  components = {},
  className = "",
  successMessageKey,
  errorMessageKey,
  attemptIdFactory,
  acceptance,
  challengeToken,
  clientKey,
  optionOrderSeed: providedOptionOrderSeed,
  ratingDisplay = "stars",
  ratingStarSize,
  estimateSecondsPerQuestion,
  idFormat: providedIdFormat = "uuid",
  submissionMetadata,
  messages = {},
  messageResolver,
  autoSaveKey,
  draftResume,
  beforeSubmit,
  onDraftSave,
  fieldConfig,
  successRenderMode = "append",
  appearance,
  pageTransition,
  slotProps,
  primitiveComponents = {},
  groupedChoiceFields = false,
  submissionConfirmation,
  submissionConfirmationRenderMode,
  showHiddenFieldsInSummary = false,
  fieldsClassName,
  classNames,
  hideFormOnSuccess = false,
  submissionGuards = [],
  receiptStore: providedReceiptStore,
  submissionScope: providedSubmissionScope,
  attemptStore: providedAttemptStore,
  submissionIdentity,
  onReceiptError,
  telemetry,
  slots = {}
}: TypedFormRendererPresentationProps<TMeta>) {
  const form = useForm<TMeta>();
  const telemetryRuntime = useFormTelemetry(form.schema, telemetry);
  const idFormat = submissionIdentity?.idFormat ?? providedIdFormat;
  const receiptStore = submissionIdentity?.receiptStore ?? providedReceiptStore;
  const submissionScope =
    submissionIdentity === undefined
      ? providedSubmissionScope
      : {
          ...(submissionIdentity.scope.deckId === undefined ? {} : { deckId: submissionIdentity.scope.deckId }),
          ...(submissionIdentity.scope.sessionId === undefined
            ? {}
            : { sessionId: submissionIdentity.scope.sessionId }),
          ...(submissionIdentity.scope.userId === undefined ? {} : { userId: submissionIdentity.scope.userId }),
          ...(submissionIdentity.scope.tenantId === undefined ? {} : { tenantId: submissionIdentity.scope.tenantId })
        };
  const attemptStore = submissionIdentity?.attemptStore ?? providedAttemptStore;
  const identityOptionOrderSeed =
    providedOptionOrderSeed ??
    submissionIdentity?.scope.sessionId ??
    submissionIdentity?.scope.userId ??
    submissionIdentity?.scope.tenantId ??
    submissionIdentity?.scope.deckId;
  const i18n = useFormEngineI18n();
  const isProviderValue = useContext(FormEngineI18nProviderScopeContext);
  const prefix = useId().replace(/:/g, "");
  const formRef = useRef<HTMLFormElement>(null);
  const pageHeaderRef = useRef<HTMLElement>(null);
  const pageNavigationPending = useRef(false);
  const pageVisibilityInitialized = useRef(false);
  const loadedDraftKey = useRef<string | null>(null);
  const draftBaselineRef = useRef<string | null>(null);
  const draftClearedAfterSubmitRef = useRef(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftCandidate, setDraftCandidate] = useState<StoredDraft | null>(null);
  const [draftResumeState, setDraftResumeState] = useState<"checking" | "ready" | "choice">("ready");
  const [draftSavingEnabled, setDraftSavingEnabled] = useState(true);
  const [draftSaveStatus, setDraftSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [draftStorageError, setDraftStorageError] = useState<string>();
  const [draftStorageErrorKind, setDraftStorageErrorKind] = useState<"save" | "delete">("save");
  const [resumePageId, setResumePageId] = useState<string | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [focusFieldId, setFocusFieldId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    readonly findings: readonly SensitiveDataFinding[];
    readonly message?: string;
    readonly generic: boolean;
  } | null>(null);
  const [guardMessage, setGuardMessage] = useState<string | null>(null);
  const [honeypotValue, setHoneypotValue] = useState("");
  const [resolvedSubmissionCount, setResolvedSubmissionCount] = useState<number | undefined>(
    typeof acceptance?.submissionCount === "number" ? acceptance.submissionCount : undefined
  );
  const [acceptanceLoadError, setAcceptanceLoadError] = useState<Error | null>(null);
  const [acceptanceReloadRevision, setAcceptanceReloadRevision] = useState(0);
  const [, refreshAcceptanceStatus] = useState(0);
  const [guardsPending, setGuardsPending] = useState(false);
  const [receipt, setReceipt] = useState<SubmissionReceipt | null>(null);
  const [completionData, setCompletionData] = useState<{
    readonly answers: Readonly<Record<string, unknown>>;
    readonly submittedItems: readonly FormSubmittedAnswerItem[];
    readonly response?: SubmitResponse;
  } | null>(null);
  const [receiptLoaded, setReceiptLoaded] = useState(receiptStore === undefined);
  const rendererSubmissionInFlight = useRef(false);
  const acceptanceReloadRevisionRef = useRef(0);
  const fallbackAttemptId = useRef<string | null>(null);
  const confirmedSubmissionSignature = useRef<string | null>(null);
  const piiWarningAcknowledged = useRef(false);
  const completionRef = useRef<HTMLDivElement>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const effectiveAttemptStore = useMemo(
    () => attemptStore ?? createLocalStorageSubmissionAttemptStore({ idFormat }),
    [attemptStore, idFormat]
  );
  const [attemptOptionOrderSeed, setAttemptOptionOrderSeed] = useState<string>();
  const optionOrderSeed = identityOptionOrderSeed ?? attemptOptionOrderSeed;
  useEffect(() => {
    if (identityOptionOrderSeed !== undefined) {
      setAttemptOptionOrderSeed(undefined);
      return undefined;
    }
    let active = true;
    const scope = { formId: form.schema.id, formVersion: form.schema.version, ...(submissionScope ?? {}) };
    void (
      submissionIdentity !== undefined
        ? submissionIdentity.getOrCreateAttempt()
        : effectiveAttemptStore.getOrCreateForScope === undefined
          ? effectiveAttemptStore.getOrCreate(form.schema.id, form.schema.version, attemptIdFactory)
          : effectiveAttemptStore.getOrCreateForScope(scope, idFormat, attemptIdFactory)
    )
      .then((attempt) => {
        if (active) setAttemptOptionOrderSeed(attempt.attemptId);
      })
      .catch(() => {
        if (!active) return;
        try {
          const fallback = fallbackAttemptId.current ?? createSubmissionId(idFormat, attemptIdFactory);
          fallbackAttemptId.current = fallback;
          setAttemptOptionOrderSeed(fallback);
        } catch {
          setAttemptOptionOrderSeed(undefined);
        }
      });
    return () => {
      active = false;
    };
  }, [
    attemptIdFactory,
    effectiveAttemptStore,
    form.schema.id,
    form.schema.version,
    idFormat,
    identityOptionOrderSeed,
    submissionIdentity,
    submissionScope
  ]);
  const pages = form.schema.pages;
  const visiblePageIndexes = useMemo(
    () =>
      pages === undefined ? [] : pages.flatMap((page, index) => (form.pageVisibility[page.id] === true ? [index] : [])),
    [form.pageVisibility, pages]
  );
  const activePage = pages?.[currentPageIndex];
  const activeVisibleIndex = visiblePageIndexes.indexOf(currentPageIndex);
  const progress = useMemo(() => {
    const base = calculateProgress(form.schema, form.values, currentPageIndex);
    if (estimateSecondsPerQuestion === undefined || estimateSecondsPerQuestion < 0) return base;
    return {
      ...base,
      estimatedSecondsRemaining: Math.ceil(base.remainingQuestions * estimateSecondsPerQuestion)
    };
  }, [currentPageIndex, estimateSecondsPerQuestion, form.schema, form.values]);
  const honeypotFieldId = form.schema.submissionSettings?.honeypotFieldId;
  const reloadAcceptanceCount = useCallback(() => {
    setAcceptanceLoadError(null);
    acceptanceReloadRevisionRef.current += 1;
    setAcceptanceReloadRevision(acceptanceReloadRevisionRef.current);
  }, []);
  useEffect(() => {
    const requestRevision = acceptanceReloadRevision;
    if (typeof acceptance?.submissionCount !== "function") {
      setResolvedSubmissionCount(acceptance?.submissionCount);
      setAcceptanceLoadError(null);
      return undefined;
    }
    let active = true;
    void Promise.resolve(acceptance.submissionCount()).then(
      (count) => {
        if (!active || requestRevision !== acceptanceReloadRevisionRef.current) return;
        setResolvedSubmissionCount(count);
        setAcceptanceLoadError(null);
      },
      (cause: unknown) => {
        if (!active || requestRevision !== acceptanceReloadRevisionRef.current) return;
        setAcceptanceLoadError(cause instanceof Error ? cause : new Error(String(cause)));
      }
    );
    return () => {
      active = false;
    };
  }, [acceptance?.submissionCount, acceptanceReloadRevision]);
  const acceptanceStatus = getFormAcceptanceStatus(form.schema, {
    now: acceptance?.now?.() ?? new Date(),
    ...(resolvedSubmissionCount === undefined ? {} : { submissionCount: resolvedSubmissionCount })
  });
  const fieldIds = activePage === undefined ? undefined : new Set(activePage.questionIds);
  const visibleValues = useMemo(() => selectVisibleAnswers(form.schema, form.values), [form.schema, form.values]);
  const visibleItems = useMemo(
    () => buildSubmittedItems(form.schema, form.values, form.visibility, (key) => form.translate(key), false),
    [form.schema, form.translate, form.values, form.visibility]
  );
  const confirmationRenderMode: SubmissionConfirmationRenderMode =
    submissionConfirmation?.renderMode ??
    submissionConfirmationRenderMode ??
    (form.schema.submissionSettings?.confirmationRenderMode as SubmissionConfirmationRenderMode | undefined) ??
    "inline";
  const confirmationEnabled =
    submissionConfirmation?.enabled ?? form.schema.submissionSettings?.showConfirmationBeforeSubmit ?? false;
  const confirmationRecheck = submissionConfirmation?.recheck ?? "always";
  const submitState: FormSubmitStatus = confirmation === null && !guardsPending ? form.submitStatus : "confirming";
  const interactionLocked = submitState === "confirming" || submitState === "submitting";
  const isReplaceMode = successRenderMode === "replace" || hideFormOnSuccess;
  const telemetryFormVisible =
    receiptLoaded &&
    receipt === null &&
    acceptanceStatus.accepted &&
    (draftResume === undefined || autoSaveKey === undefined || draftResumeState === "ready");

  useEffect(() => {
    if (telemetryFormVisible && formRef.current !== null) telemetryRuntime.formViewed();
  }, [telemetryFormVisible, telemetryRuntime]);

  useEffect(() => {
    if (!telemetryFormVisible || formRef.current === null || activePage === undefined) return;
    telemetryRuntime.pageViewed(activePage.id);
  }, [activePage, telemetryFormVisible, telemetryRuntime]);

  useEffect(() => {
    if (!telemetryFormVisible || formRef.current === null) return;
    for (const field of form.schema.fields) {
      if (form.visibility[field.id] !== true || (fieldIds !== undefined && !fieldIds.has(field.id))) continue;
      telemetryRuntime.fieldPresented(field, activePage?.id);
    }
  }, [activePage?.id, fieldIds, form.schema.fields, form.visibility, telemetryFormVisible, telemetryRuntime]);

  const resolveMessage = useCallback(
    (
      key: keyof FormRendererMessages,
      fallback?: string,
      params: Readonly<Record<string, string | number>> = {}
    ): string => {
      const providerDefault = isProviderValue ? i18n.translator(`renderer.${key}`, params) : undefined;
      const defaultText =
        fallback ??
        (providerDefault === "" ? undefined : providerDefault) ??
        DEFAULT_RENDERER_MESSAGES[form.locale.toLowerCase().startsWith("ja") ? "ja" : "en"][key] ??
        key;
      const configured = messages[key];
      const resolved = messageResolver?.(key, configured ?? defaultText) ?? configured ?? defaultText;
      return formatRendererMessage(resolved, params);
    },
    [form.locale, i18n, isProviderValue, messageResolver, messages]
  );

  const fieldTranslate = useCallback(
    (key: string, params?: Readonly<Record<string, string | number>>) =>
      key === "validation.required" && (messages.requiredField !== undefined || messageResolver !== undefined)
        ? resolveMessage("requiredField")
        : form.translate(key, params),
    [form.translate, messageResolver, messages.requiredField, resolveMessage]
  );

  const focusSubmitButton = useCallback(() => {
    const button = formRef.current?.querySelector<HTMLElement>(".fe-submit, button[type='submit'], button");
    button?.focus();
  }, []);

  const renderRespondentButton = ({
    type,
    kind,
    disabled,
    className,
    children,
    onClick,
    dataConfirm
  }: RespondentButtonProps & { readonly dataConfirm?: boolean }): ReactNode => {
    if (primitiveComponents.Button !== undefined) {
      const button = (
        <primitiveComponents.Button
          type={type}
          {...(kind === undefined ? {} : { kind })}
          {...(disabled === undefined ? {} : { disabled })}
          {...(className === undefined ? {} : { className })}
          {...(onClick === undefined ? {} : { onClick })}
        >
          {children}
        </primitiveComponents.Button>
      );
      return dataConfirm === true ? <span data-fe-confirm="true">{button}</span> : button;
    }
    return (
      <button type={type} disabled={disabled} className={className} onClick={onClick} data-fe-confirm={dataConfirm}>
        {children}
      </button>
    );
  };

  const draftResumeEnabled = draftResume !== undefined && autoSaveKey !== undefined;
  const removeDraft = useCallback(() => {
    if (autoSaveKey === undefined || typeof globalThis.localStorage === "undefined") return;
    try {
      globalThis.localStorage.removeItem(autoSaveKey);
      setDraftStorageError(undefined);
    } catch (cause) {
      setDraftStorageErrorKind("delete");
      setDraftStorageError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [autoSaveKey]);
  const resumeDraft = useCallback(() => {
    if (draftCandidate === null) return;
    form.restoreValues(draftCandidate.values);
    draftBaselineRef.current = JSON.stringify({
      values: draftCandidate.values,
      ...(draftCandidate.pageId === undefined ? {} : { pageId: draftCandidate.pageId })
    });
    setResumePageId(draftCandidate.pageId ?? null);
    setDraftCandidate(null);
    setDraftRestored(true);
    setDraftResumeState("ready");
    globalThis.setTimeout(() => pageHeaderRef.current?.focus(), 0);
  }, [draftCandidate, form.restoreValues]);
  const startDraftOver = useCallback(() => {
    removeDraft();
    form.reset();
    setCurrentPageIndex(0);
    setDraftCandidate(null);
    setDraftRestored(false);
    setDraftResumeState("ready");
    draftBaselineRef.current = JSON.stringify({ values: {}, pageId: undefined });
  }, [form.reset, removeDraft]);
  const toggleDraftSaving = useCallback(
    (enabled: boolean) => {
      setDraftSavingEnabled(enabled);
      if (autoSaveKey === undefined || typeof globalThis.localStorage === "undefined") return;
      try {
        globalThis.localStorage.setItem(`${autoSaveKey}:settings`, enabled ? "true" : "false");
        if (!enabled) removeDraft();
      } catch (cause) {
        setDraftStorageError(cause instanceof Error ? cause.message : String(cause));
      }
    },
    [autoSaveKey, removeDraft]
  );
  const draftSlotProps: FormDraftResumeSlotProps = {
    mode: draftCandidate === null ? "settings" : "prompt",
    ...(draftCandidate === null ? {} : { savedAt: draftCandidate.savedAt }),
    savingEnabled: draftSavingEnabled,
    storageAvailable: typeof globalThis.localStorage !== "undefined",
    saveStatus: draftSaveStatus,
    ...(draftStorageError === undefined ? {} : { error: draftStorageError }),
    ...(draftStorageError === undefined ? {} : { errorKind: draftStorageErrorKind }),
    onResume: resumeDraft,
    onStartOver: startDraftOver,
    onToggleSaving: toggleDraftSaving
  };
  const draftResumeContent =
    slots.renderDraftResume?.(draftSlotProps) ??
    (draftSlotProps.mode === "prompt" ? (
      <section className="fe-draft-resume" aria-labelledby={`${prefix}-draft-title`}>
        <h2 id={`${prefix}-draft-title`}>{resolveMessage("draftResumeTitle")}</h2>
        <p>{resolveMessage("draftResumeMessage")}</p>
        {renderRespondentButton({
          type: "button",
          kind: "draft-resume",
          onClick: resumeDraft,
          children: resolveMessage("draftResumeContinue")
        })}{" "}
        {renderRespondentButton({
          type: "button",
          kind: "draft-start-over",
          onClick: startDraftOver,
          children: resolveMessage("draftResumeStartOver")
        })}
      </section>
    ) : (
      <section className="fe-draft-settings" aria-label={resolveMessage("draftResumeTitle")}>
        <label>
          <input
            type="checkbox"
            checked={draftSavingEnabled}
            disabled={!draftSlotProps.storageAvailable}
            onChange={(event) => toggleDraftSaving(event.currentTarget.checked)}
          />{" "}
          {draftSavingEnabled ? resolveMessage("draftResumeEnabled") : resolveMessage("draftResumeDisabled")}
        </label>
        {draftSaveStatus === "saved" ? <span role="status"> {resolveMessage("draftSaved")}</span> : null}
        {draftStorageError === undefined ? null : (
          <span role="alert">
            {" "}
            {resolveMessage(draftStorageErrorKind === "delete" ? "draftDeleteFailed" : "draftSaveFailed")}
          </span>
        )}
      </section>
    ));

  useEffect(() => {
    let active = true;
    if (receiptStore === undefined) {
      setReceipt(null);
      setReceiptLoaded(true);
      return () => {
        active = false;
      };
    }
    setReceiptLoaded(false);
    void receiptStore
      .get(form.schema.id, form.schema.version, submissionScope)
      .then((stored) => {
        if (active) setReceipt(stored);
      })
      .catch(() => {
        if (active) setReceipt(null);
      })
      .finally(() => {
        if (active) setReceiptLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [form.schema.id, form.schema.version, receiptStore, submissionScope]);

  useEffect(() => {
    if (pages === undefined || visiblePageIndexes.length === 0) {
      pageNavigationPending.current = false;
      setCurrentPageIndex(0);
      pageVisibilityInitialized.current = true;
      return;
    }
    if (!visiblePageIndexes.includes(currentPageIndex)) {
      if (pageVisibilityInitialized.current) pageNavigationPending.current = true;
      setCurrentPageIndex(visiblePageIndexes[0] ?? 0);
    }
    pageVisibilityInitialized.current = true;
  }, [currentPageIndex, pages, visiblePageIndexes]);

  useEffect(() => {
    if (focusFieldId === null) return;
    const fieldContainer = [...(formRef.current?.querySelectorAll<HTMLElement>("[data-field-id]") ?? [])].find(
      (element) => element.dataset.fieldId === focusFieldId
    );
    const control = fieldContainer?.querySelector<HTMLElement>("input, select, textarea");
    if (control !== undefined && control !== null) {
      const behavior = resolveScrollBehavior(pageTransition);
      if (behavior !== undefined) control.scrollIntoView?.({ behavior, block: "center" });
      control.focus();
      setFocusFieldId(null);
    }
  }, [focusFieldId, pageTransition]);

  useEffect(() => {
    if (!pageNavigationPending.current) return;
    if (focusFieldId !== null) {
      pageNavigationPending.current = false;
      return;
    }
    if (activePage === undefined) {
      pageNavigationPending.current = false;
      return;
    }
    pageNavigationPending.current = false;
    const behavior = resolveScrollBehavior(pageTransition);
    const focus = pageTransition?.focus ?? "page-header";
    const firstField =
      focus === "first-field"
        ? formRef.current?.querySelector<HTMLElement>(
            "[data-field-id] input, [data-field-id] select, [data-field-id] textarea"
          )
        : undefined;
    const target = focus === "first-field" ? firstField : pageHeaderRef.current;
    if (target !== undefined && target !== null) {
      if (behavior !== undefined)
        target.scrollIntoView?.({ behavior, block: focus === "first-field" ? "center" : "start" });
      if (focus !== "none") target.focus();
    }
  }, [activePage, focusFieldId, pageTransition]);

  useEffect(() => {
    if (!isReplaceMode || form.submitStatus !== "success") return;
    completionRef.current?.focus();
  }, [form.submitStatus, isReplaceMode]);

  useEffect(() => {
    if (confirmation === null) return;
    const confirmButton = confirmationRef.current?.querySelector<HTMLElement>(
      "[data-fe-confirm] button, button[data-fe-confirm], button"
    );
    confirmButton?.focus();
    if (confirmationRenderMode !== "dialog") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setConfirmation(null);
        globalThis.setTimeout(focusSubmitButton, 0);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [
        ...(confirmationRef.current?.querySelectorAll<HTMLElement>(
          "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
        ) ?? [])
      ].filter((element) => !element.hasAttribute("disabled"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    globalThis.addEventListener("keydown", onKeyDown);
    return () => globalThis.removeEventListener("keydown", onKeyDown);
  }, [confirmation, confirmationRenderMode, focusSubmitButton]);

  useEffect(() => {
    if (autoSaveKey === undefined || typeof globalThis.localStorage === "undefined") {
      if (draftResume !== undefined && autoSaveKey !== undefined) setDraftResumeState("ready");
      return;
    }
    const loadIdentity = `${autoSaveKey}:${form.schema.id}:${form.schema.version}:${draftResume?.maxAgeMs ?? "default"}`;
    if (loadedDraftKey.current === loadIdentity) return;
    loadedDraftKey.current = loadIdentity;
    if (draftResume === undefined) {
      try {
        const serialized = globalThis.localStorage.getItem(autoSaveKey);
        if (serialized === null) return;
        const draft = parseDraft(serialized);
        if (draft === null || draft.formId !== form.schema.id || draft.formVersion !== form.schema.version) return;
        form.restoreValues(draft.values);
        setDraftRestored(true);
      } catch {
        // Existing auto-save behavior must remain best effort.
      }
      return;
    }
    setDraftResumeState("checking");
    const settingsKey = `${autoSaveKey}:settings`;
    try {
      const savingEnabled = globalThis.localStorage.getItem(settingsKey) !== "false";
      setDraftSavingEnabled(savingEnabled);
      const serialized = globalThis.localStorage.getItem(autoSaveKey);
      if (serialized === null || !savingEnabled) {
        draftBaselineRef.current = JSON.stringify({ values: form.values });
        setDraftResumeState("ready");
        return;
      }
      const draft = parseDraft(serialized);
      const configuredMaxAgeMs = draftResume.maxAgeMs;
      const maxAgeMs =
        configuredMaxAgeMs !== undefined && Number.isFinite(configuredMaxAgeMs) && configuredMaxAgeMs > 0
          ? configuredMaxAgeMs
          : 7 * 24 * 60 * 60 * 1000;
      const savedAt = draft === null ? NaN : Date.parse(draft.savedAt);
      const valid =
        draft !== null &&
        draft.formId === form.schema.id &&
        draft.formVersion === form.schema.version &&
        Number.isFinite(savedAt) &&
        savedAt <= Date.now() &&
        Date.now() - savedAt <= maxAgeMs;
      if (!valid) {
        globalThis.localStorage.removeItem(autoSaveKey);
        draftBaselineRef.current = JSON.stringify({ values: form.values });
        setDraftResumeState("ready");
        return;
      }
      draftBaselineRef.current = JSON.stringify({
        values: draft.values,
        ...(draft.pageId === undefined ? {} : { pageId: draft.pageId })
      });
      setDraftCandidate(draft);
      setDraftResumeState("choice");
    } catch (cause) {
      setDraftStorageError(cause instanceof Error ? cause.message : String(cause));
      setDraftResumeState("ready");
    }
  }, [autoSaveKey, draftResume, form.restoreValues, form.schema.id, form.schema.version, form.values]);

  useEffect(() => {
    if (form.submitStatus === "success" || draftResumeState !== "ready" || !draftSavingEnabled) return;
    if (draftClearedAfterSubmitRef.current && Object.keys(form.values).length === 0) return;
    draftClearedAfterSubmitRef.current = false;
    const baseline = JSON.stringify({
      values: form.values,
      ...(activePage?.id === undefined ? {} : { pageId: activePage.id })
    });
    if (draftResume !== undefined && baseline === draftBaselineRef.current) return;
    const timeout = globalThis.setTimeout(() => {
      onDraftSave?.(form.values);
      if (autoSaveKey === undefined || typeof globalThis.localStorage === "undefined") return;
      setDraftSaveStatus("saving");
      const draft: StoredDraft = {
        formId: form.schema.id,
        formVersion: form.schema.version,
        values: form.values,
        ...(activePage?.id === undefined ? {} : { pageId: activePage.id }),
        savedAt: new Date().toISOString()
      };
      try {
        globalThis.localStorage.setItem(autoSaveKey, JSON.stringify(draft));
        draftBaselineRef.current = JSON.stringify({
          values: form.values,
          ...(activePage?.id === undefined ? {} : { pageId: activePage.id })
        });
        setDraftSaveStatus("saved");
        setDraftStorageError(undefined);
      } catch (cause) {
        setDraftStorageErrorKind("save");
        setDraftSaveStatus("error");
        setDraftStorageError(cause instanceof Error ? cause.message : String(cause));
      }
    }, 500);
    return () => globalThis.clearTimeout(timeout);
  }, [
    activePage?.id,
    autoSaveKey,
    draftResumeState,
    draftSavingEnabled,
    form.schema.id,
    form.schema.version,
    form.submitStatus,
    form.values,
    onDraftSave,
    draftResume
  ]);

  useEffect(() => {
    if (
      !draftResumeEnabled ||
      !draftSavingEnabled ||
      autoSaveKey === undefined ||
      form.submitStatus === "success" ||
      (draftClearedAfterSubmitRef.current && Object.keys(form.values).length === 0) ||
      typeof globalThis.localStorage === "undefined"
    )
      return;
    const persistBeforeLeave = () => {
      const baseline = JSON.stringify({
        values: form.values,
        ...(activePage?.id === undefined ? {} : { pageId: activePage.id })
      });
      if (baseline === draftBaselineRef.current) return;
      const draft: StoredDraft = {
        formId: form.schema.id,
        formVersion: form.schema.version,
        values: form.values,
        ...(activePage?.id === undefined ? {} : { pageId: activePage.id }),
        savedAt: new Date().toISOString()
      };
      try {
        globalThis.localStorage.setItem(autoSaveKey, JSON.stringify(draft));
        draftBaselineRef.current = baseline;
      } catch {
        // Leaving the page must not block the response.
      }
    };
    globalThis.addEventListener("pagehide", persistBeforeLeave);
    return () => globalThis.removeEventListener("pagehide", persistBeforeLeave);
  }, [
    activePage?.id,
    autoSaveKey,
    draftResumeEnabled,
    draftSavingEnabled,
    form.schema.id,
    form.schema.version,
    form.submitStatus,
    form.values
  ]);

  useEffect(() => {
    if (resumePageId === null || pages === undefined) return;
    const resumedIndex = pages.findIndex(
      (page, index) => page.id === resumePageId && visiblePageIndexes.includes(index)
    );
    setCurrentPageIndex(resumedIndex >= 0 ? resumedIndex : (visiblePageIndexes[0] ?? 0));
    setResumePageId(null);
  }, [pages, resumePageId, visiblePageIndexes]);

  const focusField = (fieldId: string | undefined) => {
    if (fieldId === undefined || form.visibility[fieldId] !== true) return;
    if (!form.schema.fields.some((field) => field.id === fieldId)) return;
    const pageIndex = pages?.findIndex((page) => page.questionIds.includes(fieldId)) ?? -1;
    if (pageIndex >= 0) {
      if (!visiblePageIndexes.includes(pageIndex)) return;
      if (pageIndex !== currentPageIndex) {
        pageNavigationPending.current = true;
        setCurrentPageIndex(pageIndex);
      }
    }
    setFocusFieldId(fieldId);
  };

  const handleIssueSelect = (issue: { readonly fieldId?: string }) => focusField(issue.fieldId);

  const goToPage = (pageIndex: number) => {
    pageNavigationPending.current = true;
    setCurrentPageIndex(pageIndex);
  };

  const handlePrevious = () => {
    if (interactionLocked) return;
    telemetryRuntime.start();
    goToPage(visiblePageIndexes[activeVisibleIndex - 1] ?? 0);
  };

  const handleNext = () => {
    if (interactionLocked) return;
    telemetryRuntime.start();
    const result = form.validatePage(currentPageIndex);
    if (!result.valid) {
      telemetryRuntime.validationFailed("page", result.issues, activePage?.id);
      focusField(result.issues[0]?.fieldId);
      return;
    }
    const nextPageIndex = visiblePageIndexes[activeVisibleIndex + 1];
    if (nextPageIndex !== undefined) {
      if (activePage !== undefined) telemetryRuntime.pageCompleted(activePage.id);
      goToPage(nextPageIndex);
    }
  };

  const runSubmissionGuards = async (
    guards: readonly (SubmissionGuard | FormSubmissionGuard<TMeta>)[],
    guardValues: FormValues,
    submittedAt: string,
    resolvedChallengeToken?: string
  ): Promise<
    | { readonly status: "allow" }
    | {
        readonly status: "confirm" | "block";
        readonly findings: readonly SensitiveDataFinding[];
        readonly message?: string;
      }
  > => {
    const findings: SensitiveDataFinding[] = [];
    let confirmationMessage: string | undefined;
    let requiresConfirmation = false;
    for (const guard of guards) {
      const result =
        guard.length <= 1
          ? await (guard as FormSubmissionGuard<TMeta>)({
              schema: form.schema,
              values: guardValues,
              context: {
                formId: form.schema.id,
                formVersion: form.schema.version,
                locale: form.locale,
                submittedAt,
                ...(resolvedChallengeToken === undefined ? {} : { challengeToken: resolvedChallengeToken }),
                ...(clientKey === undefined ? {} : { clientKey }),
                ...(honeypotFieldId === undefined ? {} : { honeypotValue }),
                ...(submissionMetadata === undefined ? {} : { metadata: submissionMetadata })
              } satisfies SubmissionGuardContext<TMeta>
            })
          : await (guard as SubmissionGuard)(form.schema, guardValues);
      if (result.status === "allow") continue;
      if ("findings" in result && Array.isArray(result.findings)) findings.push(...result.findings);
      if (result.status === "block") {
        return {
          status: "block",
          findings,
          ...(result.message === undefined ? {} : { message: result.message })
        };
      }
      requiresConfirmation = true;
      confirmationMessage ??= result.message;
    }
    return !requiresConfirmation
      ? { status: "allow" }
      : {
          status: "confirm",
          findings,
          ...(confirmationMessage === undefined ? {} : { message: confirmationMessage })
        };
  };

  const confirmationSignature = (findings: readonly SensitiveDataFinding[]) =>
    JSON.stringify({ findings, values: visibleValues });

  const shouldRequestConfirmation = (findings: readonly SensitiveDataFinding[]): boolean => {
    if (confirmationRecheck === "always") return true;
    return confirmedSubmissionSignature.current !== confirmationSignature(findings);
  };

  const submitValues = async (guardsConfirmed = false): Promise<SubmitResult> => {
    if (
      rendererSubmissionInFlight.current ||
      submitState === "submitting" ||
      submitState === "success" ||
      (confirmation !== null && !guardsConfirmed)
    ) {
      return { status: "cancelled" };
    }
    let latestSubmissionCount = resolvedSubmissionCount;
    if (typeof acceptance?.submissionCount === "function") {
      try {
        latestSubmissionCount = await acceptance.submissionCount();
        setResolvedSubmissionCount(latestSubmissionCount);
        setAcceptanceLoadError(null);
      } catch (cause) {
        const error = cause instanceof Error ? cause : new Error(String(cause));
        setAcceptanceLoadError(error);
        return { status: "error", error };
      }
    }
    const latestAcceptanceStatus = getFormAcceptanceStatus(form.schema, {
      now: acceptance?.now?.() ?? new Date(),
      ...(latestSubmissionCount === undefined ? {} : { submissionCount: latestSubmissionCount })
    });
    if (!latestAcceptanceStatus.accepted) {
      refreshAcceptanceStatus((revision) => revision + 1);
      return { status: "cancelled" };
    }
    const validation = validateAnswers(form.schema, form.values);
    const firstInvalidFieldId = validation.issues[0]?.fieldId;
    if (!validation.valid) telemetryRuntime.validationFailed("form", validation.issues);
    const submittedAt = new Date().toISOString();
    const resolvedChallengeToken = typeof challengeToken === "function" ? await challengeToken() : challengeToken;
    const guardValues = {
      ...visibleValues,
      ...(honeypotFieldId === undefined ? {} : { [honeypotFieldId]: honeypotValue })
    };
    if (validation.valid && !guardsConfirmed) {
      rendererSubmissionInFlight.current = true;
      setGuardsPending(submissionGuards.length > 0);
      try {
        if (submissionGuards.length > 0) {
          const guardResult = await runSubmissionGuards(
            submissionGuards,
            guardValues,
            submittedAt,
            resolvedChallengeToken
          );
          if (guardResult.status === "block") {
            setGuardMessage(guardResult.message ?? form.translate("form.submissionBlocked"));
            return { status: "cancelled" };
          }
          if (guardResult.status === "confirm" && shouldRequestConfirmation(guardResult.findings)) {
            setGuardMessage(null);
            setConfirmation({
              findings: guardResult.findings,
              generic: false,
              ...(guardResult.message === undefined ? {} : { message: guardResult.message })
            });
            return { status: "cancelled" };
          }
        }
        if (confirmationEnabled && shouldRequestConfirmation([])) {
          setGuardMessage(null);
          setConfirmation({ findings: [], generic: true });
          return { status: "cancelled" };
        }
      } finally {
        rendererSubmissionInFlight.current = false;
        setGuardsPending(false);
      }
    }
    setGuardMessage(null);
    rendererSubmissionInFlight.current = true;
    try {
      let submissionAttempt: SubmissionAttempt | undefined;
      let attemptId = fallbackAttemptId.current;
      if (effectiveAttemptStore !== undefined) {
        const scope = { formId: form.schema.id, formVersion: form.schema.version, ...(submissionScope ?? {}) };
        submissionAttempt =
          submissionIdentity !== undefined
            ? await submissionIdentity.getOrCreateAttempt()
            : effectiveAttemptStore.getOrCreateForScope === undefined
              ? await effectiveAttemptStore.getOrCreate(form.schema.id, form.schema.version, attemptIdFactory)
              : await effectiveAttemptStore.getOrCreateForScope(scope, idFormat, attemptIdFactory);
        attemptId = submissionAttempt.attemptId;
      } else if (attemptId === null) {
        attemptId = createSubmissionId(idFormat, attemptIdFactory);
        fallbackAttemptId.current = attemptId;
      }
      if (attemptId === null) throw new Error("Unable to create a submission attempt id.");
      const submitContext = {
        attemptId,
        submissionId: attemptId,
        formId: form.schema.id,
        formVersion: form.schema.version,
        locale: form.locale,
        submittedAt,
        ...(resolvedChallengeToken === undefined ? {} : { challengeToken: resolvedChallengeToken }),
        ...(clientKey === undefined ? {} : { clientKey }),
        ...(honeypotFieldId === undefined ? {} : { honeypotValue }),
        ...(piiWarningAcknowledged.current ? { piiWarningAcknowledged: true } : {}),
        ...(submissionMetadata === undefined ? {} : { metadata: submissionMetadata })
      };
      const result = await form.submit(beforeSubmit, submitContext);
      if (
        result.status !== "invalid" &&
        result.status !== "cancelled" &&
        activePage !== undefined &&
        activeVisibleIndex === visiblePageIndexes.length - 1
      ) {
        telemetryRuntime.pageCompleted(activePage.id);
      }
      if (result.status === "invalid") {
        if (validation.valid) telemetryRuntime.validationFailed("form", result.issues);
        focusField(firstInvalidFieldId);
        return result;
      }
      if (result.status === "error") {
        telemetryRuntime.submitFailed();
        const payload =
          result.error instanceof FormSubmissionError
            ? result.error.payload
            : (deserializeSubmissionErrorFromTrpc(result.error)?.payload ??
              (isFormSubmissionSerializedError(result.error) ? result.error : undefined));
        if (payload !== undefined) {
          const fieldErrors = payload.fieldErrors ?? {};
          form.setServerErrors?.(fieldErrors);
          const firstServerFieldId =
            form.schema.fields.find((field) => Object.hasOwn(fieldErrors, field.id))?.id ?? Object.keys(fieldErrors)[0];
          if (firstServerFieldId !== undefined) {
            focusField(firstServerFieldId);
          }
          if (payload.piiFindings !== undefined && payload.piiFindings.length > 0) {
            setConfirmation({ findings: payload.piiFindings, generic: false });
          }
        }
        return result;
      }
      if (result.status !== "success") return result;
      telemetryRuntime.submitted();
      const submittedAnswers = { ...form.values };
      const submittedItems = buildSubmittedItems(
        form.schema,
        submittedAnswers,
        form.visibility,
        (key) => form.translate(key),
        showHiddenFieldsInSummary
      );
      setCompletionData({
        answers: submittedAnswers,
        submittedItems,
        ...(result.response === undefined ? {} : { response: result.response })
      });
      if (receiptStore !== undefined) {
        const response = result.response;
        const submissionId = response?.submissionId ?? submissionAttempt?.attemptId ?? attemptId;
        const storedReceipt: SubmissionReceipt = {
          formId: form.schema.id,
          formVersion: form.schema.version,
          submittedAt: response?.submittedAt ?? submittedAt,
          ...(submissionId === undefined ? {} : { submissionId })
        };
        try {
          if (submissionIdentity !== undefined) await submissionIdentity.saveReceipt(storedReceipt);
          else await receiptStore.save({ ...storedReceipt, ...submissionScope });
        } catch (cause) {
          const error = cause instanceof Error ? cause : new Error(String(cause));
          try {
            onReceiptError?.(error, storedReceipt);
          } catch {
            // Receipt notifications must not change a successful submission result.
          }
        }
      }
      if (submissionAttempt !== undefined) {
        try {
          const scope = { formId: form.schema.id, formVersion: form.schema.version, ...(submissionScope ?? {}) };
          if (submissionIdentity !== undefined) await submissionIdentity.clear();
          else if (effectiveAttemptStore.clearForScope !== undefined) await effectiveAttemptStore.clearForScope(scope);
          else await effectiveAttemptStore.clear(form.schema.id, form.schema.version);
        } catch {
          // Attempt cleanup must not change a successful server submission result.
        }
      }
      if (attemptStore === undefined) fallbackAttemptId.current = null;
      if (autoSaveKey !== undefined && typeof globalThis.localStorage !== "undefined") {
        globalThis.localStorage.removeItem(autoSaveKey);
        draftClearedAfterSubmitRef.current = true;
        setDraftRestored(false);
      }
      setCurrentPageIndex(visiblePageIndexes[0] ?? 0);
      return result;
    } finally {
      rendererSubmissionInFlight.current = false;
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitState === "submitting" || submitState === "confirming" || submitState === "success") return;
    telemetryRuntime.submitAttempted();
    void submitValues();
  };

  const handleFieldFocus = (event: React.FocusEvent<HTMLFormElement>) => {
    if (!(event.target instanceof Element)) return;
    const fieldId = event.target.closest<HTMLElement>("[data-field-id]")?.dataset.fieldId;
    if (fieldId === undefined) return;
    const field = form.schema.fields.find((candidate) => candidate.id === fieldId);
    if (field === undefined || form.visibility[field.id] !== true) return;
    telemetryRuntime.fieldFocused(field, activePage?.id);
  };

  const confirmSubmission = () => {
    if (confirmation !== null) {
      confirmedSubmissionSignature.current = confirmationSignature(confirmation.findings);
      piiWarningAcknowledged.current = confirmation.findings.length > 0;
    }
    setConfirmation(null);
    void submitValues(true);
  };

  const cancelSubmission = () => {
    setConfirmation(null);
    globalThis.setTimeout(focusSubmitButton, 0);
  };

  const resetReceipt = async () => {
    if (receiptStore === undefined) return;
    await receiptStore.remove(form.schema.id, form.schema.version, submissionScope);
    setReceipt(null);
    form.reset();
  };

  const validationIssues = Object.values(form.errors).filter((issue): issue is ValidationIssue => issue !== undefined);
  const validationSummaryKey: "validationSummary" | "validationSummaryPlural" =
    validationIssues.length === 1 ? "validationSummary" : "validationSummaryPlural";
  const canPrev = pages !== undefined && activeVisibleIndex > 0;
  const canNext = pages !== undefined && activeVisibleIndex < visiblePageIndexes.length - 1;
  const renderSubmitButton = () => {
    const submitButtonProps: RenderSubmitButtonProps = {
      isSubmitting: submitState === "submitting",
      submitStatus: submitState,
      disabled: interactionLocked || submitState === "success",
      onSubmit: () => {
        telemetryRuntime.submitAttempted();
        void submitValues();
      }
    };
    return (
      slots.renderSubmitButton?.(submitButtonProps) ??
      (() => {
        const label =
          submitState === "submitting"
            ? resolveMessage("submittingButton")
            : resolveMessage("submitButton", form.translate(form.schema.submitLabelKey ?? "form.submit"));
        const children = (
          <>
            {submitState === "submitting" ? <span className="fe-spinner" aria-hidden="true" /> : null}
            {label}
          </>
        );
        return renderRespondentButton({
          className: joinClassNames("fe-submit", classNames?.submitButton),
          type: "submit",
          kind: "submit",
          disabled: submitButtonProps.disabled,
          children
        });
      })()
    );
  };

  const completionMessage =
    form.schema.completionMessage ??
    (successMessageKey === undefined ? "Submitted." : form.translate(successMessageKey));
  const activeCompletionData = completionData ?? {
    answers: { ...form.values },
    submittedItems: buildSubmittedItems(
      form.schema,
      form.values,
      form.visibility,
      (key) => form.translate(key),
      showHiddenFieldsInSummary
    )
  };
  const completionProps = {
    message: completionMessage,
    schema: form.schema,
    answers: activeCompletionData.answers,
    submittedItems: activeCompletionData.submittedItems,
    ...(activeCompletionData.response === undefined ? {} : { response: activeCompletionData.response }),
    onReset: form.reset
  };
  const completionRegion = (
    <div
      ref={completionRef}
      className={joinClassNames("fe-completion", classNames?.completion)}
      role="status"
      aria-live="polite"
      tabIndex={-1}
    >
      {slots.renderCompletion?.(completionProps) ?? <div>{completionMessage}</div>}
      {slots.renderSubmittedValues?.({ items: activeCompletionData.submittedItems, schema: form.schema })}
    </div>
  );
  const afterFormRegion = slots.renderAfterForm?.({
    ...(form.policy === undefined ? {} : { policy: form.policy }),
    schema: form.schema,
    answers: activeCompletionData.answers,
    submitStatus: form.submitStatus,
    acceptanceStatus,
    ...(activeCompletionData.response === undefined ? {} : { response: activeCompletionData.response })
  });

  const confirmationTitle =
    submissionConfirmation?.title ??
    (confirmation?.generic === true
      ? form.locale.toLowerCase().startsWith("ja")
        ? "回答内容の確認"
        : "Review your answers"
      : resolveMessage("confirmSensitiveDataTitle"));
  const confirmationMessage =
    confirmation?.message ??
    submissionConfirmation?.message ??
    (confirmation?.generic === true
      ? form.locale.toLowerCase().startsWith("ja")
        ? "回答内容をご確認のうえ、送信してください。"
        : "Please review your answers before submitting."
      : resolveMessage("confirmSensitiveDataMessage", form.translate("form.confirmSensitiveData")));
  const findingDisplay = submissionConfirmation?.findingDisplay ?? "masked";
  const showFindings = submissionConfirmation?.showFindings !== false && findingDisplay !== "hidden";

  const confirmationContent = (
    <div
      ref={confirmationRef}
      className="fe-submission-confirmation"
      role={confirmationRenderMode === "dialog" ? undefined : "dialog"}
    >
      {slots.renderSubmissionConfirmation?.({
        findings: confirmation?.findings ?? [],
        message: confirmationMessage,
        schema: form.schema,
        visibleValues,
        visibleItems,
        onConfirm: confirmSubmission,
        onCancel: cancelSubmission
      }) ?? (
        <>
          <h2>{confirmationTitle}</h2>
          <p>{confirmationMessage}</p>
          {!showFindings || (confirmation?.findings ?? []).length === 0 ? null : (
            <ul>
              {(confirmation?.findings ?? []).map((finding, index) => {
                const field = form.schema.fields.find((candidate) => candidate.id === finding.fieldId);
                const typeLabels: Readonly<Record<string, string>> = form.locale.toLowerCase().startsWith("ja")
                  ? { email: "メールアドレス", phone: "電話番号", url: "URL", postal_code: "郵便番号" }
                  : { email: "Email address", phone: "Phone number", url: "URL", postal_code: "Postal code" };
                const typeLabel = finding.typeLabel ?? typeLabels[finding.type] ?? finding.type;
                const value = sensitiveValueForDisplay(finding, findingDisplay);
                return (
                  <li key={`${finding.fieldId}-${finding.type}-${finding.start ?? index}`}>
                    <span>{finding.fieldTitle ?? field?.title ?? finding.fieldId}</span>{" "}
                    <span className="fe-sensitive-type">{typeLabel}</span>
                    {value === undefined ? null : <span className="fe-sensitive-value"> {value}</span>}
                  </li>
                );
              })}
            </ul>
          )}
          {confirmation?.generic === true ? (
            <ul className="fe-submission-summary">
              {visibleItems.map((item) => (
                <li key={item.fieldId}>
                  <span>{item.title}</span>: <span>{item.displayValue}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {renderRespondentButton({
            type: "button",
            kind: "confirm",
            onClick: confirmSubmission,
            dataConfirm: true,
            children:
              submissionConfirmation?.confirmLabel ??
              resolveMessage("confirmButton", form.translate("form.confirmSubmission"))
          })}
          {renderRespondentButton({
            type: "button",
            kind: "cancel",
            onClick: cancelSubmission,
            children:
              submissionConfirmation?.cancelLabel ??
              resolveMessage("cancelButton", form.translate("form.cancelSubmission"))
          })}
        </>
      )}
    </div>
  );

  if (!receiptLoaded) return null;
  if (draftResumeEnabled && draftResumeState === "checking") return null;
  if (draftResumeEnabled && draftResumeState === "choice") {
    return (
      <div
        className={`fe-form ${className}`.trim()}
        data-form-id={form.schema.id}
        data-form-version={form.schema.version}
        data-content-mode={getFormContentMode(form.schema.metadata)}
        data-mode={getFormContentMode(form.schema.metadata)}
      >
        {draftResumeContent}
      </div>
    );
  }
  if (receipt !== null) {
    return (
      <div
        className={`fe-form fe-already-submitted ${className}`.trim()}
        data-form-id={form.schema.id}
        data-form-version={form.schema.version}
        data-content-mode={getFormContentMode(form.schema.metadata)}
        data-mode={getFormContentMode(form.schema.metadata)}
        data-submit-status={submitState}
      >
        {slots.renderAlreadySubmitted?.({
          receipt,
          ...(receiptStore === undefined ? {} : { onReset: () => void resetReceipt() })
        }) ?? (
          <div role="status">
            <h2>{resolveMessage("alreadySubmittedTitle")}</h2>
            <p>{resolveMessage("alreadySubmittedMessage", form.translate("form.alreadySubmitted"))}</p>
            {receiptStore === undefined
              ? null
              : renderRespondentButton({
                  type: "button",
                  kind: "reset",
                  onClick: () => void resetReceipt(),
                  children: resolveMessage("submitButton", form.translate("form.submitAnother"))
                })}
          </div>
        )}
      </div>
    );
  }

  if (form.submitStatus === "success" && isReplaceMode) {
    return (
      <div
        className={`fe-form ${className}`.trim()}
        data-form-id={form.schema.id}
        data-form-version={form.schema.version}
        data-content-mode={getFormContentMode(form.schema.metadata)}
        data-mode={getFormContentMode(form.schema.metadata)}
        data-submit-status={submitState}
      >
        {completionRegion}
        {afterFormRegion}
      </div>
    );
  }

  if (!acceptanceStatus.accepted) {
    const titleKey =
      acceptanceStatus.status === "not_yet_open"
        ? "formNotYetOpenTitle"
        : acceptanceStatus.status === "limit_reached"
          ? "responseLimitReachedTitle"
          : "formClosedTitle";
    const messageKey =
      acceptanceStatus.status === "not_yet_open"
        ? "formNotYetOpenMessage"
        : acceptanceStatus.status === "limit_reached"
          ? "responseLimitReachedMessage"
          : "formClosedMessage";
    const configuredMessage =
      acceptanceStatus.status === "not_yet_open"
        ? form.schema.submissionSettings?.notYetOpenMessage
        : form.schema.submissionSettings?.closedMessage;
    const message = configuredMessage ?? resolveMessage(messageKey);
    return (
      <div
        className={`fe-form fe-form-closed ${className}`.trim()}
        data-form-id={form.schema.id}
        data-form-version={form.schema.version}
        data-content-mode={getFormContentMode(form.schema.metadata)}
        data-mode={getFormContentMode(form.schema.metadata)}
        data-acceptance-status={acceptanceStatus.status}
      >
        {slots.renderClosed?.({ status: acceptanceStatus.status, message }) ?? (
          <div role="status">
            <h2>{resolveMessage(titleKey)}</h2>
            <p>{message}</p>
          </div>
        )}
        {afterFormRegion}
      </div>
    );
  }

  if (confirmation !== null && confirmationRenderMode === "replace") {
    return (
      <div
        className={`fe-form ${className}`.trim()}
        data-form-id={form.schema.id}
        data-form-version={form.schema.version}
        data-content-mode={getFormContentMode(form.schema.metadata)}
        data-mode={getFormContentMode(form.schema.metadata)}
        data-submit-status={submitState}
      >
        {confirmationContent}
      </div>
    );
  }

  return (
    <>
      <form
        ref={formRef}
        className={joinClassNames("fe-form", className, classNames?.form)}
        noValidate
        data-form-id={form.schema.id}
        data-form-version={form.schema.version}
        data-content-mode={getFormContentMode(form.schema.metadata)}
        data-mode={getFormContentMode(form.schema.metadata)}
        data-submit-status={submitState}
        onSubmit={handleSubmit}
        onFocusCapture={handleFieldFocus}
        aria-hidden={confirmation !== null && confirmationRenderMode === "dialog" ? true : undefined}
      >
        {honeypotFieldId === undefined ? null : (
          <input
            className="fe-honeypot"
            name={honeypotFieldId}
            type="text"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={honeypotValue}
            onChange={(event) => setHoneypotValue(event.currentTarget.value)}
          />
        )}
        {draftResumeEnabled ? draftResumeContent : null}
        {slots.renderHeader?.({
          title: form.schema.title,
          ...(form.schema.description === undefined ? {} : { description: form.schema.description })
        }) ?? (
          <header className={joinClassNames("fe-header", classNames?.header)}>
            <h1 className={classNames?.headerTitle}>{form.schema.title}</h1>
            {form.schema.description === undefined ? null : (
              <p className={classNames?.headerDescription}>{form.schema.description}</p>
            )}
            {pages === undefined
              ? null
              : (slots.renderProgress?.(progress) ?? (
                  <div className={joinClassNames("fe-progress", classNames?.progress)}>
                    <div
                      className="form-progress-bar"
                      role="progressbar"
                      aria-valuemin={1}
                      aria-valuemax={visiblePageIndexes.length}
                      aria-valuenow={activeVisibleIndex + 1}
                      aria-label={resolveMessage("progressLabel")}
                      aria-valuetext={`${form.translate("form.step", { current: activeVisibleIndex + 1, total: visiblePageIndexes.length })} (${resolveMessage("remainingQuestions", undefined, { count: progress.remainingQuestions })})`}
                    >
                      <div
                        className="form-progress-fill"
                        style={{ width: `${((activeVisibleIndex + 1) / visiblePageIndexes.length) * 100}%` }}
                      />
                    </div>
                    <span>
                      {form.translate("form.step", {
                        current: activeVisibleIndex + 1,
                        total: visiblePageIndexes.length
                      })}
                    </span>
                  </div>
                ))}
            {draftRestored ? <span className="form-draft-badge">{form.translate("form.draftRestored")}</span> : null}
          </header>
        )}
        {slots.renderHeader === undefined || pages === undefined ? null : slots.renderProgress?.(progress)}
        {activePage === undefined ? null : (
          <section
            ref={pageHeaderRef}
            className={joinClassNames("fe-page-header", classNames?.pageHeader)}
            data-page-id={activePage.id}
            data-page-index={activeVisibleIndex}
            data-active="true"
            tabIndex={-1}
            aria-label={
              activePage.title ??
              form.translate("form.step", { current: activeVisibleIndex + 1, total: visiblePageIndexes.length })
            }
          >
            {slots.renderPageHeader?.({
              page: activePage,
              pageIndex: activeVisibleIndex,
              totalPages: visiblePageIndexes.length,
              progress
            }) ?? (
              <>
                {activePage.title === undefined ? null : <h2 className={classNames?.pageTitle}>{activePage.title}</h2>}
                {activePage.description === undefined ? null : (
                  <p className={classNames?.pageDescription}>{activePage.description}</p>
                )}
              </>
            )}
          </section>
        )}
        {(() => {
          const fieldChildren = form.schema.fields
            .filter((field) => form.visibility[field.id] === true && (fieldIds === undefined || fieldIds.has(field.id)))
            .map((field) => {
              const error = form.errors[field.id];
              const props: FieldComponentProps = {
                field,
                value: form.values[field.id],
                error,
                setValue: (value) => {
                  telemetryRuntime.fieldValueChanged(field, value, activePage?.id);
                  form.setValue(field.id, value);
                },
                translate: fieldTranslate,
                inputId: `${prefix}-${field.id}`,
                errorId: `${prefix}-${field.id}-error`,
                helpId: `${prefix}-${field.id}-help`,
                ...(slots.renderCharacterCount === undefined
                  ? {}
                  : { renderCharacterCount: slots.renderCharacterCount }),
                ...(fieldConfig?.[field.id]?.a11y === undefined ? {} : { a11y: fieldConfig[field.id]?.a11y }),
                ...(classNames === undefined ? {} : { classNames }),
                ...(optionOrderSeed === undefined ? {} : { optionOrderSeed }),
                ratingDisplay,
                ...(ratingStarSize === undefined ? {} : { ratingStarSize })
              };
              if (slots.renderField !== undefined) {
                return (
                  <Fragment key={field.id}>
                    {slots.renderField({
                      question: field,
                      value: form.values[field.id],
                      onChange: (value) => {
                        if (isFormValue(value)) {
                          telemetryRuntime.fieldValueChanged(field, value, activePage?.id);
                          form.setValue(field.id, value);
                        }
                      },
                      ...(error === undefined ? {} : { error })
                    })}
                  </Fragment>
                );
              }
              const Component = components[field.type];
              return Component === undefined ? (
                <DefaultField
                  key={field.id}
                  {...props}
                  groupedChoiceFields={groupedChoiceFields}
                  appearance={appearance}
                  choiceGroupSlotProps={slotProps?.choiceGroup}
                  renderChoiceGroup={slots.renderChoiceGroup}
                  renderChoiceOptionAfter={slots.renderChoiceOptionAfter}
                  renderChoiceOption={slots.renderChoiceOption}
                  renderRadioTextInput={slots.renderRadioTextInput}
                  primitiveComponents={primitiveComponents}
                  radioTextInputEnabled={getFormContentMode(form.schema.metadata) === "survey"}
                  disabled={interactionLocked}
                  submitStatus={submitState}
                  {...(submitState === "success" && activeCompletionData.answers[field.id] !== undefined
                    ? { submittedValue: activeCompletionData.answers[field.id] }
                    : {})}
                />
              ) : (
                <Component key={field.id} {...props} />
              );
            });
          const fieldClassName = joinClassNames("fe-fields", fieldsClassName, classNames?.fields) ?? "fe-fields";
          return (
            slots.renderFields?.({ children: fieldChildren, className: fieldClassName }) ?? (
              <div className={fieldClassName}>{fieldChildren}</div>
            )
          );
        })()}
        {guardMessage === null ? null : <div role="alert">{guardMessage}</div>}
        {confirmation !== null && confirmationRenderMode === "inline" ? confirmationContent : null}
        {validationIssues.length === 0
          ? null
          : (slots.renderValidationSummary?.({ issues: validationIssues, onIssueSelect: handleIssueSelect }) ?? (
              <div className="fe-validation-summary" role="alert">
                {resolveMessage(validationSummaryKey, undefined, { count: validationIssues.length })}
              </div>
            ))}
        {pages === undefined ? (
          <>
            {slots.renderNavigation?.({
              currentPage: 0,
              totalPages: 1,
              canPrev: false,
              canNext: false,
              disabled: interactionLocked,
              progress,
              onPrev: () => undefined,
              onNext: () => undefined
            })}
            {renderSubmitButton()}
          </>
        ) : (
          <div className={joinClassNames("form-step-navigation", classNames?.navigation)}>
            {slots.renderNavigation?.({
              currentPage: activeVisibleIndex,
              totalPages: visiblePageIndexes.length,
              canPrev,
              canNext,
              disabled: interactionLocked,
              progress,
              onPrev: handlePrevious,
              onNext: handleNext
            }) ?? (
              <>
                {canPrev
                  ? renderRespondentButton({
                      className: joinClassNames("btn-prev", classNames?.previousButton),
                      type: "button",
                      kind: "previous",
                      disabled: interactionLocked,
                      onClick: handlePrevious,
                      children: form.translate("form.back")
                    })
                  : null}
                {canNext
                  ? renderRespondentButton({
                      className: joinClassNames("btn-next", classNames?.nextButton),
                      type: "button",
                      kind: "next",
                      disabled: interactionLocked,
                      onClick: handleNext,
                      children: form.translate("form.next")
                    })
                  : null}
              </>
            )}
            {canNext ? null : renderSubmitButton()}
          </div>
        )}
        <div className={joinClassNames("fe-status", classNames?.status)} aria-live="polite">
          {acceptanceLoadError === null
            ? null
            : (slots.renderSubmitError?.({ error: acceptanceLoadError, onRetry: reloadAcceptanceCount }) ?? (
                <div role="alert">
                  {resolveMessage("serverErrorSummary")}
                  {renderRespondentButton({
                    type: "button",
                    kind: "retry",
                    onClick: reloadAcceptanceCount,
                    children: resolveMessage("retryButton")
                  })}
                </div>
              ))}
          {form.submitStatus === "success" ? completionRegion : null}
          {form.submitStatus === "error" && form.submitError !== null
            ? (slots.renderSubmitError?.({ error: form.submitError, onRetry: () => void submitValues() }) ??
              (form.submitError instanceof FormSubmissionError &&
              (form.submitError.payload.formErrors?.length ?? 0) > 0 ? (
                <div role="alert">
                  {form.submitError.payload.formErrors?.map((message) => (
                    <div key={message}>{message}</div>
                  ))}
                  {renderRespondentButton({
                    type: "button",
                    kind: "retry",
                    onClick: () => void submitValues(),
                    children: resolveMessage("retryButton")
                  })}
                </div>
              ) : (
                <div role="alert">
                  {errorMessageKey === undefined
                    ? resolveMessage("serverErrorSummary")
                    : form.translate(errorMessageKey)}
                  {renderRespondentButton({
                    type: "button",
                    kind: "retry",
                    onClick: () => void submitValues(),
                    children: resolveMessage("retryButton")
                  })}
                </div>
              )))
            : null}
        </div>
      </form>
      {afterFormRegion}
      {confirmation !== null && confirmationRenderMode === "dialog" ? (
        <div className="fe-confirmation-dialog-backdrop" role="dialog" aria-modal="true">
          {confirmationContent}
        </div>
      ) : null}
    </>
  );
}

const RENDERER_MESSAGES: Readonly<Record<string, string>> = {
  "form.submit": "Submit",
  "form.back": "Back",
  "form.next": "Next",
  "form.step": "Step {{current}} / {{total}}",
  "form.draftRestored": "Draft restored",
  "form.submissionBlocked": "Submission blocked because sensitive data was detected.",
  "form.confirmSensitiveData": "Sensitive data may be included. Confirm before submitting.",
  "form.confirmSubmission": "Proceed",
  "form.cancelSubmission": "Cancel",
  "form.yes": "Yes",
  "form.no": "No",
  "form.alreadySubmitted": "Already submitted.",
  "form.submitAnother": "Submit another response",
  "form.optionText": "Additional text for {{option}} (optional)",
  "validation.required": "This field is required."
};

const RENDERER_MESSAGES_JA: Readonly<Record<string, string>> = {
  "form.submit": "送信する",
  "form.back": "戻る",
  "form.next": "次へ",
  "form.step": "{{current}} / {{total}}",
  "form.draftRestored": "下書きを復元しました",
  "form.submissionBlocked": "個人情報が検出されたため送信できません。",
  "form.confirmSensitiveData": "個人情報が含まれている可能性があります。送信前に確認してください。",
  "form.confirmSubmission": "このまま送信",
  "form.cancelSubmission": "修正する",
  "form.yes": "はい",
  "form.no": "いいえ",
  "form.alreadySubmitted": "回答済みです",
  "form.submitAnother": "別の回答を送信",
  "form.optionText": "{{option}}の補足（任意）",
  "validation.required": "この項目は必須です"
};

const defaultRendererTranslator: TranslationAdapter = {
  translate(key, locale, params = {}) {
    const localizedMessages = locale.toLowerCase().startsWith("ja") ? RENDERER_MESSAGES_JA : RENDERER_MESSAGES;
    return (localizedMessages[key] ?? key).replace(/\{\{(\w+)\}\}/g, (token, name: string) =>
      Object.hasOwn(params, name) ? String(params[name]) : token
    );
  }
};

export function FormRenderer(props: FormRendererProps): React.JSX.Element;
export function FormRenderer<TMeta extends BaseSubmissionMetadata = FormSubmissionMetadata>(
  props: TypedFormRendererProps<TMeta>
): React.JSX.Element;
export function FormRenderer<TMeta extends BaseSubmissionMetadata = FormSubmissionMetadata>(
  props: FormRendererProps | TypedFormRendererProps<TMeta>
) {
  const i18n = useFormEngineI18n();
  const isProviderValue = useContext(FormEngineI18nProviderScopeContext);
  if (!("schema" in props)) {
    return <ContextFormRenderer<TMeta> {...(props as TypedFormRendererPresentationProps<TMeta>)} />;
  }
  const {
    schema,
    policy,
    locale = schema.defaultLocale ?? "en",
    translator: explicitTranslator,
    initialValues,
    resetOnSuccess,
    onSubmit,
    controller,
    submissionController,
    ...rendererProps
  } = props;
  const effectiveController = controller ?? submissionController;
  const translator =
    explicitTranslator ??
    (isProviderValue
      ? {
          translate: (key: string, _locale: string, params?: Readonly<Record<string, string | number>>) =>
            params === undefined ? i18n.translator(key) : i18n.translator(key, { ...params })
        }
      : defaultRendererTranslator);
  return (
    <FormProvider<TMeta>
      schema={schema}
      {...(policy === undefined ? {} : { policy })}
      locale={locale}
      translator={translator}
      onSubmit={
        (onSubmit as TypedFormSubmitHandler<TMeta> | undefined) ??
        (effectiveController === undefined
          ? async () => {
              throw new Error("FormRenderer requires onSubmit or controller.");
            }
          : createControllerSubmitHandler(
              effectiveController as SubmissionController<SubmitResponse, TMeta> | ScopedSubmissionController<TMeta>
            ))
      }
      {...(initialValues === undefined ? {} : { initialValues })}
      {...(resetOnSuccess === undefined ? {} : { resetOnSuccess })}
    >
      <ContextFormRenderer<TMeta> {...(rendererProps as TypedFormRendererPresentationProps<TMeta>)} />
    </FormProvider>
  );
}
