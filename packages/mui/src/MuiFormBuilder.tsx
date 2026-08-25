import {
  FormBuilder,
  type FormBuilderComponents,
  type FormBuilderProps,
  type FormBuilderSlots
} from "@form-engine-ts/react";
import { useMemo } from "react";
import { createMuiBuilderComponents } from "./components";
import { createMuiBuilderSlots } from "./slots";
import type { MuiAdapterOptions } from "./types";

export interface MuiFormBuilderProps
  extends Omit<FormBuilderProps, "components" | "disableDefaultStyles" | "slots" | "unstyled"> {
  readonly muiOptions?: MuiAdapterOptions;
  readonly components?: Partial<FormBuilderComponents>;
  readonly slots?: Partial<FormBuilderSlots>;
}

export function MuiFormBuilder({
  muiOptions,
  components: customComponents,
  slots: customSlots,
  ...props
}: MuiFormBuilderProps) {
  const components = useMemo(
    () => createMuiBuilderComponents(muiOptions, customComponents),
    [muiOptions, customComponents]
  );
  const slots = useMemo(() => createMuiBuilderSlots(muiOptions, customSlots), [muiOptions, customSlots]);
  return <FormBuilder {...props} components={components} disableDefaultStyles slots={slots} />;
}
