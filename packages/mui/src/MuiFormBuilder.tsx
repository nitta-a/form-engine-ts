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
import {
  MUI_LOCALIZATION_SECTION_ORDERS,
  type MuiAdapterOptions,
  type MuiBuilderSlotProps,
  type MuiLayoutOptions,
  type MuiLocalizationOptions
} from "./types";

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
  const placement = contextOptions.localizationOptions?.placement;
  const resolvedSectionOrder =
    sectionOrder ??
    (placement === undefined ? contextOptions.layoutOptions?.sectionOrder : MUI_LOCALIZATION_SECTION_ORDERS[placement]);
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
