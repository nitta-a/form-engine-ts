import type { BuilderSelectOption, BuilderSelectProps } from "@form-engine-ts/react";
import {
  Box,
  FormControl,
  FormHelperText,
  InputLabel,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  MenuItem,
  Select
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material/Select";
import type { ComponentType, ReactElement, ReactNode } from "react";
import { useResolvedMuiAdapterOptions } from "../context";
import type { MuiAdapterOptions } from "../types";

function normalizeOptions<T extends string>(
  options: readonly (T | BuilderSelectOption<T>)[]
): readonly BuilderSelectOption<T>[] {
  return options.map((option) => (typeof option === "string" ? { value: option, label: option } : option));
}

interface SelectOptionGroup<T extends string> {
  readonly groupKey?: string;
  readonly groupLabel?: string;
  readonly items: readonly BuilderSelectOption<T>[];
}

function SelectGroupHeader({ children }: { readonly children: ReactNode }): ReactElement {
  return <ListSubheader role="presentation">{children}</ListSubheader>;
}

function groupSelectOptions<T extends string>(
  options: readonly BuilderSelectOption<T>[]
): readonly SelectOptionGroup<T>[] {
  const groups: SelectOptionGroup<T>[] = [];
  const groupIndexes = new Map<string, number>();
  for (const option of options) {
    const groupKey = option.group ?? option.kind;
    const groupLabel = option.groupLabel ?? groupKey;
    if (groupKey === undefined && groupLabel === undefined) {
      groups.push({ items: [option] });
      continue;
    }
    const key = groupKey ?? groupLabel;
    if (key === undefined) {
      groups.push({ items: [option] });
      continue;
    }
    const existingIndex = groupIndexes.get(key);
    if (existingIndex === undefined) {
      groupIndexes.set(key, groups.length);
      groups.push({
        groupKey: key,
        ...(groupLabel === undefined ? {} : { groupLabel }),
        items: [option]
      });
      continue;
    }
    const existing = groups[existingIndex];
    if (existing === undefined) continue;
    groups[existingIndex] = { ...existing, items: [...existing.items, option] };
  }
  return groups;
}

export function createMuiSelectAdapter<T extends string = string>(
  options?: MuiAdapterOptions
): ComponentType<BuilderSelectProps<T>> {
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
    description,
    optionDisplay = "rich",
    appearance,
    value,
    onChange,
    onKeyDown,
    options: selectOptions,
    renderOption,
    renderValue
  }: BuilderSelectProps<T>) {
    const resolved = useResolvedMuiAdapterOptions(options);
    const normalizedOptions = normalizeOptions(selectOptions);
    const groupedOptions = groupSelectOptions(normalizedOptions);
    const selectSlotProps = resolved.muiSlotProps?.select;
    const baseMenuProps = { ...selectSlotProps?.MenuProps, ...resolved.muiSlotProps?.selectMenu };
    const menuProps = {
      ...baseMenuProps,
      ...(appearance?.menuMaxHeight === undefined
        ? {}
        : {
            PaperProps: {
              ...baseMenuProps.PaperProps,
              style: { ...baseMenuProps.PaperProps?.style, maxHeight: appearance.menuMaxHeight }
            }
          })
    };
    const slotInputProps = selectSlotProps?.inputProps;
    const labelId = id === undefined || label === undefined ? undefined : `${id}-label`;
    const helperId = id === undefined ? undefined : (ariaDescribedBy?.split(/\s+/u)[0] ?? `${id}-helper-text`);
    const describedBy = ariaDescribedBy ?? (helperText === undefined || helperText.length === 0 ? undefined : helperId);
    const handleChange = (event: SelectChangeEvent<unknown>) => onChange(event.target.value as T);
    return (
      <FormControl
        className={className}
        fullWidth={appearance?.fullWidth ?? resolved.inputFullWidth ?? resolved.fullWidth}
        size={appearance?.size ?? resolved.size}
        variant={appearance?.variant ?? resolved.variant}
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
          variant={selectSlotProps?.variant ?? appearance?.variant ?? resolved.variant}
          {...(Object.keys(menuProps).length === 0 ? {} : { MenuProps: menuProps })}
          renderValue={(selected) => {
            const selectedValue = typeof selected === "string" ? selected : String(selected ?? "");
            const option = normalizedOptions.find((candidate) => candidate.value === selectedValue);
            if (renderValue !== undefined) return renderValue(option);
            if (option === undefined) return selectedValue;
            return optionDisplay === "label" ? (
              <span>{option.label}</span>
            ) : (
              <Box display="flex" alignItems="center" gap={0.75}>
                {option.icon}
                <span>{option.label}</span>
              </Box>
            );
          }}
          inputProps={{
            ...slotInputProps,
            ...(ariaLabel === undefined ? {} : { "aria-label": ariaLabel }),
            ...(describedBy === undefined ? {} : { "aria-describedby": describedBy }),
            ...(ariaLabelledBy === undefined ? {} : { "aria-labelledby": ariaLabelledBy })
          }}
        >
          {groupedOptions.flatMap((group) => [
            group.groupLabel === undefined ? null : (
              <SelectGroupHeader key={`header-${group.groupKey ?? group.groupLabel}`}>
                {group.groupLabel}
              </SelectGroupHeader>
            ),
            ...group.items.map((option) => (
              <MenuItem
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                {...(option.group === undefined && option.groupLabel === undefined && option.kind === undefined
                  ? {}
                  : { "aria-label": option.label })}
              >
                {renderOption === undefined ? (
                  <>
                    {optionDisplay === "label" || option.icon === undefined ? null : (
                      <ListItemIcon sx={{ minWidth: 32 }}>{option.icon}</ListItemIcon>
                    )}
                    <ListItemText
                      primary={option.label}
                      secondary={optionDisplay === "label" ? undefined : option.description}
                    />
                  </>
                ) : (
                  renderOption(option)
                )}
              </MenuItem>
            ))
          ])}
        </Select>
        {helperText === undefined && description === undefined ? null : (
          <FormHelperText id={helperId}>{helperText ?? description}</FormHelperText>
        )}
      </FormControl>
    );
  };
}

export function MuiSelectAdapter<T extends string = string>(props: BuilderSelectProps<T>): ReactElement {
  const Adapter = createMuiSelectAdapter<T>();
  return <Adapter {...props} />;
}
