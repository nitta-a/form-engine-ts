import type { FormBuilderSlots } from "@form-engine-ts/react";
import type { MuiAdapterOptions } from "../types";
import { createMuiFieldEditorSlot } from "./FieldEditor";
import { createMuiLocalizationSlot } from "./Localization";
import { createMuiOptionEditorSlot } from "./OptionEditor";
import { createMuiToolbarSlot } from "./Toolbar";

export * from "./FieldEditor";
export * from "./Localization";
export * from "./OptionEditor";
export * from "./Toolbar";

export const muiBuilderSlots: FormBuilderSlots = {
  toolbar: createMuiToolbarSlot(),
  fieldEditor: createMuiFieldEditorSlot(),
  optionEditor: createMuiOptionEditorSlot(),
  localization: createMuiLocalizationSlot()
};

export function createMuiBuilderSlots(
  options?: MuiAdapterOptions,
  customOverrides: Partial<FormBuilderSlots> = {}
): FormBuilderSlots {
  return {
    toolbar: createMuiToolbarSlot(options),
    fieldEditor: createMuiFieldEditorSlot(options),
    optionEditor: createMuiOptionEditorSlot(options),
    localization: createMuiLocalizationSlot(options),
    ...customOverrides
  };
}
