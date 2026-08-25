import type { BuilderActionIconType } from "@form-engine-ts/react";
import type { AccordionProps, CardProps, PaperProps, StackProps } from "@mui/material";

export type BuilderSectionName = "basicSettings" | "completionMessage" | "questions" | "addQuestion" | "localization";

export type MuiButtonVariant = "contained" | "outlined" | "text";

export interface MuiLayoutOptions {
  readonly sectionOrder?: readonly BuilderSectionName[];
}

export interface MuiLocalizationOptions {
  readonly collapsible?: boolean;
  readonly defaultExpanded?: boolean | "when-configured";
}

export interface MuiBuilderSlotProps {
  readonly card?: Partial<CardProps>;
  readonly paper?: Partial<PaperProps>;
  readonly stack?: Partial<StackProps>;
  readonly accordion?: Partial<AccordionProps>;
}

export interface MuiAdapterOptions {
  readonly size?: "small" | "medium";
  readonly variant?: "outlined" | "filled" | "standard";
  readonly buttonVariant?: "contained" | "outlined" | "text";
  readonly buttonVariants?: {
    readonly primary?: MuiButtonVariant;
    readonly secondary?: MuiButtonVariant;
    readonly danger?: MuiButtonVariant;
  };
  readonly fullWidth?: boolean;
  readonly dense?: boolean;
  readonly getLocaleLabel?: (locale: string) => string;
  readonly getActionLabel?: (actionType: BuilderActionIconType) => string;
  readonly layoutOptions?: MuiLayoutOptions;
  readonly localizationOptions?: MuiLocalizationOptions;
  readonly muiSlotProps?: MuiBuilderSlotProps;
}

export interface ResolvedMuiAdapterOptions {
  readonly size: "small" | "medium";
  readonly variant: "outlined" | "filled" | "standard";
  readonly buttonVariant: "contained" | "outlined" | "text";
  readonly buttonVariants?: {
    readonly primary: MuiButtonVariant;
    readonly secondary: MuiButtonVariant;
    readonly danger: MuiButtonVariant;
  };
  readonly fullWidth: boolean;
  readonly dense: boolean;
  readonly getLocaleLabel?: (locale: string) => string;
  readonly getActionLabel?: (actionType: BuilderActionIconType) => string;
  readonly layoutOptions?: MuiLayoutOptions;
  readonly localizationOptions?: MuiLocalizationOptions;
  readonly muiSlotProps?: MuiBuilderSlotProps;
}

export const DEFAULT_MUI_SECTION_ORDER: readonly BuilderSectionName[] = [
  "basicSettings",
  "questions",
  "addQuestion",
  "localization"
];

export function resolveMuiAdapterOptions(options: MuiAdapterOptions = {}): ResolvedMuiAdapterOptions {
  const buttonVariant = options.buttonVariant ?? "contained";
  return {
    size: options.size ?? "medium",
    variant: options.variant ?? "outlined",
    buttonVariant,
    buttonVariants: {
      primary: options.buttonVariants?.primary ?? buttonVariant,
      secondary: options.buttonVariants?.secondary ?? buttonVariant,
      danger: options.buttonVariants?.danger ?? buttonVariant
    },
    fullWidth: options.fullWidth ?? true,
    dense: options.dense ?? false,
    getLocaleLabel: options.getLocaleLabel ?? ((locale) => locale),
    ...(options.getActionLabel === undefined ? {} : { getActionLabel: options.getActionLabel }),
    layoutOptions: options.layoutOptions ?? {},
    localizationOptions: {
      collapsible: options.localizationOptions?.collapsible ?? false,
      defaultExpanded: options.localizationOptions?.defaultExpanded ?? false
    },
    muiSlotProps: options.muiSlotProps ?? {}
  };
}
