import type { LocaleOption } from "@form-engine-ts/core";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { Box, Chip, FormControl, IconButton, InputLabel, MenuItem, Select, Typography } from "@mui/material";
import type { SelectChangeEvent } from "@mui/material/Select";
import type { ReactNode } from "react";

export type TargetLocaleOption = string | LocaleOption;

export interface AddLocaleDropdownProps {
  readonly availableLocales: readonly TargetLocaleOption[];
  readonly existingLocales?: readonly string[];
  readonly value?: string;
  readonly disabled?: boolean;
  readonly label?: string;
  readonly icon?: ReactNode;
  readonly getLocaleDisplayName?: (locale: string) => string;
  readonly onAdd: (locale: string) => void;
}

function optionLocale(option: TargetLocaleOption): string {
  return typeof option === "string" ? option : option.locale;
}

function optionLabel(option: TargetLocaleOption, getLocaleDisplayName?: (locale: string) => string): string {
  if (typeof option !== "string") return option.label;
  return getLocaleDisplayName?.(option) ?? option;
}

export function AddLocaleDropdown({
  availableLocales,
  existingLocales = [],
  value = "",
  disabled = false,
  label = "Add translation language",
  icon = <AddIcon fontSize="small" />,
  getLocaleDisplayName,
  onAdd
}: AddLocaleDropdownProps) {
  const existing = new Set(existingLocales);
  const candidates = availableLocales.filter((option) => !existing.has(optionLocale(option)));
  const handleChange = (event: SelectChangeEvent<string>) => {
    if (event.target.value.length > 0) onAdd(event.target.value);
  };
  return (
    <FormControl size="small" sx={{ minWidth: 180 }} disabled={disabled || candidates.length === 0}>
      <InputLabel>{label}</InputLabel>
      <Select
        value={value}
        label={label}
        onChange={handleChange}
        startAdornment={icon}
        data-testid="add-locale-dropdown"
      >
        {candidates.map((option) => {
          const locale = optionLocale(option);
          return (
            <MenuItem key={locale} value={locale}>
              {optionLabel(option, getLocaleDisplayName)}
            </MenuItem>
          );
        })}
      </Select>
    </FormControl>
  );
}

export interface TargetLocaleToolbarProps {
  readonly supportedLocales: readonly TargetLocaleOption[];
  readonly currentLocale: string;
  readonly availableLocales: readonly TargetLocaleOption[];
  readonly onSelectLocale: (locale: string) => void;
  readonly onAddLocale: (locale: string) => void;
  readonly onRemoveLocale: (locale: string) => void;
  readonly disabled?: boolean;
  readonly selectionLabel?: string;
  readonly addLabel?: string;
  readonly removeLabel?: string;
  readonly addIcon?: ReactNode;
  readonly removeIcon?: ReactNode;
  readonly getLocaleDisplayName?: (locale: string) => string;
}

export interface TranslationLocaleActionProps {
  readonly action: "add" | "remove";
  readonly label: string;
  readonly icon: ReactNode;
  readonly disabled: boolean;
  readonly onClick: () => void;
}

export interface TranslationLocaleActionsProps {
  readonly add: TranslationLocaleActionProps;
  readonly remove: TranslationLocaleActionProps;
}

export function TargetLocaleHeaderToolbar({
  supportedLocales,
  currentLocale,
  availableLocales,
  onSelectLocale,
  onAddLocale,
  onRemoveLocale,
  disabled = false,
  selectionLabel = "Translation language",
  addLabel = "Add translation language",
  removeLabel = "Remove translation language",
  addIcon = <AddIcon fontSize="small" />,
  removeIcon = <DeleteOutlineIcon fontSize="small" />,
  getLocaleDisplayName
}: TargetLocaleToolbarProps) {
  const currentOption = supportedLocales.find((option) => optionLocale(option) === currentLocale);
  const currentLabel =
    getLocaleDisplayName?.(currentLocale) ??
    (currentOption === undefined ? undefined : optionLabel(currentOption, getLocaleDisplayName)) ??
    currentLocale;
  const handleSelect = (event: SelectChangeEvent<string>) => onSelectLocale(event.target.value);
  return (
    <Box alignItems="center" display="flex" gap={2} justifyContent="space-between" width="100%">
      <Box alignItems="center" display="flex" gap={1}>
        <Typography color="text.secondary" variant="body2">
          {selectionLabel}:
        </Typography>
        {supportedLocales.length <= 1 ? (
          <Chip
            color="primary"
            label={currentLabel}
            size="small"
            variant="outlined"
            data-testid="current-locale-chip"
          />
        ) : (
          <FormControl size="small" disabled={disabled}>
            <InputLabel>{selectionLabel}</InputLabel>
            <Select value={currentLocale} label={selectionLabel} onChange={handleSelect}>
              {supportedLocales.map((option) => {
                const locale = optionLocale(option);
                return (
                  <MenuItem key={locale} value={locale}>
                    {optionLabel(option, getLocaleDisplayName)}
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
        )}
        {supportedLocales.length > 0 ? (
          <IconButton
            aria-label={removeLabel}
            color="error"
            disabled={disabled}
            onClick={() => onRemoveLocale(currentLocale)}
            size="small"
          >
            {removeIcon}
          </IconButton>
        ) : null}
      </Box>
      <AddLocaleDropdown
        availableLocales={availableLocales}
        disabled={disabled}
        existingLocales={supportedLocales.map(optionLocale)}
        {...(getLocaleDisplayName === undefined ? {} : { getLocaleDisplayName })}
        icon={addIcon}
        label={addLabel}
        onAdd={onAddLocale}
      />
    </Box>
  );
}

export const TargetLocaleSelector = TargetLocaleHeaderToolbar;
