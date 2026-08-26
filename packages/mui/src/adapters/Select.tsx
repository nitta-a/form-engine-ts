import type { BuilderSelectOption, BuilderSelectProps } from "@form-engine-ts/react";
import {
  Box,
  FormControl,
  FormHelperText,
  InputLabel,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material/Select";
import type { ComponentType } from "react";
import { useResolvedMuiAdapterOptions } from "../context";
import type { MuiAdapterOptions } from "../types";

function normalizeOptions(options: readonly (string | BuilderSelectOption)[]): readonly BuilderSelectOption[] {
  return options.map((option) => (typeof option === "string" ? { value: option, label: option } : option));
}

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
    options: selectOptions,
    renderOption,
    renderValue
  }: BuilderSelectProps) {
    const resolved = useResolvedMuiAdapterOptions(options);
    const normalizedOptions = normalizeOptions(selectOptions);
    const selectSlotProps = resolved.muiSlotProps?.select;
    const menuProps = { ...selectSlotProps?.MenuProps, ...resolved.muiSlotProps?.selectMenu };
    const labelId = id === undefined || label === undefined ? undefined : `${id}-label`;
    const helperId = id === undefined ? undefined : (ariaDescribedBy?.split(/\s+/u)[0] ?? `${id}-helper-text`);
    const describedBy = ariaDescribedBy ?? (helperText === undefined || helperText.length === 0 ? undefined : helperId);
    const handleChange = (event: SelectChangeEvent<unknown>) => onChange(String(event.target.value));
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
        <Select<unknown>
          {...selectSlotProps}
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
          variant={selectSlotProps?.variant ?? resolved.variant}
          {...(Object.keys(menuProps).length === 0 ? {} : { MenuProps: menuProps })}
          renderValue={(selected) => {
            const selectedValue = typeof selected === "string" ? selected : String(selected ?? "");
            const option = normalizedOptions.find((candidate) => candidate.value === selectedValue);
            if (renderValue !== undefined) return renderValue(option);
            if (option === undefined) return selectedValue;
            return (
              <Box display="flex" alignItems="center" gap={0.75}>
                {option.icon}
                <span>{option.label}</span>
              </Box>
            );
          }}
          inputProps={{
            ...selectSlotProps?.inputProps,
            "aria-label": ariaLabel,
            "aria-describedby": describedBy,
            "aria-labelledby": ariaLabelledBy
          }}
        >
          {normalizedOptions.map((option) => (
            <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
              {renderOption === undefined ? (
                <>
                  {option.icon === undefined ? null : <ListItemIcon sx={{ minWidth: 32 }}>{option.icon}</ListItemIcon>}
                  <ListItemText primary={option.label} secondary={option.description} />
                </>
              ) : (
                renderOption(option)
              )}
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
