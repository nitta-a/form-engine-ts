import type { FormEngineMessages, FormEngineTranslator, LocaleOption } from "@form-engine-ts/core";
import type {
  BuilderActionIconType,
  FieldEditorControlsConfig,
  FieldPropertyControlMode,
  FieldTypeSelectOptionsConfig,
  LocalizationSummaryContext,
  QuestionType
} from "@form-engine-ts/react";
import type {
  AccordionProps,
  ButtonProps,
  CardProps,
  CheckboxProps,
  IconButtonProps,
  MenuProps,
  PaperProps,
  SelectProps,
  StackProps,
  TextFieldProps
} from "@mui/material";
import type { ReactNode } from "react";

export type BuilderSectionName =
  | "basicSettings"
  | "completionMessage"
  | "questions"
  | "addQuestion"
  | "localization"
  | "submissionSettings";

export type MuiButtonVariant = "contained" | "outlined" | "text";

type MuiComponentSlotProps<T> = Partial<T> & {
  readonly [key: `data-${string}`]: string | number | boolean | undefined;
};

export interface LocaleOptionItem {
  readonly value: string;
  readonly label: string;
  readonly translatable?: boolean;
  readonly removable?: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export type MuiLocaleOption = LocaleOption | LocaleOptionItem;

export interface MuiFormEngineI18nOptions {
  readonly locale?: string;
  readonly fallbackLocale?: string;
  readonly messages?: FormEngineMessages;
  readonly translator?: FormEngineTranslator;
  readonly getLocaleLabel?: (locale: string) => string;
  readonly getActionLabel?: (actionType: string) => string;
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

export interface MuiSubmissionSettingsOptions {
  readonly enabled: boolean;
  readonly placement?: "beforeQuestions" | "afterQuestions" | "bottom";
}

/**
 * MUI's field editor controls mirror `FieldEditorControlsConfig` while keeping
 * the original interface members directly declared for semver/reporting compatibility.
 */
export interface MuiFieldEditorOptions {
  readonly title?: FieldPropertyControlMode;
  readonly description?: "editable" | "readOnly" | "hidden";
  readonly required?: FieldPropertyControlMode;
  readonly typeSelect?: FieldPropertyControlMode;
  readonly options?: FieldPropertyControlMode;
  readonly displayConditions?: FieldPropertyControlMode;
  readonly textLimits?: FieldPropertyControlMode;
  readonly ratingBounds?: FieldPropertyControlMode;
  readonly numberLimits?: FieldPropertyControlMode;
  /** Per-question-type overrides take precedence over the base controls. */
  readonly byType?: Partial<Record<QuestionType, Partial<FieldEditorControlsConfig>>>;
  readonly fieldTypeOptions?: FieldTypeSelectOptionsConfig;
}

export interface MuiSlotProps {
  readonly card?: Partial<CardProps>;
  readonly paper?: Partial<PaperProps>;
  readonly accordion?: Partial<AccordionProps>;
  readonly stack?: Partial<StackProps>;
  readonly textField?: MuiComponentSlotProps<TextFieldProps>;
  readonly select?: MuiComponentSlotProps<SelectProps>;
  readonly selectMenu?: Partial<MenuProps>;
  readonly checkbox?: MuiComponentSlotProps<CheckboxProps>;
  readonly button?: MuiComponentSlotProps<ButtonProps>;
  readonly iconButton?: MuiComponentSlotProps<IconButtonProps>;
}

export interface MuiBuilderSlotProps {
  readonly card?: Partial<CardProps>;
  readonly paper?: Partial<PaperProps>;
  readonly accordion?: Partial<AccordionProps>;
  readonly stack?: Partial<StackProps>;
  readonly textField?: MuiComponentSlotProps<TextFieldProps>;
  readonly select?: MuiComponentSlotProps<SelectProps>;
  readonly selectMenu?: Partial<MenuProps>;
  readonly checkbox?: MuiComponentSlotProps<CheckboxProps>;
  readonly button?: MuiComponentSlotProps<ButtonProps>;
  readonly iconButton?: MuiComponentSlotProps<IconButtonProps>;
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
      title: options.fieldEditorOptions?.title ?? "editable",
      description: options.fieldEditorOptions?.description ?? "editable",
      required: options.fieldEditorOptions?.required ?? "editable",
      typeSelect: options.fieldEditorOptions?.typeSelect ?? "editable",
      options: options.fieldEditorOptions?.options ?? "editable",
      displayConditions: options.fieldEditorOptions?.displayConditions ?? "editable",
      textLimits: options.fieldEditorOptions?.textLimits ?? "editable",
      ratingBounds: options.fieldEditorOptions?.ratingBounds ?? "editable",
      numberLimits: options.fieldEditorOptions?.numberLimits ?? "editable",
      ...(options.fieldEditorOptions?.byType === undefined ? {} : { byType: options.fieldEditorOptions.byType }),
      ...(options.fieldEditorOptions?.fieldTypeOptions === undefined
        ? {}
        : { fieldTypeOptions: options.fieldEditorOptions.fieldTypeOptions })
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
