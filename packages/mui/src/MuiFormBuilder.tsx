import {
  FormBuilder,
  type FormBuilderComponents,
  type FormBuilderProps,
  type FormBuilderSlots
} from "@form-engine-ts/react";
import { useMemo } from "react";
import { muiBuilderComponents } from "./components";
import { MuiFormBuilderContext, mergeMuiAdapterOptions } from "./context";
import { muiBuilderSlots } from "./slots";
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
  sectionOrder,
  ...props
}: MuiFormBuilderProps) {
  const contextOptions = useMemo<MuiAdapterOptions>(
    () =>
      mergeMuiAdapterOptions(muiOptions, {
        ...(layoutOptions === undefined ? {} : { layoutOptions }),
        ...(localizationOptions === undefined ? {} : { localizationOptions }),
        ...(muiSlotProps === undefined ? {} : { muiSlotProps })
      }),
    [layoutOptions, localizationOptions, muiOptions, muiSlotProps]
  );
  const contextValue = useMemo(() => ({ options: contextOptions }), [contextOptions]);
  const components = useMemo(() => ({ ...muiBuilderComponents, ...customComponents }), [customComponents]);
  const slots = useMemo(() => ({ ...muiBuilderSlots, ...customSlots }), [customSlots]);
  const resolvedSectionOrder = sectionOrder ?? contextOptions.layoutOptions?.sectionOrder;
  return (
    <MuiFormBuilderContext.Provider value={contextValue}>
      <FormBuilder
        {...props}
        components={components}
        disableDefaultStyles
        slots={slots}
        {...(resolvedSectionOrder === undefined ? {} : { sectionOrder: resolvedSectionOrder })}
      />
    </MuiFormBuilderContext.Provider>
  );
}
