import type { BuilderCheckboxProps } from "@form-engine-ts/react";
import { Checkbox, FormControl, FormControlLabel, FormHelperText } from "@mui/material";
import type { ComponentType } from "react";
import { useResolvedMuiAdapterOptions } from "../context";
import type { MuiAdapterOptions } from "../types";

export function createMuiCheckboxAdapter(options?: MuiAdapterOptions): ComponentType<BuilderCheckboxProps> {
  return function MuiCheckbox({
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
    const resolved = useResolvedMuiAdapterOptions(options);
    const checkboxSlotProps = resolved.muiSlotProps?.checkbox;
    const checkboxInputProps = checkboxSlotProps?.inputProps;
    const helperId = id === undefined ? undefined : (ariaDescribedBy?.split(/\s+/u)[0] ?? `${id}-helper-text`);
    const describedBy = ariaDescribedBy ?? (helperText === undefined || helperText.length === 0 ? undefined : helperId);
    return (
      <FormControl className={className} error={Boolean(error)} required={required} disabled={disabled || readOnly}>
        <FormControlLabel
          label={label}
          control={
            <Checkbox
              {...checkboxSlotProps}
              id={id}
              name={name}
              size={checkboxSlotProps?.size ?? resolved.size}
              checked={checked}
              required={required}
              disabled={disabled || readOnly}
              inputProps={{
                ...checkboxInputProps,
                ...(ariaLabel === undefined ? {} : { "aria-label": ariaLabel }),
                ...(describedBy === undefined ? {} : { "aria-describedby": describedBy }),
                ...(ariaLabelledBy === undefined ? {} : { "aria-labelledby": ariaLabelledBy })
              }}
              onChange={(event) => onChange(event.target.checked)}
            />
          }
        />
        {helperText === undefined || helperText.length === 0 ? null : (
          <FormHelperText id={helperId}>{helperText}</FormHelperText>
        )}
      </FormControl>
    );
  };
}

export const MuiCheckboxAdapter = createMuiCheckboxAdapter();
