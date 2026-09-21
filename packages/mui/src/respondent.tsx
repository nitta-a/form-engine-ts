import type {
  FormRendererComponents,
  RespondentButtonProps,
  RespondentCheckboxProps,
  RespondentRadioProps,
  RespondentRatingProps,
  RespondentSelectProps,
  RespondentTextAreaProps,
  RespondentTextInputProps
} from "@form-engine-ts/react";
import { Button, Checkbox, MenuItem, Radio, TextField } from "@mui/material";
import { type ComponentType, createElement, type ReactNode } from "react";
import { MuiFormBuilderContext, useResolvedMuiAdapterOptions } from "./context";
import type { MuiAdapterOptions } from "./types";

function helperText(errorText: ReactNode, helper: ReactNode): ReactNode {
  return errorText ?? helper;
}

function MuiRespondentTextInput({
  field,
  id,
  name,
  label: _label,
  required,
  disabled,
  readOnly,
  error,
  helperText: help,
  errorText,
  value,
  type = "text",
  min,
  max,
  step,
  minLength,
  maxLength,
  pattern,
  placeholder,
  autoComplete,
  className,
  onChange,
  onBlur,
  onFocus,
  ...aria
}: RespondentTextInputProps) {
  const resolved = useResolvedMuiAdapterOptions();
  const slotProps = resolved.muiSlotProps?.textField;
  return (
    <TextField
      {...slotProps}
      className={className}
      id={id}
      name={name}
      required={required}
      disabled={disabled}
      error={error}
      helperText={helperText(errorText, help)}
      value={value ?? ""}
      type={type}
      placeholder={placeholder}
      autoComplete={autoComplete}
      fullWidth={resolved.inputFullWidth ?? resolved.fullWidth}
      size={slotProps?.size ?? resolved.size}
      variant={slotProps?.variant ?? resolved.variant}
      slotProps={{
        htmlInput: {
          ...slotProps?.slotProps?.htmlInput,
          min,
          max,
          step,
          minLength,
          maxLength,
          pattern,
          readOnly,
          ...aria
        },
        input: { ...slotProps?.slotProps?.input, readOnly }
      }}
      onChange={(event) => {
        const nextValue = event.currentTarget.value;
        onChange(
          type === "number"
            ? nextValue === ""
              ? undefined
              : Number.isFinite(Number(nextValue))
                ? Number(nextValue)
                : undefined
            : nextValue
        );
      }}
      onBlur={onBlur}
      onFocus={onFocus}
    />
  );
}

function MuiRespondentTextArea({
  field: _field,
  id,
  name,
  label: _label,
  required,
  disabled,
  readOnly,
  error,
  helperText: help,
  errorText,
  value,
  minLength,
  maxLength,
  placeholder,
  className,
  onChange,
  onBlur,
  onFocus,
  ...aria
}: RespondentTextAreaProps) {
  const resolved = useResolvedMuiAdapterOptions();
  const slotProps = resolved.muiSlotProps?.textField;
  return (
    <TextField
      {...slotProps}
      className={className}
      id={id}
      name={name}
      required={required}
      disabled={disabled}
      error={error}
      helperText={helperText(errorText, help)}
      value={value ?? ""}
      placeholder={placeholder}
      multiline
      minRows={slotProps?.minRows ?? 3}
      fullWidth={resolved.inputFullWidth ?? resolved.fullWidth}
      size={slotProps?.size ?? resolved.size}
      variant={slotProps?.variant ?? resolved.variant}
      slotProps={{
        htmlInput: { ...slotProps?.slotProps?.htmlInput, minLength, maxLength, readOnly, ...aria },
        input: { ...slotProps?.slotProps?.input, readOnly }
      }}
      onChange={(event) => onChange(event.currentTarget.value)}
      onBlur={onBlur}
      onFocus={onFocus}
    />
  );
}

function MuiRespondentSelect({
  field: _field,
  id,
  name,
  label,
  required,
  disabled,
  readOnly,
  error,
  helperText: help,
  errorText,
  value,
  options,
  className,
  onChange,
  ...aria
}: RespondentSelectProps) {
  const resolved = useResolvedMuiAdapterOptions();
  const slotProps = resolved.muiSlotProps?.textField;
  return (
    <TextField
      {...slotProps}
      className={className}
      id={id}
      name={name}
      label={label}
      required={required}
      disabled={disabled || readOnly}
      error={error}
      helperText={helperText(errorText, help)}
      value={value ?? ""}
      select
      fullWidth={resolved.inputFullWidth ?? resolved.fullWidth}
      size={slotProps?.size ?? resolved.size}
      variant={slotProps?.variant ?? resolved.variant}
      slotProps={{
        ...slotProps?.slotProps,
        select: { ...slotProps?.slotProps?.select, readOnly, ...aria }
      }}
      onChange={(event) => onChange(event.target.value || undefined)}
    >
      <MenuItem value="">—</MenuItem>
      {options.map((option) => (
        <MenuItem key={option.id} value={option.id}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
}

function MuiRespondentCheckbox({
  field: _field,
  id,
  name,
  label: _label,
  description: _description,
  checked,
  value,
  disabled,
  readOnly,
  required,
  error,
  helperText: _helperText,
  errorText: _errorText,
  className,
  onChange,
  ...aria
}: RespondentCheckboxProps) {
  const resolved = useResolvedMuiAdapterOptions();
  const slotProps = resolved.muiSlotProps?.checkbox;
  return (
    <Checkbox
      {...slotProps}
      id={id}
      name={name}
      value={value}
      checked={checked}
      required={required}
      disabled={disabled || readOnly}
      className={className}
      color={error ? "error" : slotProps?.color}
      inputProps={{ ...slotProps?.inputProps, ...aria, readOnly }}
      onChange={(event) => onChange(event.target.checked)}
    />
  );
}

function MuiRespondentRadio({
  field: _field,
  id,
  name,
  label: _label,
  description: _description,
  checked,
  value,
  disabled,
  readOnly,
  required,
  error,
  helperText: _helperText,
  errorText: _errorText,
  className,
  onChange,
  onKeyDown,
  ...aria
}: RespondentRadioProps) {
  const resolved = useResolvedMuiAdapterOptions();
  const slotProps = resolved.muiSlotProps?.radio;
  return (
    <Radio
      {...slotProps}
      id={id}
      name={name}
      value={value}
      checked={checked}
      required={required}
      disabled={disabled || readOnly}
      className={className}
      color={error ? "error" : slotProps?.color}
      inputProps={{ ...slotProps?.inputProps, ...aria, readOnly }}
      onKeyDown={onKeyDown}
      onChange={(event) => onChange(event.target.checked)}
    />
  );
}

function MuiRespondentRating({
  field: _field,
  id,
  name,
  label: _label,
  description: _description,
  checked,
  value,
  min,
  disabled,
  readOnly,
  required,
  error,
  helperText: _helperText,
  errorText: _errorText,
  className,
  onChange,
  ...aria
}: RespondentRatingProps) {
  const resolved = useResolvedMuiAdapterOptions();
  const slotProps = resolved.muiSlotProps?.radio;
  return (
    <Radio
      {...slotProps}
      id={id}
      name={name}
      value={value}
      checked={checked}
      required={required}
      disabled={disabled || readOnly}
      className={className}
      color={error ? "error" : slotProps?.color}
      inputProps={{ ...slotProps?.inputProps, min, ...aria, readOnly }}
      onChange={() => onChange(value ?? min)}
    />
  );
}

function MuiRespondentButton({ type, kind, disabled, className, children, onClick }: RespondentButtonProps) {
  const resolved = useResolvedMuiAdapterOptions();
  return (
    <Button
      {...resolved.muiSlotProps?.button}
      type={type}
      disabled={disabled}
      className={className}
      variant={
        resolved.muiSlotProps?.button?.variant ??
        (kind === "previous" || kind === "cancel" || kind === "retry" || kind === "draft-start-over"
          ? "outlined"
          : resolved.buttonVariant)
      }
      fullWidth={resolved.buttonFullWidth ?? false}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function withMuiOptions<P extends object>(Component: ComponentType<P>, options: MuiAdapterOptions): ComponentType<P> {
  return function MuiRespondentWithOptions(props: P) {
    return (
      <MuiFormBuilderContext.Provider value={{ options }}>
        {createElement(Component, props)}
      </MuiFormBuilderContext.Provider>
    );
  };
}

export function createMuiRespondentComponents(options?: MuiAdapterOptions): FormRendererComponents {
  const components = {
    TextInput: MuiRespondentTextInput,
    TextArea: MuiRespondentTextArea,
    Select: MuiRespondentSelect,
    Checkbox: MuiRespondentCheckbox,
    Radio: MuiRespondentRadio,
    Rating: MuiRespondentRating,
    Button: MuiRespondentButton
  };
  if (options === undefined) return components;
  return {
    TextInput: withMuiOptions(components.TextInput, options),
    TextArea: withMuiOptions(components.TextArea, options),
    Select: withMuiOptions(components.Select, options),
    Checkbox: withMuiOptions(components.Checkbox, options),
    Radio: withMuiOptions(components.Radio, options),
    Rating: withMuiOptions(components.Rating, options),
    Button: withMuiOptions(components.Button, options)
  };
}

export const muiRespondentComponents = createMuiRespondentComponents();
