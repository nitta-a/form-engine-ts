import type { BuilderTextAreaProps } from "@form-engine-ts/react";
import { TextField } from "@mui/material";
import type { ComponentType } from "react";
import { useResolvedMuiAdapterOptions } from "../context";
import type { MuiAdapterOptions } from "../types";

export function createMuiTextAreaAdapter(options?: MuiAdapterOptions): ComponentType<BuilderTextAreaProps> {
  return function MuiTextArea({
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
    const resolved = useResolvedMuiAdapterOptions(options);
    const textFieldSlotProps = resolved.muiSlotProps?.textField;
    return (
      <TextField
        {...textFieldSlotProps}
        id={id}
        className={className}
        name={name}
        label={label}
        required={required}
        error={Boolean(error)}
        helperText={helperText}
        value={value}
        disabled={disabled}
        slotProps={{
          htmlInput: {
            maxLength,
            readOnly,
            "aria-label": ariaLabel,
            "aria-describedby": ariaDescribedBy,
            "aria-labelledby": ariaLabelledBy
          },
          input: { readOnly },
          formHelperText: { id: ariaDescribedBy }
        }}
        multiline
        rows={rows}
        placeholder={placeholder}
        fullWidth={resolved.inputFullWidth ?? resolved.fullWidth}
        size={resolved.size}
        variant={textFieldSlotProps?.variant ?? resolved.variant}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    );
  };
}

export const MuiTextAreaAdapter = createMuiTextAreaAdapter();
