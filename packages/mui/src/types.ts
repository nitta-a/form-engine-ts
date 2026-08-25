import type { BuilderActionIconType, LocalizationSummaryContext } from "@form-engine-ts/react";
import type { AccordionProps, CardProps, PaperProps, StackProps } from "@mui/material";
import type { ReactNode } from "react";

export type BuilderSectionName = "basicSettings" | "completionMessage" | "questions" | "addQuestion" | "localization";

export type MuiButtonVariant = "contained" | "outlined" | "text";

export interface LocaleOptionItem {
  readonly value: string;
  readonly label: string;
}

export type LocalizationSectionPlacement = "top" | "beforeQuestions" | "afterQuestions" | "bottom";

export interface MuiLayoutOptions {
  readonly sectionOrder?: readonly BuilderSectionName[];
}

export interface MuiLocalizationOptions {
  readonly availableLocales?: readonly (LocaleOptionItem | string)[];
  readonly placement?: LocalizationSectionPlacement;
  readonly collapsible?: boolean;
  readonly defaultExpanded?: boolean | "when-configured" | "always";
  readonly showSummary?: boolean;
  readonly renderSummary?: (context: LocalizationSummaryContext) => ReactNode;
  readonly emptyStateMessage?: string;
  readonly defaultLocaleControl?: "editable" | "readOnly" | "hidden";
  readonly noWrapActions?: boolean;
  readonly autoFocusNewTab?: boolean;
}

export interface MuiFieldEditorOptions {
  readonly description?: "editable" | "readOnly" | "hidden";
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
  readonly inputFullWidth?: boolean;
  readonly buttonFullWidth?: boolean;
  readonly dense?: boolean;
  readonly getLocaleLabel?: (locale: string) => string;
  readonly getActionLabel?: (actionType: BuilderActionIconType) => string;
  readonly layoutOptions?: MuiLayoutOptions;
  readonly fieldEditorOptions?: MuiFieldEditorOptions;
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
  readonly inputFullWidth?: boolean;
  readonly buttonFullWidth?: boolean;
  readonly dense: boolean;
  readonly getLocaleLabel?: (locale: string) => string;
  readonly getActionLabel?: (actionType: BuilderActionIconType) => string;
  readonly layoutOptions?: MuiLayoutOptions;
  readonly fieldEditorOptions?: MuiFieldEditorOptions;
  readonly localizationOptions?: MuiLocalizationOptions;
  readonly muiSlotProps?: MuiBuilderSlotProps;
}

export const DEFAULT_MUI_SECTION_ORDER: readonly BuilderSectionName[] = [
  "basicSettings",
  "questions",
  "addQuestion",
  "localization",
  "completionMessage"
];

export const MUI_LOCALIZATION_SECTION_ORDERS: Readonly<
  Record<LocalizationSectionPlacement, readonly BuilderSectionName[]>
> = {
  top: ["localization", "basicSettings", "completionMessage", "questions", "addQuestion"],
  beforeQuestions: ["basicSettings", "localization", "completionMessage", "questions", "addQuestion"],
  afterQuestions: ["basicSettings", "questions", "addQuestion", "localization", "completionMessage"],
  bottom: ["basicSettings", "completionMessage", "questions", "addQuestion", "localization"]
};

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
    inputFullWidth: options.inputFullWidth ?? options.fullWidth ?? true,
    buttonFullWidth: options.buttonFullWidth ?? options.fullWidth ?? false,
    dense: options.dense ?? false,
    getLocaleLabel: options.getLocaleLabel ?? ((locale) => locale),
    ...(options.getActionLabel === undefined ? {} : { getActionLabel: options.getActionLabel }),
    layoutOptions: options.layoutOptions ?? {},
    fieldEditorOptions: {
      description: options.fieldEditorOptions?.description ?? "editable"
    },
    localizationOptions: {
      collapsible: options.localizationOptions?.collapsible ?? false,
      defaultExpanded: options.localizationOptions?.defaultExpanded ?? false,
      showSummary: options.localizationOptions?.showSummary ?? false,
      ...(options.localizationOptions?.availableLocales === undefined
        ? {}
        : { availableLocales: options.localizationOptions.availableLocales }),
      ...(options.localizationOptions?.placement === undefined
        ? {}
        : { placement: options.localizationOptions.placement }),
      ...(options.localizationOptions?.renderSummary === undefined
        ? {}
        : { renderSummary: options.localizationOptions.renderSummary }),
      ...(options.localizationOptions?.emptyStateMessage === undefined
        ? {}
        : { emptyStateMessage: options.localizationOptions.emptyStateMessage }),
      defaultLocaleControl: options.localizationOptions?.defaultLocaleControl ?? "editable",
      noWrapActions: options.localizationOptions?.noWrapActions ?? true,
      autoFocusNewTab: options.localizationOptions?.autoFocusNewTab ?? true
    },
    muiSlotProps: options.muiSlotProps ?? {}
  };
}
