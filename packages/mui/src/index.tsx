import type {
  BuilderActionIconType,
  BuilderButtonProps,
  BuilderCheckboxProps,
  BuilderErrorMessageProps,
  BuilderFieldsetProps,
  BuilderIconButtonProps,
  BuilderSectionProps,
  BuilderSelectProps,
  BuilderTextAreaProps,
  BuilderTextInputProps,
  FormBuilderComponents
} from "@form-engine-ts/react";
import {
  Add,
  ArrowDownward,
  ArrowUpward,
  Close,
  Delete,
  DragHandle,
  Edit,
  Settings,
  Translate
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material/Select";
import type { ReactNode } from "react";

function MuiButtonAdapter({
  id,
  className,
  disabled,
  "aria-label": ariaLabel,
  onClick,
  children,
  title,
  variant = "secondary",
  action,
  targetId
}: BuilderButtonProps) {
  return (
    <Button
      id={id}
      className={className}
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      title={title}
      data-builder-action={action}
      data-target-id={targetId}
      onClick={onClick}
      color={variant === "danger" ? "error" : "primary"}
      variant={variant === "primary" ? "contained" : "outlined"}
    >
      {children}
    </Button>
  );
}

function MuiIconButtonAdapter({
  id,
  className,
  disabled,
  readOnly,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  "aria-labelledby": ariaLabelledBy,
  onClick,
  icon,
  title
}: BuilderIconButtonProps) {
  return (
    <IconButton
      id={id}
      className={className}
      component="button"
      type="button"
      disabled={disabled || readOnly}
      aria-label={ariaLabel ?? title}
      aria-describedby={ariaDescribedBy}
      aria-labelledby={ariaLabelledBy}
      title={title}
      onClick={onClick}
      sx={{ minWidth: 0, padding: 0.5 }}
    >
      {icon}
    </IconButton>
  );
}

function MuiTextInputAdapter({
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
  return (
    <TextField
      id={id}
      className={className}
      name={name}
      label={label}
      required={required}
      error={error}
      helperText={helperText}
      value={value}
      disabled={disabled}
      slotProps={{
        htmlInput: { maxLength, min, max, step, inputMode },
        input: { readOnly },
        formHelperText: { id: ariaDescribedBy }
      }}
      type={type}
      placeholder={placeholder}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-labelledby={ariaLabelledBy}
      fullWidth
      variant="outlined"
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  );
}

function MuiTextAreaAdapter({
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
  rows
}: BuilderTextAreaProps) {
  return (
    <TextField
      id={id}
      className={className}
      name={name}
      label={label}
      required={required}
      error={error}
      helperText={helperText}
      value={value}
      disabled={disabled}
      slotProps={{
        htmlInput: { maxLength },
        input: { readOnly },
        formHelperText: { id: ariaDescribedBy }
      }}
      multiline
      rows={rows}
      placeholder={placeholder}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-labelledby={ariaLabelledBy}
      fullWidth
      variant="outlined"
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  );
}

function MuiSelectAdapter({
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
  options
}: BuilderSelectProps) {
  const labelId = id === undefined ? undefined : `${id}-label`;
  const handleChange = (event: SelectChangeEvent<string>) => onChange(event.target.value);
  return (
    <FormControl className={className} fullWidth error={error} required={required} disabled={disabled}>
      {label === undefined ? null : <InputLabel id={labelId}>{label}</InputLabel>}
      <Select
        id={id}
        labelId={labelId}
        name={name}
        label={label}
        value={value}
        onChange={handleChange}
        readOnly={readOnly}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-labelledby={ariaLabelledBy}
        variant="outlined"
      >
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
      {helperText === undefined || helperText.length === 0 ? null : (
        <FormHelperText id={ariaDescribedBy}>{helperText}</FormHelperText>
      )}
    </FormControl>
  );
}

function MuiCheckboxAdapter({
  id,
  className,
  disabled,
  readOnly,
  "aria-label": ariaLabel,
  checked,
  onChange,
  label
}: BuilderCheckboxProps) {
  return (
    <FormControlLabel
      className={className}
      label={label}
      control={
        <Checkbox
          id={id}
          checked={checked}
          disabled={disabled || readOnly}
          inputProps={{ "aria-label": ariaLabel }}
          onChange={(event) => onChange(event.target.checked)}
        />
      }
    />
  );
}

function MuiSectionAdapter({
  id,
  className,
  title,
  description,
  headingId,
  "aria-label": ariaLabel,
  children
}: BuilderSectionProps) {
  return (
    <Paper
      id={id}
      className={className}
      aria-label={ariaLabel}
      aria-labelledby={title === undefined ? undefined : headingId}
      sx={{ p: 2, mb: 2 }}
    >
      {title === undefined ? null : (
        <Typography id={headingId} variant="h6">
          {title}
        </Typography>
      )}
      {description === undefined ? null : <Typography variant="body2">{description}</Typography>}
      {children}
    </Paper>
  );
}

function MuiFieldsetAdapter({ className, legend, disabled, children }: BuilderFieldsetProps) {
  return (
    <Box component="fieldset" className={className} disabled={disabled} sx={{ border: 0, m: 0, p: 0 }}>
      {legend === undefined ? null : (
        <Typography component="legend" variant="subtitle1">
          {legend}
        </Typography>
      )}
      {children}
    </Box>
  );
}

function MuiErrorMessageAdapter({ className, message }: BuilderErrorMessageProps) {
  return (
    <Alert className={className} severity="error">
      {message}
    </Alert>
  );
}

export function muiDefaultIconResolver(actionType: BuilderActionIconType): ReactNode {
  switch (actionType) {
    case "moveUp":
      return <ArrowUpward fontSize="small" />;
    case "moveDown":
      return <ArrowDownward fontSize="small" />;
    case "delete":
      return <Delete fontSize="small" />;
    case "add":
      return <Add fontSize="small" />;
    case "edit":
      return <Edit fontSize="small" />;
    case "settings":
      return <Settings fontSize="small" />;
    case "translate":
      return <Translate fontSize="small" />;
    case "close":
      return <Close fontSize="small" />;
    case "dragHandle":
      return <DragHandle fontSize="small" />;
  }
}

export const muiBuilderComponents: FormBuilderComponents = {
  Button: MuiButtonAdapter,
  IconButton: MuiIconButtonAdapter,
  TextInput: MuiTextInputAdapter,
  TextArea: MuiTextAreaAdapter,
  Select: MuiSelectAdapter,
  Checkbox: MuiCheckboxAdapter,
  Section: MuiSectionAdapter,
  Fieldset: MuiFieldsetAdapter,
  ErrorMessage: MuiErrorMessageAdapter,
  renderIcon: muiDefaultIconResolver
};

export function createMuiBuilderComponents(
  customOverrides: Partial<FormBuilderComponents> = {}
): FormBuilderComponents {
  return { ...muiBuilderComponents, ...customOverrides };
}
