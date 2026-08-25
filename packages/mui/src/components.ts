import type { FormBuilderComponents } from "@form-engine-ts/react";
import {
  createMuiButtonAdapter,
  createMuiCheckboxAdapter,
  createMuiErrorMessageAdapter,
  createMuiFieldsetAdapter,
  createMuiIconButtonAdapter,
  createMuiSectionAdapter,
  createMuiSelectAdapter,
  createMuiTextAreaAdapter,
  createMuiTextInputAdapter,
  MuiButtonAdapter,
  MuiCheckboxAdapter,
  MuiErrorMessageAdapter,
  MuiFieldsetAdapter,
  MuiIconButtonAdapter,
  MuiSectionAdapter,
  MuiSelectAdapter,
  MuiTextAreaAdapter,
  MuiTextInputAdapter
} from "./adapters";
import { muiDefaultIconResolver } from "./icons";
import type { MuiAdapterOptions } from "./types";

function isAdapterOptions(value: MuiAdapterOptions | Partial<FormBuilderComponents>): value is MuiAdapterOptions {
  return (
    "size" in value ||
    "variant" in value ||
    "buttonVariant" in value ||
    "buttonVariants" in value ||
    "fullWidth" in value ||
    "inputFullWidth" in value ||
    "buttonFullWidth" in value ||
    "dense" in value ||
    "fieldEditorOptions" in value ||
    "localizationOptions" in value ||
    "layoutOptions" in value ||
    "muiSlotProps" in value ||
    "getLocaleLabel" in value ||
    "getActionLabel" in value
  );
}

function buildMuiBuilderComponents(options?: MuiAdapterOptions): FormBuilderComponents {
  return {
    Button: createMuiButtonAdapter(options),
    IconButton: createMuiIconButtonAdapter(options),
    TextInput: createMuiTextInputAdapter(options),
    TextArea: createMuiTextAreaAdapter(options),
    Select: createMuiSelectAdapter(options),
    Checkbox: createMuiCheckboxAdapter(options),
    Section: createMuiSectionAdapter(options),
    Fieldset: createMuiFieldsetAdapter(options),
    ErrorMessage: createMuiErrorMessageAdapter(options),
    renderIcon: muiDefaultIconResolver
  };
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

export function createMuiBuilderComponents(customOverrides?: Partial<FormBuilderComponents>): FormBuilderComponents;
export function createMuiBuilderComponents(
  options?: MuiAdapterOptions,
  customOverrides?: Partial<FormBuilderComponents>
): FormBuilderComponents;
export function createMuiBuilderComponents(
  optionsOrOverrides: MuiAdapterOptions | Partial<FormBuilderComponents> = {},
  customOverrides?: Partial<FormBuilderComponents>
): FormBuilderComponents {
  const options = isAdapterOptions(optionsOrOverrides) ? optionsOrOverrides : undefined;
  const overrides = customOverrides ?? (options === undefined ? optionsOrOverrides : {});
  return { ...(options === undefined ? muiBuilderComponents : buildMuiBuilderComponents(options)), ...overrides };
}
