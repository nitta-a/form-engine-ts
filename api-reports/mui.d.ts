import { BuilderActionIconType, BuilderButtonProps, BuilderCheckboxProps, BuilderErrorMessageProps, BuilderFieldsetProps, BuilderIconButtonProps, BuilderSectionProps, BuilderSelectProps, BuilderTextAreaProps, BuilderTextInputProps, FormBuilderComponents, FormBuilderSlots, FormBuilderProps, BuilderFieldEditorSlotProps, BuilderLocalizationSlotProps, BuilderOptionEditorSlotProps, BuilderToolbarSlotProps } from '@form-engine-ts/react';
import * as react from 'react';
import { ComponentType, ReactNode } from 'react';
import { CardProps, PaperProps, StackProps, AccordionProps } from '@mui/material';

type BuilderSectionName = "basicSettings" | "completionMessage" | "questions" | "addQuestion" | "localization";
type MuiButtonVariant = "contained" | "outlined" | "text";
interface MuiLayoutOptions {
    readonly sectionOrder?: readonly BuilderSectionName[];
}
interface MuiLocalizationOptions {
    readonly collapsible?: boolean;
    readonly defaultExpanded?: boolean | "when-configured";
    readonly defaultLocaleControl?: "editable" | "readOnly" | "hidden";
}
interface MuiFieldEditorOptions {
    readonly description?: "editable" | "readOnly" | "hidden";
}
interface MuiBuilderSlotProps {
    readonly card?: Partial<CardProps>;
    readonly paper?: Partial<PaperProps>;
    readonly stack?: Partial<StackProps>;
    readonly accordion?: Partial<AccordionProps>;
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

declare function createMuiSelectAdapter(options?: MuiAdapterOptions): ComponentType<BuilderSelectProps>;
declare const MuiSelectAdapter: ComponentType<BuilderSelectProps>;

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

declare function createMuiOptionEditorSlot(options?: MuiAdapterOptions): ComponentType<BuilderOptionEditorSlotProps>;
declare const MuiOptionEditorSlot: NonNullable<FormBuilderSlots["optionEditor"]>;

declare function createMuiToolbarSlot(options?: MuiAdapterOptions): ComponentType<BuilderToolbarSlotProps>;
declare const MuiToolbarSlot: NonNullable<FormBuilderSlots["toolbar"]>;

declare const muiBuilderSlots: FormBuilderSlots;
declare function createMuiBuilderSlots(options?: MuiAdapterOptions, customOverrides?: Partial<FormBuilderSlots>): FormBuilderSlots;

export { type BuilderSectionName, DEFAULT_MUI_SECTION_ORDER, type MuiAdapterOptions, type MuiBuilderOverrides, type MuiBuilderSlotProps, MuiButtonAdapter, type MuiButtonVariant, MuiCheckboxAdapter, MuiErrorMessageAdapter, type MuiFieldEditorOptions, MuiFieldEditorSlot, MuiFieldsetAdapter, MuiFormBuilder, MuiFormBuilderContext, type MuiFormBuilderContextValue, type MuiFormBuilderProps, MuiIconButtonAdapter, type MuiLayoutOptions, type MuiLocalizationOptions, MuiLocalizationSlot, MuiOptionEditorSlot, MuiSectionAdapter, MuiSelectAdapter, MuiTextAreaAdapter, MuiTextInputAdapter, MuiToolbarSlot, type ResolvedMuiAdapterOptions, createMuiBuilderComponents, createMuiBuilderProps, createMuiBuilderSlots, createMuiButtonAdapter, createMuiCheckboxAdapter, createMuiErrorMessageAdapter, createMuiFieldEditorSlot, createMuiFieldsetAdapter, createMuiIconButtonAdapter, createMuiLocalizationSlot, createMuiOptionEditorSlot, createMuiSectionAdapter, createMuiSelectAdapter, createMuiTextAreaAdapter, createMuiTextInputAdapter, createMuiToolbarSlot, mergeMuiAdapterOptions, muiBuilderComponents, muiBuilderSlots, muiDefaultIconResolver, resolveMuiAdapterOptions, useResolvedMuiAdapterOptions };
