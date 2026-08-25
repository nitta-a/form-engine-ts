import {
  FormBuilder,
  type FormBuilderComponents,
  type FormBuilderProps,
  type FormBuilderSlots
} from "@form-engine-ts/react";
import { useMemo } from "react";
import { createMuiBuilderComponents } from "./components";
import { createMuiBuilderSlots } from "./slots";
import type { MuiAdapterOptions, MuiBuilderSlotProps, MuiLayoutOptions, MuiLocalizationOptions } from "./types";

export interface MuiFormBuilderProps
  extends Omit<FormBuilderProps, "components" | "disableDefaultStyles" | "slots" | "unstyled"> {
  readonly muiOptions?: MuiAdapterOptions;
  readonly layoutOptions?: MuiLayoutOptions;
  readonly localizationOptions?: MuiLocalizationOptions;
  readonly muiSlotProps?: MuiBuilderSlotProps;
  readonly components?: Partial<FormBuilderComponents>;
  readonly slots?: Partial<FormBuilderSlots>;
}

export function MuiFormBuilder({
  muiOptions,
  layoutOptions,
  localizationOptions,
  muiSlotProps,
  components: customComponents,
  slots: customSlots,
  ...props
}: MuiFormBuilderProps) {
  const resolvedMuiOptions = useMemo<MuiAdapterOptions>(
    () => ({
      ...muiOptions,
      ...(layoutOptions === undefined ? {} : { layoutOptions }),
      ...(localizationOptions === undefined ? {} : { localizationOptions }),
      ...(muiSlotProps === undefined ? {} : { muiSlotProps })
    }),
    [layoutOptions, localizationOptions, muiOptions, muiSlotProps]
  );
  const components = useMemo(
    () => createMuiBuilderComponents(resolvedMuiOptions, customComponents),
    [resolvedMuiOptions, customComponents]
  );
  const slots = useMemo(
    () => createMuiBuilderSlots(resolvedMuiOptions, customSlots),
    [resolvedMuiOptions, customSlots]
  );
  return <FormBuilder {...props} components={components} disableDefaultStyles slots={slots} />;
}
