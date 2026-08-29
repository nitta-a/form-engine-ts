import { BuilderActionIconType, FieldPropertyControlMode, QuestionType, FieldEditorControlsConfig, FieldTypeSelectOptionsConfig, LocalizationSummaryContext, UseTranslationWorkspaceOptions, BuilderButtonProps, BuilderCheckboxProps, BuilderErrorMessageProps, BuilderFieldsetProps, BuilderIconButtonProps, BuilderSectionProps, BuilderSelectProps, BuilderTextAreaProps, BuilderTextInputProps, FormBuilderComponents, FormBuilderSlots, FormBuilderProps, BuilderFieldEditorSlotProps, BuilderLocalizationSlotProps, ChoiceGroupSlotProps, BuilderOptionEditorSlotProps, BuilderToolbarSlotProps, UseTranslationComparisonOptions, TranslationComparisonItemIconProps, TranslationComparisonHeaderProps, TranslationComparisonLocaleSelectorProps, TranslationComparisonItemRowProps, ConfirmRemoveLocaleSlotProps, TranslationEventPayload, TranslationWorkspaceError, TranslationSlotChangeEvent, TranslationWorkspaceSlots } from '@form-engine-ts/react';
import * as react from 'react';
import { ReactNode, ComponentType, ReactElement } from 'react';
import * as _form_engine_ts_core from '@form-engine-ts/core';
import { FormEngineMessages, TranslationMissingKeyEvent, FormEngineTranslator, LocaleOption, FormSchema, DisplayRule, FormPolicy, TranslationAdapter, AsyncTranslationAdapter, TranslationReport, TranslationStatus } from '@form-engine-ts/core';
import { CardProps, PaperProps, AccordionProps, StackProps, TextFieldProps, SelectProps, MenuProps, CheckboxProps, ButtonProps, IconButtonProps } from '@mui/material';

type BuilderSectionName = "basicSettings" | "completionMessage" | "questions" | "addQuestion" | "localization" | "submissionSettings";
type MuiButtonVariant = "contained" | "outlined" | "text";
type MuiComponentSlotProps<T> = Partial<T> & {
    readonly [key: `data-${string}`]: string | number | boolean | undefined;
};
interface LocaleOptionItem {
    readonly value: string;
    readonly label: string;
    readonly translatable?: boolean;
    readonly removable?: boolean;
    readonly metadata?: Readonly<Record<string, unknown>>;
}
type MuiLocaleOption = LocaleOption | LocaleOptionItem;
interface MuiFormEngineI18nOptions {
    readonly locale?: string;
    readonly fallbackLocale?: string;
    readonly messages?: FormEngineMessages;
    readonly onMissingKey?: (event: TranslationMissingKeyEvent) => void;
    readonly strict?: boolean;
    readonly translator?: FormEngineTranslator;
    readonly getLocaleLabel?: (locale: string) => string;
    readonly getActionLabel?: (actionType: string) => string;
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
interface MuiLocalizationSlotOptions {
    readonly mode?: "standard" | "inline-workspace";
    readonly workspaceOptions?: Partial<UseTranslationWorkspaceOptions>;
}
interface MuiSubmissionSettingsOptions {
    readonly enabled: boolean;
    readonly placement?: "beforeQuestions" | "afterQuestions" | "bottom";
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
    readonly localization?: MuiLocalizationSlotOptions;
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
    readonly localization?: MuiLocalizationSlotOptions;
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
    readonly localization?: MuiLocalizationSlotOptions;
    readonly submissionSettingsOptions?: MuiSubmissionSettingsOptions;
    readonly muiSlotProps?: MuiBuilderSlotProps;
    readonly components?: Partial<FormBuilderComponents>;
    readonly slots?: Partial<FormBuilderSlots>;
    readonly i18n?: MuiFormEngineI18nOptions;
}
declare function MuiFormBuilder({ muiOptions, layoutOptions, localizationOptions, localization, submissionSettingsOptions, muiSlotProps, components: customComponents, slots: customSlots, i18n, sectionOrder, ...props }: MuiFormBuilderProps): react.JSX.Element;

interface ConditionEditorProps {
    readonly schema: FormSchema;
    readonly fieldId: string;
    readonly value?: DisplayRule;
    readonly onChange: (rule: DisplayRule | undefined) => void;
    readonly readOnly?: boolean;
}
declare function ConditionEditor({ schema, fieldId, value, onChange, readOnly }: ConditionEditorProps): react.JSX.Element;

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

interface TranslationComparisonWorkspaceProps {
    readonly schema: FormSchema;
    readonly sourceLocale?: string;
    readonly targetLocale?: string;
    readonly availableLocales?: readonly (string | LocaleOption)[];
    readonly policy?: FormPolicy;
    readonly readOnly?: boolean;
    readonly translationAdapter?: TranslationAdapter | AsyncTranslationAdapter;
    readonly signal?: AbortSignal;
    readonly onChange?: (nextSchema: FormSchema) => void;
    readonly onTranslationChange?: UseTranslationComparisonOptions["onTranslationChange"];
    readonly onTranslationReport?: (report: TranslationReport) => void;
    readonly onTranslationError?: UseTranslationComparisonOptions["onTranslationError"];
    readonly onLocaleAdded?: (locale: string) => void;
    readonly onLocaleRemoved?: (locale: string) => void;
    readonly onLocaleChange?: (locale: string) => void;
    readonly beforeRemoveLocale?: UseTranslationComparisonOptions["beforeRemoveLocale"];
    readonly onTranslationStart?: UseTranslationComparisonOptions["onTranslationStart"];
    readonly onTranslationSuccess?: UseTranslationComparisonOptions["onTranslationSuccess"];
    readonly validateLocale?: UseTranslationComparisonOptions["validateLocale"];
    readonly createTranslationMetadata?: UseTranslationComparisonOptions["createTranslationMetadata"];
    readonly showInternalPath?: boolean;
    readonly localeSelectorMode?: "tabs" | "select";
    readonly renderItemIcon?: (props: TranslationComparisonItemIconProps) => ReactNode;
    readonly getTranslationSlotIcon?: (props: TranslationComparisonItemIconProps) => ReactNode;
    readonly i18n?: MuiFormEngineI18nOptions;
    readonly slots?: {
        readonly renderHeader?: (props: TranslationComparisonHeaderProps) => ReactNode;
        readonly renderTargetLocaleSelector?: (props: TranslationComparisonLocaleSelectorProps) => ReactNode;
        readonly renderItemRow?: (props: TranslationComparisonItemRowProps) => ReactNode;
        readonly renderStatusBadge?: (props: {
            readonly status: TranslationStatus;
        }) => ReactNode;
        readonly confirmRemoveLocale?: (props: ConfirmRemoveLocaleSlotProps) => ReactNode;
    };
}
declare function TranslationComparisonWorkspace(props: TranslationComparisonWorkspaceProps): react.JSX.Element;

interface TranslationWorkspaceProps {
    readonly schema: FormSchema;
    readonly onChange?: (schema: FormSchema) => void;
    readonly sourceLocale?: string;
    readonly targetLocale?: string;
    readonly translationAdapter?: TranslationAdapter | AsyncTranslationAdapter;
    readonly signal?: AbortSignal;
    readonly readOnly?: boolean;
    readonly policy?: FormPolicy;
    readonly availableLocales?: readonly (string | LocaleOption)[];
    readonly onLocaleAdded?: (locale: string) => void;
    readonly onLocaleRemoved?: (locale: string) => void;
    readonly onLocaleChange?: (locale: string) => void;
    readonly beforeRemoveLocale?: (locale: string, context: {
        readonly slotCount: number;
    }) => Promise<boolean> | boolean;
    readonly onTranslationStart?: (params: {
        readonly targetLocale: string;
        readonly mode: "manual" | "automatic";
    }) => void;
    readonly onTranslationSuccess?: (payload: TranslationEventPayload) => void;
    readonly onTranslationReport?: (report: _form_engine_ts_core.TranslationReport) => void;
    readonly onTranslationError?: (params: {
        readonly targetLocale: string;
        readonly error: TranslationWorkspaceError;
    }) => void;
    readonly onTranslationChange?: (event: TranslationSlotChangeEvent) => void;
    readonly createTranslationMetadata?: UseTranslationWorkspaceOptions["createTranslationMetadata"];
    readonly validateLocale?: UseTranslationWorkspaceOptions["validateLocale"];
    readonly showInternalPath?: boolean;
    readonly localeSelectorMode?: "tabs" | "select";
    readonly i18n?: MuiFormEngineI18nOptions;
    readonly slots?: TranslationWorkspaceSlots;
}
declare function TranslationWorkspace(props: TranslationWorkspaceProps): react.JSX.Element;

export { type BuilderSectionName, ConditionEditor, type ConditionEditorProps, DEFAULT_MUI_SECTION_ORDER, type LocaleOptionItem, type LocalizationSectionPlacement, MUI_LOCALIZATION_SECTION_ORDERS, type MuiAdapterOptions, type MuiBuilderOverrides, type MuiBuilderSlotProps, MuiButtonAdapter, type MuiButtonVariant, MuiCheckboxAdapter, MuiChoiceGroupSlot, MuiErrorMessageAdapter, type MuiFieldEditorOptions, MuiFieldEditorSlot, MuiFieldsetAdapter, MuiFormBuilder, MuiFormBuilderContext, type MuiFormBuilderContextValue, type MuiFormBuilderProps, type MuiFormEngineI18nOptions, MuiIconButtonAdapter, type MuiLayoutOptions, type MuiLocaleOption, type MuiLocalizationOptions, MuiLocalizationSlot, type MuiLocalizationSlotOptions, MuiOptionEditorSlot, MuiSectionAdapter, MuiSelectAdapter, type MuiSlotProps, type MuiSubmissionSettingsOptions, MuiTextAreaAdapter, MuiTextInputAdapter, MuiToolbarSlot, type ResolvedMuiAdapterOptions, TranslationComparisonWorkspace, type TranslationComparisonWorkspaceProps, TranslationWorkspace, type TranslationWorkspaceProps, createMuiBuilderComponents, createMuiBuilderProps, createMuiBuilderSlots, createMuiButtonAdapter, createMuiCheckboxAdapter, createMuiErrorMessageAdapter, createMuiFieldEditorSlot, createMuiFieldsetAdapter, createMuiIconButtonAdapter, createMuiLocalizationSlot, createMuiOptionEditorSlot, createMuiSectionAdapter, createMuiSelectAdapter, createMuiTextAreaAdapter, createMuiTextInputAdapter, createMuiToolbarSlot, mergeMuiAdapterOptions, muiBuilderComponents, muiBuilderSlots, muiDefaultFieldTypeIcon, muiDefaultIconResolver, resolveMuiAdapterOptions, useResolvedMuiAdapterOptions };
