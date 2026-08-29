import {
  FormBuilder,
  type FormBuilderComponents,
  type FormBuilderProps,
  type FormBuilderSectionName,
  type FormBuilderSlots,
  FormEngineI18nProvider
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
  type MuiFormEngineI18nOptions,
  type MuiLayoutOptions,
  type MuiLocalizationOptions,
  type MuiLocalizationSlotOptions,
  type MuiSubmissionSettingsOptions
} from "./types";

export interface MuiFormBuilderProps
  extends Omit<FormBuilderProps, "components" | "disableDefaultStyles" | "slots" | "unstyled"> {
  readonly muiOptions?: MuiAdapterOptions;
  readonly layoutOptions?: MuiLayoutOptions;
  readonly localizationOptions?: MuiLocalizationOptions;
  readonly localization?: MuiLocalizationSlotOptions;
  readonly submissionSettingsOptions?: MuiSubmissionSettingsOptions;
  readonly muiSlotProps?: MuiBuilderSlotProps;
  readonly components?: Partial<FormBuilderComponents>;
  readonly slots?: Partial<FormBuilderSlots>;
  readonly i18n?: MuiFormEngineI18nOptions;
}

export function MuiFormBuilder({
  muiOptions,
  layoutOptions,
  localizationOptions,
  localization,
  submissionSettingsOptions,
  muiSlotProps,
  components: customComponents,
  slots: customSlots,
  i18n,
  sectionOrder,
  ...props
}: MuiFormBuilderProps) {
  const contextOptions = useMemo<MuiAdapterOptions>(
    () =>
      mergeMuiAdapterOptions(muiOptions, {
        ...(layoutOptions === undefined ? {} : { layoutOptions }),
        ...(localizationOptions === undefined ? {} : { localizationOptions }),
        ...(localization === undefined ? {} : { localization }),
        ...(muiSlotProps === undefined ? {} : { muiSlotProps })
      }),
    [layoutOptions, localization, localizationOptions, muiOptions, muiSlotProps]
  );
  const resolvedMuiOptions = useMemo(
    () =>
      mergeMuiAdapterOptions(contextOptions, {
        ...(i18n?.getLocaleLabel === undefined ? {} : { getLocaleLabel: i18n.getLocaleLabel }),
        ...(i18n?.getActionLabel === undefined ? {} : { getActionLabel: i18n.getActionLabel })
      }),
    [contextOptions, i18n?.getActionLabel, i18n?.getLocaleLabel]
  );
  const contextValue = useMemo(() => ({ options: resolvedMuiOptions }), [resolvedMuiOptions]);
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
  const content = (
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
  if (i18n === undefined) return content;
  return (
    <FormEngineI18nProvider
      {...(i18n.locale === undefined ? {} : { locale: i18n.locale })}
      {...(i18n.fallbackLocale === undefined ? {} : { fallbackLocale: i18n.fallbackLocale })}
      {...(i18n.messages === undefined ? {} : { messages: i18n.messages })}
      {...(i18n.onMissingKey === undefined ? {} : { onMissingKey: i18n.onMissingKey })}
      {...(i18n.strict === undefined ? {} : { strict: i18n.strict })}
      {...(i18n.translator === undefined ? {} : { translator: i18n.translator })}
    >
      {content}
    </FormEngineI18nProvider>
  );
}
