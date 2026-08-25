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
    return (
      <FormControl className={className} error={Boolean(error)} required={required} disabled={disabled || readOnly}>
        <FormControlLabel
          label={label}
          control={
            <Checkbox
              id={id}
              name={name}
              size={resolved.size}
              checked={checked}
              required={required}
              disabled={disabled || readOnly}
              inputProps={{
                "aria-label": ariaLabel,
                "aria-describedby": ariaDescribedBy,
                "aria-labelledby": ariaLabelledBy
              }}
              onChange={(event) => onChange(event.target.checked)}
            />
          }
        />
        {helperText === undefined || helperText.length === 0 ? null : (
          <FormHelperText id={ariaDescribedBy}>{helperText}</FormHelperText>
        )}
      </FormControl>
    );
  };
}

export const MuiCheckboxAdapter = createMuiCheckboxAdapter();
