import { createContext, useContext } from "react";
import type { MuiAdapterOptions } from "./types";
import { resolveMuiAdapterOptions } from "./types";

export interface MuiFormBuilderContextValue {
  readonly options: MuiAdapterOptions;
}

export const MuiFormBuilderContext = createContext<MuiFormBuilderContextValue>({ options: {} });

export function mergeMuiAdapterOptions(
  base: MuiAdapterOptions = {},
  overrides: MuiAdapterOptions = {}
): MuiAdapterOptions {
  return {
    ...base,
    ...overrides,
    ...(base.buttonVariants === undefined && overrides.buttonVariants === undefined
      ? {}
      : { buttonVariants: { ...base.buttonVariants, ...overrides.buttonVariants } }),
    ...(base.layoutOptions === undefined && overrides.layoutOptions === undefined
      ? {}
      : { layoutOptions: { ...base.layoutOptions, ...overrides.layoutOptions } }),
    ...(base.fieldEditorOptions === undefined && overrides.fieldEditorOptions === undefined
      ? {}
      : {
          fieldEditorOptions: {
            ...base.fieldEditorOptions,
            ...overrides.fieldEditorOptions,
            ...(base.fieldEditorOptions?.byType === undefined && overrides.fieldEditorOptions?.byType === undefined
              ? {}
              : { byType: { ...base.fieldEditorOptions?.byType, ...overrides.fieldEditorOptions?.byType } })
          }
        }),
    ...(base.localizationOptions === undefined && overrides.localizationOptions === undefined
      ? {}
      : { localizationOptions: { ...base.localizationOptions, ...overrides.localizationOptions } }),
    ...(base.muiSlotProps === undefined && overrides.muiSlotProps === undefined
      ? {}
      : { muiSlotProps: { ...base.muiSlotProps, ...overrides.muiSlotProps } })
  };
}

export function useResolvedMuiAdapterOptions(overrides?: MuiAdapterOptions) {
  const context = useContext(MuiFormBuilderContext);
  return resolveMuiAdapterOptions(
    overrides === undefined ? context.options : mergeMuiAdapterOptions(context.options, overrides)
  );
}
