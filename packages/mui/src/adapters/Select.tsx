import type { BuilderSelectProps } from "@form-engine-ts/react";
import { FormControl, FormHelperText, InputLabel, MenuItem, Select } from "@mui/material";
import type { SelectChangeEvent } from "@mui/material/Select";
import type { ComponentType } from "react";
import { useResolvedMuiAdapterOptions } from "../context";
import type { MuiAdapterOptions } from "../types";

export function createMuiSelectAdapter(options?: MuiAdapterOptions): ComponentType<BuilderSelectProps> {
  return function MuiSelect({
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
    onKeyDown,
    options: selectOptions
  }: BuilderSelectProps) {
    const resolved = useResolvedMuiAdapterOptions(options);
    const labelId = id === undefined || label === undefined ? undefined : `${id}-label`;
    const helperId = id === undefined ? undefined : (ariaDescribedBy?.split(/\s+/u)[0] ?? `${id}-helper-text`);
    const describedBy = ariaDescribedBy ?? (helperText === undefined || helperText.length === 0 ? undefined : helperId);
    const handleChange = (event: SelectChangeEvent<string>) => onChange(event.target.value);
    return (
      <FormControl
        className={className}
        fullWidth={resolved.inputFullWidth ?? resolved.fullWidth}
        size={resolved.size}
        variant={resolved.variant}
        error={Boolean(error)}
        required={required}
        disabled={disabled}
      >
        {label === undefined ? null : <InputLabel id={labelId}>{label}</InputLabel>}
        <Select
          id={id}
          labelId={labelId}
          name={name}
          label={label}
          value={value}
          disabled={disabled}
          onChange={handleChange}
          onKeyDown={onKeyDown}
          required={required}
          readOnly={readOnly}
          inputProps={{
            "aria-label": ariaLabel,
            "aria-describedby": describedBy,
            "aria-labelledby": ariaLabelledBy
          }}
        >
          {selectOptions.map((option) => (
            <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
        {helperText === undefined || helperText.length === 0 ? null : (
          <FormHelperText id={helperId}>{helperText}</FormHelperText>
        )}
      </FormControl>
    );
  };
}

export const MuiSelectAdapter = createMuiSelectAdapter();
