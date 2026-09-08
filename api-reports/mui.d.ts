import { BuilderActionIconType, FieldPropertyControlMode, QuestionType, FieldEditorControlsConfig, FieldTypeSelectOptionsConfig, LocalizationSummaryContext, UseTranslationWorkspaceOptions, BuilderButtonProps, BuilderCheckboxProps, BuilderErrorMessageProps, BuilderFieldsetProps, BuilderIconButtonProps, BuilderSectionProps, BuilderSelectProps, BuilderTextAreaProps, BuilderTextInputProps, FormBuilderComponents, FormBuilderSlots, FormBuilderProps, FormRendererProps, ContentRendererClassNames, ContentRendererSlots, FormSubmissionMetadata, TypedFormRendererProps, BuilderFieldEditorSlotProps, BuilderOptionEditorSlotProps, BuilderLocalizationSlotProps, ChoiceGroupSlotProps, BuilderPagesSlotProps, BuilderToolbarSlotProps, UseTranslationComparisonOptions, TranslationComparisonItemIconProps, TranslationComparisonAppearance, TranslationComparisonHeaderProps, TranslationComparisonLocaleSelectorProps, TranslationComparisonItemRowProps, ConfirmRemoveLocaleSlotProps, TranslationEventPayload, TranslationWorkspaceError, TranslationSlotChangeEvent, TranslationWorkspaceSlots } from '@form-engine-ts/react';
export { InputBoxStyleOptions, TargetSpecificLayoutConfig, TranslationLayoutOptions, TranslationTargetKind, TranslationWorkspaceAppearance } from '@form-engine-ts/react';
import * as react from 'react';
import { ReactNode, ComponentType, ReactElement } from 'react';
import * as _form_engine_ts_core from '@form-engine-ts/core';
import { FormEngineMessages, TranslationWorkspaceCustomDictionary, TranslationMissingKeyEvent, FormEngineTranslator, LocaleOption, FormContentMode, ContentModeIssueCode, FormSchema, FormAnalytics, PollRuntimeAdapter, QuizResult, QuizQuestionResult, getContentModeDiagnostics, BaseSubmissionMetadata, DisplayRule, FormPolicy, TranslationAdapter, AsyncTranslationAdapter, TranslationReport, TranslationStatus } from '@form-engine-ts/core';
export { TranslationWorkspaceCustomDictionary } from '@form-engine-ts/core';
import { CardProps, PaperProps, AccordionProps, StackProps, TextFieldProps, SelectProps, MenuProps, CheckboxProps, RadioProps, ButtonProps, IconButtonProps, TypographyProps, ListProps, ListItemProps, LinearProgressProps, AlertProps, CardContentProps, TabsProps, TabProps } from '@mui/material';
import { SurveyResponseSummarySkipReason, SurveyResponseSummaryData, SurveyResponseSummaryLanguageOption, SurveyClientAsyncState, SurveyResponseSummaryDomainLabels, SurveyResponseSummaryQuestion, SurveyResponseSummaryDomainInputProps } from '@form-engine-ts/custom-survey-client';

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
    readonly customCatalogs?: Record<string, FormEngineMessages>;
    readonly customDictionary?: TranslationWorkspaceCustomDictionary;
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
    readonly radio?: MuiComponentSlotProps<RadioProps>;
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
    readonly radio?: MuiComponentSlotProps<RadioProps>;
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

interface MuiContentModeControls {
    readonly mode?: FieldPropertyControlMode;
    readonly resultVisibility?: FieldPropertyControlMode;
    readonly strictOneVotePerUser?: FieldPropertyControlMode;
    readonly showExplanation?: FieldPropertyControlMode;
    readonly passingScore?: FieldPropertyControlMode;
    readonly correctAnswer?: FieldPropertyControlMode;
    readonly explanation?: FieldPropertyControlMode;
    readonly points?: FieldPropertyControlMode;
}
interface MuiFormBuilderValidationIssue {
    readonly source: "schema" | "contentMode";
    readonly path: string;
    readonly code: string | ContentModeIssueCode;
    readonly message: string;
}
interface MuiFormBuilderValidationState {
    readonly mode: FormContentMode;
    readonly valid: boolean;
    readonly issues: readonly MuiFormBuilderValidationIssue[];
}
interface MuiContentModeOptions {
    readonly showSelector?: boolean;
    readonly applyPolicy?: boolean;
    readonly validation?: "summary" | "hidden";
    readonly controls?: MuiContentModeControls;
    readonly onValidationChange?: (state: MuiFormBuilderValidationState) => void;
    readonly renderValidationSummary?: (state: MuiFormBuilderValidationState) => ReactNode;
}

interface ContentModeSettingsProps {
    readonly schema: FormSchema;
    readonly onChange?: (schema: FormSchema) => void;
    readonly locale?: string;
    readonly readOnly?: boolean;
    readonly components?: Partial<FormBuilderComponents>;
    readonly translate?: (key: string) => string;
    readonly controls?: Pick<MuiContentModeControls, "resultVisibility" | "strictOneVotePerUser" | "showExplanation" | "passingScore">;
}
declare function ContentModeSettings({ schema, onChange, locale, readOnly, components, translate, controls }: ContentModeSettingsProps): react.JSX.Element | null;

declare const muiBuilderComponents: FormBuilderComponents;
declare function createMuiBuilderComponents(customOverrides?: Partial<FormBuilderComponents>): FormBuilderComponents;
declare function createMuiBuilderComponents(options?: MuiAdapterOptions, customOverrides?: Partial<FormBuilderComponents>): FormBuilderComponents;

interface MuiFormBuilderContextValue {
    readonly options: MuiAdapterOptions;
    readonly contentModeOptions?: MuiContentModeOptions;
    readonly validationState?: MuiFormBuilderValidationState;
}
declare const MuiFormBuilderContext: react.Context<MuiFormBuilderContextValue>;
declare function mergeMuiAdapterOptions(base?: MuiAdapterOptions, overrides?: MuiAdapterOptions): MuiAdapterOptions;
declare function useResolvedMuiAdapterOptions(overrides?: MuiAdapterOptions): ResolvedMuiAdapterOptions;

declare function muiDefaultIconResolver(actionType: BuilderActionIconType): ReactNode;
declare function muiDefaultFieldTypeIcon(type: QuestionType): ReactNode;

interface MuiPollResultItem {
    readonly optionId: string;
    readonly label: string;
    readonly count: number;
    readonly percentage: number;
}
interface MuiPollResultViewSlots {
    readonly header?: (analytics: FormAnalytics) => ReactNode;
    readonly option?: (item: MuiPollResultItem) => ReactNode;
}
interface MuiPollResultViewSlotProps {
    readonly root?: MuiComponentSlotProps<StackProps>;
    readonly card?: MuiComponentSlotProps<CardProps>;
    readonly title?: MuiComponentSlotProps<TypographyProps>;
    readonly list?: MuiComponentSlotProps<ListProps>;
    readonly option?: MuiComponentSlotProps<ListItemProps>;
    readonly progress?: MuiComponentSlotProps<LinearProgressProps>;
    readonly count?: MuiComponentSlotProps<TypographyProps>;
}
interface MuiPollResultViewProps {
    readonly schema: FormSchema;
    readonly analytics: FormAnalytics;
    readonly locale?: string;
    readonly slots?: MuiPollResultViewSlots;
    readonly slotProps?: MuiPollResultViewSlotProps;
    readonly i18n?: MuiFormEngineI18nOptions;
}
declare function MuiPollResultView({ schema, analytics, locale, slots, slotProps, i18n }: MuiPollResultViewProps): react.JSX.Element;
interface MuiPollResultsSlots extends MuiPollResultViewSlots {
    readonly loading?: () => ReactNode;
    readonly error?: (error: Error, reload: () => void) => ReactNode;
}
interface MuiPollResultsSlotProps extends MuiPollResultViewSlotProps {
    readonly loading?: MuiComponentSlotProps<TypographyProps>;
    readonly error?: MuiComponentSlotProps<AlertProps>;
    readonly retry?: MuiComponentSlotProps<ButtonProps>;
}
interface MuiPollResultsProps {
    readonly schema: FormSchema;
    readonly adapter: PollRuntimeAdapter<FormAnalytics>;
    readonly submitted: boolean;
    readonly alreadyVoted?: boolean;
    readonly closed: boolean;
    readonly canViewResults: boolean;
    readonly submissionRevision?: number;
    readonly locale?: string;
    readonly slots?: MuiPollResultsSlots;
    readonly slotProps?: MuiPollResultsSlotProps;
    readonly i18n?: MuiFormEngineI18nOptions;
}
declare function MuiPollResults({ schema, adapter, submitted, alreadyVoted, closed, canViewResults, submissionRevision, locale, slots, slotProps, i18n }: MuiPollResultsProps): string | number | bigint | boolean | Iterable<ReactNode> | Promise<string | number | bigint | boolean | react.ReactPortal | react.ReactElement<unknown, string | react.JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | react.JSX.Element | null;

interface QuizResultViewLabels {
    readonly totalScore: string;
    readonly passed: string;
    readonly notPassed: string;
    readonly correct: string;
    readonly incorrect: string;
    readonly correctOption: string;
}
interface QuizResultViewSlots {
    readonly score?: (result: QuizResult) => ReactNode;
    readonly status?: (passed: boolean) => ReactNode;
    readonly question?: (question: QuizQuestionResult) => ReactNode;
}
interface QuizResultViewSlotProps {
    readonly root?: MuiComponentSlotProps<StackProps>;
    readonly score?: MuiComponentSlotProps<TypographyProps>;
    readonly status?: MuiComponentSlotProps<TypographyProps>;
    readonly questionCard?: MuiComponentSlotProps<CardProps>;
    readonly questionContent?: MuiComponentSlotProps<CardContentProps>;
    readonly questionTitle?: MuiComponentSlotProps<TypographyProps>;
    readonly questionStatus?: MuiComponentSlotProps<TypographyProps>;
    readonly correctOption?: MuiComponentSlotProps<TypographyProps>;
    readonly explanation?: MuiComponentSlotProps<TypographyProps>;
    readonly points?: MuiComponentSlotProps<TypographyProps>;
}
interface QuizResultViewProps {
    readonly result: QuizResult;
    readonly locale?: string;
    readonly showScore?: boolean;
    readonly labels?: Partial<QuizResultViewLabels>;
    readonly slots?: QuizResultViewSlots;
    readonly slotProps?: QuizResultViewSlotProps;
    readonly i18n?: MuiFormEngineI18nOptions;
}
declare function QuizResultView({ result, locale, showScore, labels, slots, slotProps, i18n }: QuizResultViewProps): react.JSX.Element;

interface MuiQuizRendererOptions {
    readonly showImmediateFeedback?: boolean;
    readonly resultViewProps?: Omit<QuizResultViewProps, "result" | "locale" | "i18n">;
    readonly renderInvalid?: (issues: ReturnType<typeof getContentModeDiagnostics>) => ReactNode;
}
interface MuiPollRendererOptions {
    readonly adapter: PollRuntimeAdapter<FormAnalytics>;
    readonly closed: boolean;
    readonly canViewResults: boolean;
    readonly alreadyVoted?: boolean;
    readonly submissionRevision?: number;
    readonly slots?: MuiPollResultsSlots;
    readonly slotProps?: MuiPollResultsSlotProps;
}
interface MuiContentRendererOptions {
    readonly quiz?: MuiQuizRendererOptions;
    readonly poll?: MuiPollRendererOptions;
}
interface MuiContentRendererOwnProps {
    readonly contentModeOptions?: MuiContentRendererOptions;
    readonly muiOptions?: MuiAdapterOptions;
    readonly i18n?: MuiFormEngineI18nOptions;
    readonly classNames?: ContentRendererClassNames;
    readonly slots?: ContentRendererSlots;
}
type MuiContentRendererProps = FormRendererProps & MuiContentRendererOwnProps;
type TypedMuiContentRendererProps<TMeta extends BaseSubmissionMetadata = FormSubmissionMetadata> = TypedFormRendererProps<TMeta> & MuiContentRendererOwnProps;
declare function MuiContentRenderer(props: MuiContentRendererProps): React.JSX.Element;
declare function MuiContentRenderer<TMeta extends BaseSubmissionMetadata = FormSubmissionMetadata>(props: TypedMuiContentRendererProps<TMeta>): React.JSX.Element;

interface MuiFormBuilderProps extends Omit<FormBuilderProps, "components" | "disableDefaultStyles" | "slots" | "unstyled"> {
    readonly contentModeOptions?: MuiContentModeOptions;
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
declare function MuiFormBuilder({ muiOptions, contentModeOptions, layoutOptions, localizationOptions, localization, submissionSettingsOptions, muiSlotProps, components: customComponents, slots: customSlots, i18n, sectionOrder, policy, defaultFieldType, ...props }: MuiFormBuilderProps): react.JSX.Element;

type MuiSummaryDataAttributes = {
    readonly [key: `data-${string}`]: string | number | boolean | undefined;
};
type MuiSummaryCardProps = CardProps & MuiSummaryDataAttributes;
interface MuiSurveyResponseSummarySlots<TSkipReason = unknown> {
    readonly renderHeader?: (data: SurveyResponseSummaryData<unknown, TSkipReason>) => ReactNode;
    readonly header?: (data: SurveyResponseSummaryData<unknown, TSkipReason>) => ReactNode;
    readonly renderQuestion?: (question: SurveyResponseSummaryQuestion) => ReactNode;
    readonly question?: (question: SurveyResponseSummaryQuestion) => ReactNode;
    readonly skipReasons?: (reasons: readonly TSkipReason[]) => ReactNode;
}
interface MuiSurveyResponseSummarySlotProps {
    readonly root?: StackProps;
    readonly tabs?: TabsProps;
    readonly tab?: TabProps;
    readonly questionCard?: MuiSummaryCardProps;
    readonly questionContent?: CardContentProps;
    readonly responseCounts?: StackProps;
    readonly optionList?: ListProps;
    readonly option?: ListItemProps;
    readonly progress?: LinearProgressProps;
    readonly statistics?: StackProps;
    readonly statisticCard?: MuiSummaryCardProps;
    readonly statisticContent?: CardContentProps;
    readonly skipReasonsCard?: MuiSummaryCardProps;
    readonly skipReasonList?: ListProps;
    readonly skipReason?: ListItemProps;
}
interface MuiSurveyResponseSummaryDataProps<TCustomData = unknown, TSkipReason = SurveyResponseSummarySkipReason> {
    readonly data: SurveyResponseSummaryData<TCustomData, TSkipReason>;
    readonly languageOptions?: readonly SurveyResponseSummaryLanguageOption[];
    readonly selectedLanguage?: string | null;
    readonly onLanguageChange?: (language: string | null) => void;
    readonly summaryState?: SurveyClientAsyncState;
    readonly labels?: SurveyResponseSummaryDomainLabels;
    /** Locale used for counts, statistics, and percentages. Defaults to the active summary language. */
    readonly locale?: string;
    readonly slots?: MuiSurveyResponseSummarySlots<TSkipReason>;
    readonly slotProps?: MuiSurveyResponseSummarySlotProps;
    readonly className?: string;
}
declare function MuiSurveyResponseSummary<TCustomData = unknown, TSkipReason = SurveyResponseSummarySkipReason>(props: MuiSurveyResponseSummaryDataProps<TCustomData, TSkipReason>): React.JSX.Element;

interface MuiSurveyResponseSummaryDomainProps<TSummary, TVersion> extends Omit<SurveyResponseSummaryDomainInputProps<TSummary, TVersion>, "slots" | "variant"> {
    readonly slots?: MuiSurveyResponseSummarySlots<unknown>;
    readonly slotProps?: MuiSurveyResponseSummarySlotProps;
}
declare function MuiSurveyResponseSummaryDomain<TSummary, TVersion>(props: MuiSurveyResponseSummaryDomainProps<TSummary, TVersion>): React.JSX.Element;

declare function QuizOptionEditor({ schema, field, option, onChange, currentLocale, readOnly, translate }: BuilderOptionEditorSlotProps): react.JSX.Element;
declare function QuizFieldEditor({ schema, field, onChange, currentLocale, readOnly, components, translate }: BuilderFieldEditorSlotProps): react.JSX.Element;

interface ConditionEditorProps {
    readonly schema: FormSchema;
    readonly fieldId: string;
    readonly value?: DisplayRule;
    readonly onChange: (rule: DisplayRule | undefined) => void;
    readonly readOnly?: boolean;
}
declare function ConditionEditor({ schema, fieldId, value, onChange, readOnly }: ConditionEditorProps): react.JSX.Element;

declare function createMuiContentModeSettingsSlot(options?: MuiAdapterOptions): NonNullable<FormBuilderSlots["basicSettingsAfter"]>;
declare const MuiContentModeSettingsSlot: NonNullable<FormBuilderSlots["basicSettingsAfter"]>;

declare function createMuiFieldEditorSlot(options?: MuiAdapterOptions): ComponentType<BuilderFieldEditorSlotProps>;
declare const MuiFieldEditorSlot: NonNullable<FormBuilderSlots["fieldEditor"]>;

declare function createMuiLocalizationSlot(options?: MuiAdapterOptions): ComponentType<BuilderLocalizationSlotProps>;
declare const MuiLocalizationSlot: NonNullable<FormBuilderSlots["localization"]>;

declare function MuiChoiceGroupSlot({ field, title, description, required, error, disabled, children, className, quizResult }: ChoiceGroupSlotProps): react.JSX.Element;

declare function createMuiOptionEditorSlot(options?: MuiAdapterOptions): ComponentType<BuilderOptionEditorSlotProps>;
declare const MuiOptionEditorSlot: NonNullable<FormBuilderSlots["optionEditor"]>;

interface MuiPagesEditorProps extends BuilderPagesSlotProps {
}
declare function createMuiPagesEditorSlot(options?: MuiAdapterOptions): ComponentType<MuiPagesEditorProps>;
declare const MuiPagesEditor: ComponentType<MuiPagesEditorProps>;
declare const MuiPagesEditorSlot: ComponentType<MuiPagesEditorProps>;

declare function createMuiToolbarSlot(options?: MuiAdapterOptions): ComponentType<BuilderToolbarSlotProps>;
declare const MuiToolbarSlot: NonNullable<FormBuilderSlots["toolbar"]>;

declare const muiBuilderSlots: FormBuilderSlots;
declare function createMuiBuilderSlots(options?: MuiAdapterOptions, customOverrides?: Partial<FormBuilderSlots>): FormBuilderSlots;

type TargetLocaleOption = string | LocaleOption;
interface AddLocaleDropdownProps {
    readonly availableLocales: readonly TargetLocaleOption[];
    readonly existingLocales?: readonly string[];
    readonly value?: string;
    readonly disabled?: boolean;
    readonly label?: string;
    readonly icon?: ReactNode;
    readonly getLocaleDisplayName?: (locale: string) => string;
    readonly onAdd: (locale: string) => void;
}
declare function AddLocaleDropdown({ availableLocales, existingLocales, value, disabled, label, icon, getLocaleDisplayName, onAdd }: AddLocaleDropdownProps): react.JSX.Element;
interface TargetLocaleToolbarProps {
    readonly supportedLocales: readonly TargetLocaleOption[];
    readonly currentLocale: string;
    readonly availableLocales: readonly TargetLocaleOption[];
    readonly onSelectLocale: (locale: string) => void;
    readonly onAddLocale: (locale: string) => void;
    readonly onRemoveLocale: (locale: string) => void;
    readonly disabled?: boolean;
    readonly selectionLabel?: string;
    readonly addLabel?: string;
    readonly removeLabel?: string;
    readonly addIcon?: ReactNode;
    readonly removeIcon?: ReactNode;
    readonly getLocaleDisplayName?: (locale: string) => string;
}
interface TranslationLocaleActionProps {
    readonly action: "add" | "remove";
    readonly label: string;
    readonly icon: ReactNode;
    readonly disabled: boolean;
    readonly onClick: () => void;
}
interface TranslationLocaleActionsProps {
    readonly add: TranslationLocaleActionProps;
    readonly remove: TranslationLocaleActionProps;
}
declare function TargetLocaleHeaderToolbar({ supportedLocales, currentLocale, availableLocales, onSelectLocale, onAddLocale, onRemoveLocale, disabled, selectionLabel, addLabel, removeLabel, addIcon, removeIcon, getLocaleDisplayName }: TargetLocaleToolbarProps): react.JSX.Element;
declare const TargetLocaleSelector: typeof TargetLocaleHeaderToolbar;

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
    readonly addIcon?: ReactNode;
    readonly removeIcon?: ReactNode;
    readonly renderLocaleActions?: (props: TranslationLocaleActionsProps) => ReactNode;
    readonly renderItemIcon?: (props: TranslationComparisonItemIconProps) => ReactNode;
    readonly getTranslationSlotIcon?: (props: TranslationComparisonItemIconProps) => ReactNode;
    readonly appearance?: TranslationComparisonAppearance;
    readonly i18n?: MuiFormEngineI18nOptions;
    readonly slots?: {
        readonly renderHeader?: (props: TranslationComparisonHeaderProps) => ReactNode;
        readonly renderTargetLocaleSelector?: (props: TranslationComparisonLocaleSelectorProps) => ReactNode;
        readonly renderLocaleActions?: (props: TranslationLocaleActionsProps) => ReactNode;
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

export { AddLocaleDropdown, type AddLocaleDropdownProps, type BuilderSectionName, ConditionEditor, type ConditionEditorProps, ContentModeSettings, type ContentModeSettingsProps, DEFAULT_MUI_SECTION_ORDER, type LocaleOptionItem, type LocalizationSectionPlacement, MUI_LOCALIZATION_SECTION_ORDERS, type MuiAdapterOptions, type MuiBuilderOverrides, type MuiBuilderSlotProps, MuiButtonAdapter, type MuiButtonVariant, MuiCheckboxAdapter, MuiChoiceGroupSlot, type MuiComponentSlotProps, type MuiContentModeControls, type MuiContentModeOptions, MuiContentModeSettingsSlot, MuiContentRenderer, type MuiContentRendererOptions, type MuiContentRendererProps, MuiErrorMessageAdapter, type MuiFieldEditorOptions, MuiFieldEditorSlot, MuiFieldsetAdapter, MuiFormBuilder, MuiFormBuilderContext, type MuiFormBuilderContextValue, type MuiFormBuilderProps, type MuiFormBuilderValidationIssue, type MuiFormBuilderValidationState, type MuiFormEngineI18nOptions, MuiIconButtonAdapter, type MuiLayoutOptions, type MuiLocaleOption, type MuiLocalizationOptions, MuiLocalizationSlot, type MuiLocalizationSlotOptions, MuiOptionEditorSlot, MuiPagesEditor, type MuiPagesEditorProps, MuiPagesEditorSlot, type MuiPollRendererOptions, type MuiPollResultItem, MuiPollResultView, type MuiPollResultViewProps, type MuiPollResultViewSlotProps, type MuiPollResultViewSlots, MuiPollResults, type MuiPollResultsProps, type MuiPollResultsSlotProps, type MuiPollResultsSlots, type MuiQuizRendererOptions, MuiSectionAdapter, MuiSelectAdapter, type MuiSlotProps, type MuiSubmissionSettingsOptions, MuiSurveyResponseSummary, type MuiSurveyResponseSummaryDataProps, MuiSurveyResponseSummaryDomain, type MuiSurveyResponseSummaryDomainProps, type MuiSurveyResponseSummarySlotProps, type MuiSurveyResponseSummarySlots, MuiTextAreaAdapter, MuiTextInputAdapter, MuiToolbarSlot, QuizFieldEditor, QuizOptionEditor, QuizResultView, type QuizResultViewLabels, type QuizResultViewProps, type QuizResultViewSlotProps, type QuizResultViewSlots, type ResolvedMuiAdapterOptions, TargetLocaleHeaderToolbar, type TargetLocaleOption, TargetLocaleSelector, type TargetLocaleToolbarProps, TranslationComparisonWorkspace, type TranslationComparisonWorkspaceProps, type TranslationLocaleActionProps, type TranslationLocaleActionsProps, TranslationWorkspace, type TranslationWorkspaceProps, type TypedMuiContentRendererProps, createMuiBuilderComponents, createMuiBuilderProps, createMuiBuilderSlots, createMuiButtonAdapter, createMuiCheckboxAdapter, createMuiContentModeSettingsSlot, createMuiErrorMessageAdapter, createMuiFieldEditorSlot, createMuiFieldsetAdapter, createMuiIconButtonAdapter, createMuiLocalizationSlot, createMuiOptionEditorSlot, createMuiPagesEditorSlot, createMuiSectionAdapter, createMuiSelectAdapter, createMuiTextAreaAdapter, createMuiTextInputAdapter, createMuiToolbarSlot, mergeMuiAdapterOptions, muiBuilderComponents, muiBuilderSlots, muiDefaultFieldTypeIcon, muiDefaultIconResolver, resolveMuiAdapterOptions, useResolvedMuiAdapterOptions };
