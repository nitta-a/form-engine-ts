import { BuilderActionIconType, FieldPropertyControlMode, QuestionType, FieldEditorControlsConfig, FieldTypeSelectOptionsConfig, LocalizationSummaryContext, BuilderButtonProps, BuilderCheckboxProps, BuilderErrorMessageProps, BuilderFieldsetProps, BuilderIconButtonProps, BuilderSectionProps, BuilderSelectProps, BuilderTextAreaProps, BuilderTextInputProps, FormBuilderComponents, FormBuilderSlots, FormBuilderProps, BuilderFieldEditorSlotProps, BuilderLocalizationSlotProps, ChoiceGroupSlotProps, BuilderOptionEditorSlotProps, BuilderToolbarSlotProps } from '@form-engine-ts/react';
import * as react from 'react';
import { ReactNode, ComponentType, ReactElement } from 'react';
import { CardProps, PaperProps, AccordionProps, StackProps, TextFieldProps, SelectProps, MenuProps, CheckboxProps, ButtonProps, IconButtonProps } from '@mui/material';

type BuilderSectionName = "basicSettings" | "completionMessage" | "questions" | "addQuestion" | "localization";
type MuiButtonVariant = "contained" | "outlined" | "text";
type MuiComponentSlotProps<T> = Partial<T> & {
    readonly [key: `data-${string}`]: string | number | boolean | undefined;
};
interface LocaleOptionItem {
    readonly value: string;
    readonly label: string;
}
type LocalizationSectionPlacement = "top" | "beforeQuestions" | "afterQuestions" | "bottom";
interface MuiLayoutOptions {
    readonly sectionOrder?: readonly BuilderSectionName[];
}
interface MuiLocalizationOptions {
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
/**
 * MUI's field editor controls mirror `FieldEditorControlsConfig` while keeping
 * the original interface members directly declared for semver/reporting compatibility.
 */
interface MuiFieldEditorOptions {
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
interface MuiSlotProps {
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
interface MuiBuilderSlotProps {
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
interface MuiAdapterOptions {
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
interface ResolvedMuiAdapterOptions {
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
declare const DEFAULT_MUI_SECTION_ORDER: readonly BuilderSectionName[];
declare const MUI_LOCALIZATION_SECTION_ORDERS: Readonly<Record<LocalizationSectionPlacement, readonly BuilderSectionName[]>>;
declare function resolveMuiAdapterOptions(options?: MuiAdapterOptions): ResolvedMuiAdapterOptions;

declare function createMuiButtonAdapter(options?: MuiAdapterOptions): ComponentType<BuilderButtonProps>;
declare const MuiButtonAdapter: ComponentType<BuilderButtonProps>;

declare function createMuiCheckboxAdapter(options?: MuiAdapterOptions): ComponentType<BuilderCheckboxProps>;
declare const MuiCheckboxAdapter: ComponentType<BuilderCheckboxProps>;

declare function createMuiErrorMessageAdapter(_options?: MuiAdapterOptions): ComponentType<BuilderErrorMessageProps>;
declare const MuiErrorMessageAdapter: ComponentType<BuilderErrorMessageProps>;

declare function createMuiFieldsetAdapter(options?: MuiAdapterOptions): ComponentType<BuilderFieldsetProps>;
declare const MuiFieldsetAdapter: ComponentType<BuilderFieldsetProps>;

declare function createMuiIconButtonAdapter(options?: MuiAdapterOptions): ComponentType<BuilderIconButtonProps>;
declare const MuiIconButtonAdapter: ComponentType<BuilderIconButtonProps>;

declare function createMuiSectionAdapter(options?: MuiAdapterOptions): ComponentType<BuilderSectionProps>;
declare const MuiSectionAdapter: ComponentType<BuilderSectionProps>;

declare function createMuiSelectAdapter<T extends string = string>(options?: MuiAdapterOptions): ComponentType<BuilderSelectProps<T>>;
declare function MuiSelectAdapter<T extends string = string>(props: BuilderSelectProps<T>): ReactElement;

declare function createMuiTextAreaAdapter(options?: MuiAdapterOptions): ComponentType<BuilderTextAreaProps>;
declare const MuiTextAreaAdapter: ComponentType<BuilderTextAreaProps>;

declare function createMuiTextInputAdapter(options?: MuiAdapterOptions): ComponentType<BuilderTextInputProps>;
declare const MuiTextInputAdapter: ComponentType<BuilderTextInputProps>;

interface MuiBuilderOverrides {
    readonly components?: Partial<FormBuilderComponents>;
    readonly slots?: Partial<FormBuilderSlots>;
}
declare function createMuiBuilderProps(options?: MuiAdapterOptions, overrides?: MuiBuilderOverrides): Pick<FormBuilderProps, "components" | "disableDefaultStyles" | "slots">;

declare const muiBuilderComponents: FormBuilderComponents;
declare function createMuiBuilderComponents(customOverrides?: Partial<FormBuilderComponents>): FormBuilderComponents;
declare function createMuiBuilderComponents(options?: MuiAdapterOptions, customOverrides?: Partial<FormBuilderComponents>): FormBuilderComponents;

interface MuiFormBuilderContextValue {
    readonly options: MuiAdapterOptions;
}
declare const MuiFormBuilderContext: react.Context<MuiFormBuilderContextValue>;
declare function mergeMuiAdapterOptions(base?: MuiAdapterOptions, overrides?: MuiAdapterOptions): MuiAdapterOptions;
declare function useResolvedMuiAdapterOptions(overrides?: MuiAdapterOptions): ResolvedMuiAdapterOptions;

declare function muiDefaultIconResolver(actionType: BuilderActionIconType): ReactNode;
declare function muiDefaultFieldTypeIcon(type: QuestionType): ReactNode;

interface MuiFormBuilderProps extends Omit<FormBuilderProps, "components" | "disableDefaultStyles" | "slots" | "unstyled"> {
    readonly muiOptions?: MuiAdapterOptions;
    readonly layoutOptions?: MuiLayoutOptions;
    readonly localizationOptions?: MuiLocalizationOptions;
    readonly muiSlotProps?: MuiBuilderSlotProps;
    readonly components?: Partial<FormBuilderComponents>;
    readonly slots?: Partial<FormBuilderSlots>;
}
declare function MuiFormBuilder({ muiOptions, layoutOptions, localizationOptions, muiSlotProps, components: customComponents, slots: customSlots, sectionOrder, ...props }: MuiFormBuilderProps): react.JSX.Element;

declare function createMuiFieldEditorSlot(options?: MuiAdapterOptions): ComponentType<BuilderFieldEditorSlotProps>;
declare const MuiFieldEditorSlot: NonNullable<FormBuilderSlots["fieldEditor"]>;

declare function createMuiLocalizationSlot(options?: MuiAdapterOptions): ComponentType<BuilderLocalizationSlotProps>;
declare const MuiLocalizationSlot: NonNullable<FormBuilderSlots["localization"]>;

declare function MuiChoiceGroupSlot({ title, description, required, error, disabled, children, className }: ChoiceGroupSlotProps): react.JSX.Element;

declare function createMuiOptionEditorSlot(options?: MuiAdapterOptions): ComponentType<BuilderOptionEditorSlotProps>;
declare const MuiOptionEditorSlot: NonNullable<FormBuilderSlots["optionEditor"]>;

declare function createMuiToolbarSlot(options?: MuiAdapterOptions): ComponentType<BuilderToolbarSlotProps>;
declare const MuiToolbarSlot: NonNullable<FormBuilderSlots["toolbar"]>;

declare const muiBuilderSlots: FormBuilderSlots;
declare function createMuiBuilderSlots(options?: MuiAdapterOptions, customOverrides?: Partial<FormBuilderSlots>): FormBuilderSlots;

export { type BuilderSectionName, DEFAULT_MUI_SECTION_ORDER, type LocaleOptionItem, type LocalizationSectionPlacement, MUI_LOCALIZATION_SECTION_ORDERS, type MuiAdapterOptions, type MuiBuilderOverrides, type MuiBuilderSlotProps, MuiButtonAdapter, type MuiButtonVariant, MuiCheckboxAdapter, MuiChoiceGroupSlot, MuiErrorMessageAdapter, type MuiFieldEditorOptions, MuiFieldEditorSlot, MuiFieldsetAdapter, MuiFormBuilder, MuiFormBuilderContext, type MuiFormBuilderContextValue, type MuiFormBuilderProps, MuiIconButtonAdapter, type MuiLayoutOptions, type MuiLocalizationOptions, MuiLocalizationSlot, MuiOptionEditorSlot, MuiSectionAdapter, MuiSelectAdapter, type MuiSlotProps, MuiTextAreaAdapter, MuiTextInputAdapter, MuiToolbarSlot, type ResolvedMuiAdapterOptions, createMuiBuilderComponents, createMuiBuilderProps, createMuiBuilderSlots, createMuiButtonAdapter, createMuiCheckboxAdapter, createMuiErrorMessageAdapter, createMuiFieldEditorSlot, createMuiFieldsetAdapter, createMuiIconButtonAdapter, createMuiLocalizationSlot, createMuiOptionEditorSlot, createMuiSectionAdapter, createMuiSelectAdapter, createMuiTextAreaAdapter, createMuiTextInputAdapter, createMuiToolbarSlot, mergeMuiAdapterOptions, muiBuilderComponents, muiBuilderSlots, muiDefaultFieldTypeIcon, muiDefaultIconResolver, resolveMuiAdapterOptions, useResolvedMuiAdapterOptions };
