import type { FormBuilderComponents, FormBuilderProps, FormBuilderSlots } from "@form-engine-ts/react";
import { createMuiBuilderComponents } from "./components";
import { createMuiBuilderSlots } from "./slots";
import type { MuiAdapterOptions } from "./types";

export type { MuiSlotProps } from "./types";

export interface MuiBuilderOverrides {
  readonly components?: Partial<FormBuilderComponents>;
  readonly slots?: Partial<FormBuilderSlots>;
}

export function createMuiBuilderProps(
  options?: MuiAdapterOptions,
  overrides: MuiBuilderOverrides = {}
): Pick<FormBuilderProps, "components" | "disableDefaultStyles" | "slots"> {
  return {
    disableDefaultStyles: true,
    components: createMuiBuilderComponents(options, overrides.components),
    slots: createMuiBuilderSlots(options, overrides.slots)
  };
}
