import type { FormBuilderSlots } from "@form-engine-ts/react";
import { DEFAULT_MUI_SECTION_ORDER, type MuiAdapterOptions } from "../types";
import { createMuiFieldEditorSlot, MuiFieldEditorSlot } from "./FieldEditor";
import { createMuiLocalizationSlot, MuiLocalizationSlot } from "./Localization";
import { createMuiOptionEditorSlot, MuiOptionEditorSlot } from "./OptionEditor";
import { createMuiToolbarSlot, MuiToolbarSlot } from "./Toolbar";

export * from "./ConditionEditor";
export * from "./FieldEditor";
export * from "./Localization";
export * from "./MuiChoiceGroupSlot";
export * from "./OptionEditor";
export * from "./Toolbar";

export const muiBuilderSlots: FormBuilderSlots = {
  sectionOrder: DEFAULT_MUI_SECTION_ORDER,
  toolbar: MuiToolbarSlot,
  fieldEditor: MuiFieldEditorSlot,
  optionEditor: MuiOptionEditorSlot,
  localization: MuiLocalizationSlot
};

export function createMuiBuilderSlots(
  options?: MuiAdapterOptions,
  customOverrides: Partial<FormBuilderSlots> = {}
): FormBuilderSlots {
  return {
    sectionOrder: options?.layoutOptions?.sectionOrder ?? DEFAULT_MUI_SECTION_ORDER,
    toolbar: createMuiToolbarSlot(options),
    fieldEditor: createMuiFieldEditorSlot(options),
    optionEditor: createMuiOptionEditorSlot(options),
    localization: createMuiLocalizationSlot(options),
    ...customOverrides
  };
}
