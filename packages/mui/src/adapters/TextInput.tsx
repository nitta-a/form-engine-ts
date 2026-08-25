import type { BuilderTextInputProps } from "@form-engine-ts/react";
import { TextField } from "@mui/material";
import type { ComponentType } from "react";
import { useResolvedMuiAdapterOptions } from "../context";
import type { MuiAdapterOptions } from "../types";

export function createMuiTextInputAdapter(options?: MuiAdapterOptions): ComponentType<BuilderTextInputProps> {
  return function MuiTextInput({
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
    const resolved = useResolvedMuiAdapterOptions(options);
    return (
      <TextField
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
            min,
            max,
            step,
            inputMode,
            readOnly,
            "aria-label": ariaLabel,
            "aria-describedby": ariaDescribedBy,
            "aria-labelledby": ariaLabelledBy
          },
          input: { readOnly },
          formHelperText: { id: ariaDescribedBy }
        }}
        type={type}
        placeholder={placeholder}
        fullWidth={resolved.inputFullWidth ?? resolved.fullWidth}
        size={resolved.size}
        variant={resolved.variant}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    );
  };
}

export const MuiTextInputAdapter = createMuiTextInputAdapter();
