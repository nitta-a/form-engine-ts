import {
  FormBuilder,
  type FormBuilderComponents,
  type FormBuilderProps,
  type FormBuilderSectionName,
  type FormBuilderSlots
} from "@form-engine-ts/react";
import { useMemo } from "react";
import { muiBuilderComponents } from "./components";
import { MuiFormBuilderContext, mergeMuiAdapterOptions } from "./context";
import { muiBuilderSlots } from "./slots";
import {
  DEFAULT_MUI_SECTION_ORDER,
  MUI_LOCALIZATION_SECTION_ORDERS,
  type MuiAdapterOptions,
  type MuiBuilderSlotProps,
  type MuiLayoutOptions,
  type MuiLocalizationOptions,
  type MuiSubmissionSettingsOptions
} from "./types";

export interface MuiFormBuilderProps
  extends Omit<FormBuilderProps, "components" | "disableDefaultStyles" | "slots" | "unstyled"> {
  readonly muiOptions?: MuiAdapterOptions;
  readonly layoutOptions?: MuiLayoutOptions;
  readonly localizationOptions?: MuiLocalizationOptions;
  readonly submissionSettingsOptions?: MuiSubmissionSettingsOptions;
  readonly muiSlotProps?: MuiBuilderSlotProps;
  readonly components?: Partial<FormBuilderComponents>;
  readonly slots?: Partial<FormBuilderSlots>;
}

export function MuiFormBuilder({
  muiOptions,
  layoutOptions,
  localizationOptions,
  submissionSettingsOptions,
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
  const baseSectionOrder =
    sectionOrder ??
    (placement === undefined ? contextOptions.layoutOptions?.sectionOrder : MUI_LOCALIZATION_SECTION_ORDERS[placement]);
  const resolvedSectionOrder: readonly FormBuilderSectionName[] | undefined = (():
    | readonly FormBuilderSectionName[]
    | undefined => {
    if (submissionSettingsOptions?.enabled !== true) return baseSectionOrder;
    const order: FormBuilderSectionName[] = [
      ...((baseSectionOrder ?? DEFAULT_MUI_SECTION_ORDER) as readonly FormBuilderSectionName[])
    ].filter((name) => name !== "submissionSettings");
    const settingsPlacement = submissionSettingsOptions.placement ?? "bottom";
    const target =
      settingsPlacement === "beforeQuestions"
        ? "questions"
        : settingsPlacement === "afterQuestions"
          ? "addQuestion"
          : undefined;
    if (target === undefined) return [...order, "submissionSettings"];
    const index = order.indexOf(target);
    order.splice(
      index < 0 ? order.length : index + (settingsPlacement === "afterQuestions" ? 1 : 0),
      0,
      "submissionSettings"
    );
    return order;
  })();
  return (
    <MuiFormBuilderContext.Provider value={contextValue}>
      <FormBuilder
        {...props}
        components={components}
        disableDefaultStyles
        slots={slots}
        {...(resolvedSectionOrder === undefined ? {} : { sectionOrder: resolvedSectionOrder })}
        {...(submissionSettingsOptions === undefined ? {} : { submissionSettingsOptions })}
      />
    </MuiFormBuilderContext.Provider>
  );
}
