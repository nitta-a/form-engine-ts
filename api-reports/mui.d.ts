import { BuilderButtonProps, BuilderCheckboxProps, BuilderErrorMessageProps, BuilderFieldsetProps, BuilderIconButtonProps, BuilderSectionProps, BuilderSelectProps, BuilderTextAreaProps, BuilderTextInputProps, FormBuilderComponents, FormBuilderSlots, FormBuilderProps, BuilderActionIconType, BuilderFieldEditorSlotProps, BuilderLocalizationSlotProps, BuilderOptionEditorSlotProps, BuilderToolbarSlotProps } from '@form-engine-ts/react';
import * as react from 'react';
import { ComponentType, ReactNode } from 'react';

interface MuiAdapterOptions {
    readonly size?: "small" | "medium";
    readonly variant?: "outlined" | "filled" | "standard";
    readonly buttonVariant?: "contained" | "outlined" | "text";
    readonly fullWidth?: boolean;
    readonly dense?: boolean;
}
interface ResolvedMuiAdapterOptions {
    readonly size: "small" | "medium";
    readonly variant: "outlined" | "filled" | "standard";
    readonly buttonVariant: "contained" | "outlined" | "text";
    readonly fullWidth: boolean;
    readonly dense: boolean;
}
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

declare function muiDefaultIconResolver(actionType: BuilderActionIconType): ReactNode;

interface MuiFormBuilderProps extends Omit<FormBuilderProps, "components" | "disableDefaultStyles" | "slots" | "unstyled"> {
    readonly muiOptions?: MuiAdapterOptions;
    readonly components?: Partial<FormBuilderComponents>;
    readonly slots?: Partial<FormBuilderSlots>;
}
declare function MuiFormBuilder({ muiOptions, components: customComponents, slots: customSlots, ...props }: MuiFormBuilderProps): react.JSX.Element;

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

export { type MuiAdapterOptions, type MuiBuilderOverrides, MuiButtonAdapter, MuiCheckboxAdapter, MuiErrorMessageAdapter, MuiFieldEditorSlot, MuiFieldsetAdapter, MuiFormBuilder, type MuiFormBuilderProps, MuiIconButtonAdapter, MuiLocalizationSlot, MuiOptionEditorSlot, MuiSectionAdapter, MuiSelectAdapter, MuiTextAreaAdapter, MuiTextInputAdapter, MuiToolbarSlot, type ResolvedMuiAdapterOptions, createMuiBuilderComponents, createMuiBuilderProps, createMuiBuilderSlots, createMuiButtonAdapter, createMuiCheckboxAdapter, createMuiErrorMessageAdapter, createMuiFieldEditorSlot, createMuiFieldsetAdapter, createMuiIconButtonAdapter, createMuiLocalizationSlot, createMuiOptionEditorSlot, createMuiSectionAdapter, createMuiSelectAdapter, createMuiTextAreaAdapter, createMuiTextInputAdapter, createMuiToolbarSlot, muiBuilderComponents, muiBuilderSlots, muiDefaultIconResolver, resolveMuiAdapterOptions };
