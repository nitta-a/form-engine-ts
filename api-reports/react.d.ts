import { QuestionType, FormField, ChoiceOption, FormPage, FormSchema, DisplayCondition, JsonValue, SchemaIssue, FormPolicy, Question, FieldOption, TranslationReport, ValidationIssue, ValidationError, FormValues, TranslationAdapter, AsyncTranslationAdapter, PopulateTranslationOptions, FormValue, AnswerValidationResult, TranslationSlot, FieldType } from '@form-engine-ts/core';
export { QuestionType } from '@form-engine-ts/core';
import * as react from 'react';
import { ReactNode, ComponentType, KeyboardEvent, MouseEvent, CSSProperties } from 'react';
import { SensitiveDataFinding } from '@form-engine-ts/privacy';

interface SubmissionAttempt {
    readonly attemptId: string;
    readonly formId: string;
    readonly formVersion: number;
    readonly createdAt: string;
}
interface SubmissionAttemptStore {
    getOrCreate(formId: string, formVersion: number, idFactory?: () => string): Promise<SubmissionAttempt>;
    get(formId: string, formVersion: number): Promise<SubmissionAttempt | null>;
    clear(formId: string, formVersion: number): Promise<void>;
}
declare function createLocalStorageSubmissionAttemptStore(options?: {
    readonly namespace?: string;
}): SubmissionAttemptStore;

/** @deprecated Import FormPolicy from @form-engine-ts/core instead. */
type BuilderPolicy = FormPolicy;
type BuilderIdKind = "field" | "option" | "page";
interface BuilderFactories {
    readonly createField?: (type: QuestionType, id: string) => FormField;
    readonly createOption?: (field: FormField, id: string) => ChoiceOption;
    readonly createPage?: (id: string, questionIds: string[]) => FormPage;
}
interface BuilderTextTarget {
    readonly kind: "form" | "page" | "field" | "option";
    readonly id?: string;
}
interface FormBuilderOptions {
    readonly schema: FormSchema;
    readonly onChange: (schema: FormSchema) => void;
    readonly policy?: FormPolicy;
    readonly idFactory?: (kind: BuilderIdKind, existingIds: ReadonlySet<string>) => string;
    readonly factories?: BuilderFactories;
    readonly fieldEditorMode?: FieldEditorMode;
    readonly activeFieldId?: string;
    readonly defaultActiveFieldId?: string;
    readonly onActiveFieldChange?: (fieldId: string | undefined) => void;
}
type FieldEditorMode = "all" | "single";
type UseFormBuilderOptions = FormBuilderOptions;
type BuilderActionError = {
    readonly type: "invalid_id";
    readonly kind: BuilderIdKind;
    readonly id: string;
} | {
    readonly type: "max_fields_exceeded";
    readonly max: number;
} | {
    readonly type: "max_options_exceeded";
    readonly max: number;
} | {
    readonly type: "max_text_length_exceeded";
    readonly max: number;
} | {
    readonly type: "disallowed_field_type";
    readonly fieldType: QuestionType;
} | {
    readonly type: "disallowed_locale";
    readonly locale: string;
} | {
    readonly type: "max_locales_exceeded";
    readonly max: number;
} | {
    readonly type: "field_constraint_immutable";
} | {
    readonly type: "field_constraint_violation";
    readonly property: string;
    readonly expected: number;
} | {
    readonly type: "node_not_found";
    readonly kind: BuilderTextTarget["kind"];
    readonly id: string;
} | {
    readonly type: "invalid_operation";
    readonly message: string;
};
type BuilderActionResult = {
    readonly success: true;
} | {
    readonly success: false;
    readonly error: BuilderActionError;
};
interface FormBuilderResult {
    readonly schema: FormSchema;
    readonly addField: (type: QuestionType, pageId?: string) => BuilderActionResult;
    readonly removeField: (fieldId: string) => BuilderActionResult;
    readonly moveField: (fieldId: string, targetIndex: number) => BuilderActionResult;
    readonly updateField: (fieldId: string, updater: (field: FormField) => FormField) => BuilderActionResult;
    readonly changeFieldType: (fieldId: string, type: QuestionType) => BuilderActionResult;
    readonly addOption: (fieldId: string) => BuilderActionResult;
    readonly updateOption: (fieldId: string, optionId: string, updater: (option: ChoiceOption) => ChoiceOption) => BuilderActionResult;
    readonly removeOption: (fieldId: string, optionId: string) => BuilderActionResult;
    readonly moveOption: (fieldId: string, optionId: string, targetIndex: number) => BuilderActionResult;
    readonly addPage: (questionId?: string) => BuilderActionResult;
    readonly updatePage: (pageId: string, updater: (page: FormPage) => FormPage) => BuilderActionResult;
    readonly removePage: (pageId: string) => BuilderActionResult;
    readonly movePage: (pageId: string, targetIndex: number) => BuilderActionResult;
    readonly assignFieldToPage: (fieldId: string, pageId: string | null) => BuilderActionResult;
    readonly setDisplayCondition: (fieldId: string, condition?: DisplayCondition) => BuilderActionResult;
    readonly setSourceText: (target: BuilderTextTarget, property: string, text: string) => BuilderActionResult;
    readonly setLocaleTranslation: (locale: string, target: BuilderTextTarget, property: string, text: string, options?: {
        readonly metadata?: Readonly<Record<string, JsonValue>>;
    }) => BuilderActionResult;
    readonly addLocale: (locale: string) => BuilderActionResult;
    readonly setDefaultLocale: (locale: string) => BuilderActionResult;
    readonly validationIssues: readonly SchemaIssue[];
    readonly activeFieldId?: string;
    readonly setActiveFieldId?: (fieldId: string | undefined) => void;
    readonly getFieldEditorProps?: (fieldId: string) => {
        readonly isActive: boolean;
        readonly isVisible: boolean;
        readonly onSelect: () => void;
    };
}
interface UseFormBuilderResult extends FormBuilderResult {
    readonly setActiveFieldId: (fieldId: string | undefined) => void;
    readonly getFieldEditorProps: NonNullable<FormBuilderResult["getFieldEditorProps"]>;
}
declare function useFormBuilder({ schema, onChange, policy, idFactory, factories, fieldEditorMode, activeFieldId: controlledActiveFieldId, defaultActiveFieldId, onActiveFieldChange }: FormBuilderOptions): FormBuilderResult;

interface SubmissionReceipt {
    readonly formId: string;
    readonly formVersion: number;
    readonly submissionId?: string;
    readonly submittedAt: string;
}
interface SubmissionReceiptQuery {
    readonly formId: string;
    readonly formVersion: number;
}
interface SubmissionReceiptStore {
    get(formId: string, formVersion: number): Promise<SubmissionReceipt | null>;
    getBatch?(queries: readonly SubmissionReceiptQuery[]): Promise<Map<string, SubmissionReceipt>>;
    save(receipt: SubmissionReceipt): Promise<void>;
    remove(formId: string, formVersion: number): Promise<void>;
}
interface UseSubmissionReceiptsResult {
    readonly receipts: ReadonlyMap<string, SubmissionReceipt>;
    readonly isLoading: boolean;
    readonly error: Error | null;
}
declare function submissionReceiptQueryKey(formId: string, formVersion: number): string;
declare function createLocalStorageSubmissionReceiptStore(options?: {
    readonly namespace?: string;
}): SubmissionReceiptStore;
declare function useSubmissionReceipts(store: SubmissionReceiptStore, queries: readonly SubmissionReceiptQuery[]): UseSubmissionReceiptsResult;

interface ComponentBaseProps {
    readonly id?: string;
    readonly className?: string | undefined;
    readonly disabled?: boolean;
    readonly readOnly?: boolean;
    readonly "aria-label"?: string | undefined;
    readonly "aria-describedby"?: string | undefined;
    readonly "aria-labelledby"?: string | undefined;
}
type BuilderActionIconType = "moveUp" | "moveDown" | "delete" | "add" | "edit" | "settings" | "translate" | "close" | "dragHandle";
interface BuilderButtonProps extends ComponentBaseProps {
    readonly onClick?: () => void;
    readonly noWrap?: boolean;
    readonly variant?: "primary" | "secondary" | "danger";
    readonly children: ReactNode;
    readonly title?: string;
    readonly action?: string;
    readonly targetId?: string;
}
interface IconButtonProps extends ComponentBaseProps {
    readonly onClick?: () => void;
    readonly icon?: string | ReactNode;
    readonly actionType?: BuilderActionIconType;
    readonly title?: string;
}
interface BuilderIconButtonProps extends ComponentBaseProps {
    readonly onClick?: () => void;
    readonly icon?: string | ReactNode;
    readonly actionType?: BuilderActionIconType;
    readonly title?: string;
}
interface InputComponentProps extends ComponentBaseProps {
    readonly name?: string;
    readonly label?: string;
    readonly required?: boolean;
    readonly error?: boolean;
    readonly helperText?: string;
    readonly value: string;
    readonly onChange: (value: string) => void;
    readonly onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
    readonly placeholder?: string;
    readonly maxLength?: number;
}
interface BuilderTextInputProps extends InputComponentProps {
    readonly inputMode?: "text" | "numeric";
    readonly type?: "text" | "number";
    readonly min?: number;
    readonly max?: number;
    readonly step?: number;
}
interface BuilderTextAreaProps extends InputComponentProps {
    readonly rows?: number;
}
interface BuilderSelectOption<T extends string = string> {
    readonly label: string;
    readonly value: T;
    readonly icon?: ReactNode;
    readonly description?: string;
    readonly disabled?: boolean;
    readonly group?: string;
    readonly groupLabel?: string;
    readonly kind?: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
}
type FieldPropertyControlMode = "editable" | "readOnly" | "hidden";
interface FieldEditorControlsConfig {
    readonly title?: FieldPropertyControlMode;
    readonly description?: FieldPropertyControlMode;
    readonly required?: FieldPropertyControlMode;
    readonly typeSelect?: FieldPropertyControlMode;
    readonly options?: FieldPropertyControlMode;
    readonly displayConditions?: FieldPropertyControlMode;
    readonly textLimits?: FieldPropertyControlMode;
    readonly ratingBounds?: FieldPropertyControlMode;
    readonly numberLimits?: FieldPropertyControlMode;
}
interface FieldTypeSelectOptionsContext {
    readonly currentType: QuestionType;
    readonly allowedTypes: readonly QuestionType[];
}
type FieldTypeSelectOptionsTransformer = (options: readonly BuilderSelectOption<QuestionType>[], context: FieldTypeSelectOptionsContext) => readonly BuilderSelectOption<QuestionType>[];
type FieldTypeSelectOptionsSorter = (left: BuilderSelectOption<QuestionType>, right: BuilderSelectOption<QuestionType>, context: FieldTypeSelectOptionsContext) => number;
interface FieldTypeSelectOptionsConfig {
    /** Transform the generated choices. The returned array is used as-is. */
    readonly transform?: FieldTypeSelectOptionsTransformer;
    /** Sort generated choices after transform. The source array is never mutated. */
    readonly sort?: FieldTypeSelectOptionsSorter;
    /** Optional explicit order applied before `sort`. */
    readonly order?: readonly QuestionType[];
}
interface SelectComponentProps<T extends string = string> extends Omit<InputComponentProps, "value" | "onChange"> {
    readonly value: T;
    readonly onChange: (value: T) => void;
    readonly options: readonly (T | BuilderSelectOption<T>)[];
    readonly renderOption?: (option: BuilderSelectOption<T>) => ReactNode;
    readonly renderValue?: (option: BuilderSelectOption<T> | undefined) => ReactNode;
}
type BuilderSelectProps<T extends string = string> = SelectComponentProps<T>;
interface BuilderCheckboxProps extends ComponentBaseProps {
    readonly name?: string;
    readonly required?: boolean;
    readonly error?: boolean;
    readonly helperText?: string;
    readonly checked: boolean;
    readonly onChange: (checked: boolean) => void;
    readonly label: string;
}
interface BuilderSectionProps {
    readonly id?: string;
    readonly className?: string | undefined;
    readonly title?: string;
    readonly description?: string;
    readonly headingId?: string;
    readonly "aria-label"?: string;
    readonly onClickCapture?: (event: MouseEvent<HTMLElement>) => void;
    readonly children: ReactNode;
}
interface BuilderFieldsetProps {
    readonly className?: string | undefined;
    readonly legend?: string;
    readonly disabled?: boolean;
    readonly children: ReactNode;
}
interface BuilderErrorMessageProps extends ComponentBaseProps {
    readonly message: string;
}
interface FormBuilderComponents {
    readonly Button?: ComponentType<BuilderButtonProps>;
    readonly IconButton?: ComponentType<BuilderIconButtonProps>;
    readonly TextInput?: ComponentType<BuilderTextInputProps>;
    readonly TextArea?: ComponentType<BuilderTextAreaProps>;
    readonly Select?: ComponentType<BuilderSelectProps>;
    readonly Checkbox?: ComponentType<BuilderCheckboxProps>;
    readonly Section?: ComponentType<BuilderSectionProps>;
    readonly Fieldset?: ComponentType<BuilderFieldsetProps>;
    readonly ErrorMessage?: ComponentType<{
        readonly message: string;
    }>;
    readonly renderIcon?: (actionType: BuilderActionIconType) => ReactNode;
    readonly renderFieldTypeIcon?: (type: QuestionType) => ReactNode;
}
type FormBuilderActions = Omit<FormBuilderResult, "schema" | "validationIssues">;
interface ManualTranslationTarget {
    readonly kind: "form" | "page" | "field" | "option";
    readonly id?: string;
}
interface BuilderSlotActions extends FormBuilderActions {
    readonly setManualTranslation: (locale: string, target: ManualTranslationTarget, property: "title" | "description" | "label" | "completionMessage", text: string) => BuilderActionResult;
}
interface BuilderSlotBaseProps {
    readonly schema: FormSchema;
    readonly readOnly: boolean;
    readonly actions: BuilderSlotActions;
    readonly components: Required<FormBuilderComponents>;
    readonly translate: (key: string, params?: Record<string, unknown>) => string;
}
interface BuilderToolbarSlotProps extends BuilderSlotBaseProps {
    readonly kind: "page" | "field" | "option";
    readonly targetId: string;
    readonly index: number;
    readonly total: number;
    readonly title: string;
    readonly onMoveUp: () => void;
    readonly onMoveDown: () => void;
    readonly onRemove: () => void;
}
interface BuilderFieldEditorSlotProps extends BuilderSlotBaseProps {
    readonly field: FormField;
    readonly index: number;
    readonly currentLocale: string;
    readonly policy?: FormPolicy;
    readonly features?: {
        readonly pages?: boolean;
        readonly localization?: boolean;
        readonly conditions?: boolean;
    };
    readonly fieldEditorControls?: FieldEditorControlsConfig;
    readonly fieldTypeOptions?: FieldTypeSelectOptionsConfig;
    readonly slots?: Pick<FormBuilderSlots, "fieldTypeSelect" | "fieldEditorHeader">;
}
interface FieldTypeSelectSlotProps {
    readonly id?: string;
    readonly name?: string;
    readonly label?: string;
    readonly currentType: QuestionType;
    readonly allowedTypes: readonly QuestionType[];
    readonly options: readonly BuilderSelectOption<QuestionType>[];
    readonly onChangeType: (nextType: QuestionType) => void;
    readonly disabled?: boolean;
    readonly readOnly?: boolean;
    readonly required?: boolean;
    readonly error?: boolean;
    readonly helperText?: string;
    readonly "aria-describedby"?: string;
    readonly "aria-labelledby"?: string;
    readonly renderIcon?: (type: QuestionType) => ReactNode;
}
interface FieldEditorHeaderSlotProps {
    readonly field: Question;
    readonly index: number;
    readonly totalFields: number;
    readonly actions: FormBuilderActions;
}
interface BuilderOptionEditorSlotProps extends BuilderSlotBaseProps {
    readonly field: FormField & {
        readonly options: readonly FieldOption[];
    };
    readonly option: FieldOption;
    readonly index: number;
    readonly currentLocale: string;
}
interface BuilderPagesSlotProps extends BuilderSlotBaseProps {
    readonly currentLocale: string;
    readonly features?: {
        readonly pages?: boolean;
        readonly localization?: boolean;
        readonly conditions?: boolean;
    };
}
interface BuilderLocalizationSlotProps extends BuilderSlotBaseProps {
    readonly currentLocale: string;
    readonly onCurrentLocaleChange: (locale: string) => void;
    readonly onAutoTranslate: () => void;
    readonly isTranslating: boolean;
    readonly translationError?: string;
    readonly policy?: FormPolicy;
    readonly translationAdapterAvailable?: boolean;
}
interface LocalizationSummaryContext {
    readonly defaultLocale: string;
    readonly supportedLocales: readonly string[];
    readonly totalLocales: number;
}
interface BuilderTranslationActionsSlotProps extends BuilderSlotBaseProps {
    readonly currentLocale: string;
    readonly onAutoTranslate: () => void;
    readonly isTranslating: boolean;
    readonly translationError?: string;
    readonly translationReport?: TranslationReport;
    readonly onClearTranslationError?: () => void;
    readonly translationAdapterAvailable?: boolean;
}
type FormBuilderSectionName = "basicSettings" | "completionMessage" | "questions" | "addQuestion" | "localization" | "submissionSettings";
interface FormBuilderSubmissionSettingsOptions {
    readonly enabled: boolean;
    readonly placement?: "beforeQuestions" | "afterQuestions" | "bottom";
}
interface FormBuilderSlots {
    readonly toolbar?: ComponentType<BuilderToolbarSlotProps>;
    readonly fieldEditor?: ComponentType<BuilderFieldEditorSlotProps>;
    readonly fieldTypeSelect?: ComponentType<FieldTypeSelectSlotProps>;
    readonly fieldEditorHeader?: ComponentType<FieldEditorHeaderSlotProps>;
    readonly optionEditor?: ComponentType<BuilderOptionEditorSlotProps>;
    readonly pages?: ComponentType<BuilderPagesSlotProps>;
    readonly localization?: ComponentType<BuilderLocalizationSlotProps>;
    readonly translationActions?: ComponentType<BuilderTranslationActionsSlotProps>;
    readonly sectionOrder?: readonly FormBuilderSectionName[];
}
interface BuilderActionContext {
    readonly action: "addField" | "removeField" | "moveField" | "changeFieldType" | "updateField" | "addOption" | "removeOption" | "moveOption" | "updateOption" | "addPage" | "removePage" | "movePage" | "updatePage" | "assignFieldToPage" | "addLocale" | "setDefaultLocale" | "setDisplayCondition" | "setSourceText" | "setLocaleTranslation" | "setManualTranslation";
    readonly targetId?: string;
    readonly params?: Record<string, unknown>;
}
interface ManualTranslationContext {
    readonly locale: string;
    readonly kind: "form" | "page" | "field" | "option";
    readonly nodeId: string;
    readonly property: "title" | "description" | "label" | "completionMessage";
    readonly sourceText: string;
    readonly translatedText: string;
    readonly existingTranslationMetadata?: Readonly<Record<string, JsonValue>>;
}
type SubmitResult = {
    readonly status: "invalid";
    readonly issues: readonly ValidationError[];
} | {
    readonly status: "cancelled";
} | {
    readonly status: "success";
    readonly response?: SubmitResponse;
} | {
    readonly status: "error";
    readonly error: Error;
};
interface SubmitResponse {
    readonly submissionId?: string;
    readonly submittedAt?: string;
}
interface SubmitContext {
    readonly attemptId: string;
    readonly formId: string;
    readonly formVersion: number;
    readonly locale?: string;
    readonly submittedAt: string;
}
interface FormRendererMessages {
    readonly submitButton?: string;
    readonly submittingButton?: string;
    readonly retryButton?: string;
    readonly requiredField?: string;
    readonly alreadySubmittedTitle?: string;
    readonly alreadySubmittedMessage?: string;
    readonly serverErrorSummary?: string;
    readonly confirmSensitiveDataTitle?: string;
    readonly confirmSensitiveDataMessage?: string;
    readonly confirmButton?: string;
    readonly cancelButton?: string;
}
interface FormSubmittedAnswerItem {
    readonly fieldId: string;
    readonly title: string;
    readonly type: QuestionType;
    readonly rawValue: unknown;
    readonly displayValue: string;
    readonly visible: boolean;
    readonly metadata?: Readonly<Record<string, JsonValue>>;
}
interface FormCompletionSlotProps {
    readonly message?: string;
    readonly schema: FormSchema;
    readonly answers: Readonly<Record<string, unknown>>;
    readonly submittedItems: readonly FormSubmittedAnswerItem[];
    readonly response?: SubmitResponse;
    readonly onReset?: () => void;
}
interface FormServerErrorPayload {
    readonly fieldErrors?: Readonly<Record<string, string>>;
    readonly formError?: string;
}
declare class FormSubmissionError extends Error {
    readonly payload: FormServerErrorPayload;
    constructor(message: string, payload?: FormServerErrorPayload);
}
type FormSubmitHandler = (answers: FormValues, context: SubmitContext) => SubmitResponse | void | Promise<SubmitResponse | undefined> | Promise<void>;
type SubmissionGuardResult = {
    readonly status: "allow";
} | {
    readonly status: "confirm";
    readonly findings: readonly SensitiveDataFinding[];
    readonly message?: string;
} | {
    readonly status: "block";
    readonly findings: readonly SensitiveDataFinding[];
    readonly message?: string;
};
type SubmissionGuard = (schema: FormSchema, values: Record<string, unknown>) => SubmissionGuardResult | Promise<SubmissionGuardResult>;
type FormSuccessRenderMode = "append" | "replace";
type ChoiceFieldLayoutMode = "default" | "grouped";
interface ChoiceFieldTypeLayoutMap {
    readonly radio?: ChoiceFieldLayoutMode;
    readonly checkbox?: ChoiceFieldLayoutMode;
    readonly "multi-select"?: ChoiceFieldLayoutMode;
    readonly select?: ChoiceFieldLayoutMode;
}
type FieldError = ValidationIssue & {
    readonly message: string;
};
interface FormRendererAppearance {
    /**
     * Layout preset for choice questions (radio, checkbox, and multi-select).
     * - "default": keep the flat question layout.
     * - "grouped": render a bordered fieldset and legend.
     * - An object can configure each choice question type independently.
     */
    readonly choiceField?: ChoiceFieldLayoutMode | ChoiceFieldTypeLayoutMap;
}
type SubmissionConfirmationRenderMode = "inline" | "replace" | "dialog";
interface SubmissionConfirmationOptions {
    readonly enabled?: boolean;
    readonly renderMode?: SubmissionConfirmationRenderMode;
}
type FormSubmitStatus = "idle" | "submitting" | "confirming" | "success" | "error";
/** @deprecated Use FormSubmitStatus instead. */
type FormSubmitState = "idle" | "submitting" | "confirming" | "success" | "error";
interface RenderSubmitButtonProps {
    readonly isSubmitting: boolean;
    readonly submitStatus: FormSubmitStatus;
    readonly disabled: boolean;
    readonly onSubmit: () => void;
}
interface SubmissionConfirmationSlotProps {
    readonly findings?: readonly SensitiveDataFinding[];
    readonly message?: string;
    readonly schema: FormSchema;
    readonly visibleValues: Record<string, unknown>;
    readonly visibleItems?: readonly FormSubmittedAnswerItem[];
    readonly onConfirm: () => void;
    readonly onCancel: () => void;
}
interface FormFieldsSlotProps {
    readonly children: ReactNode;
    readonly className?: string;
}
interface ChoiceGroupSlotProps {
    readonly field: Question;
    readonly title: string;
    readonly description?: string;
    readonly required?: boolean;
    readonly error?: FieldError;
    readonly disabled?: boolean;
    readonly readOnly?: boolean;
    readonly children: ReactNode;
    readonly className?: string;
}
interface FormRendererSlotProps {
    readonly choiceGroup?: {
        readonly className?: string;
        readonly style?: CSSProperties;
    };
}
interface FormRendererSlots {
    readonly renderHeader?: (props: {
        readonly title: string;
        readonly description?: string;
    }) => ReactNode;
    readonly renderPageHeader?: (props: {
        readonly page: FormPage;
        readonly pageIndex: number;
        readonly totalPages: number;
    }) => ReactNode;
    readonly renderField?: (props: {
        readonly question: FormField;
        readonly value: unknown;
        readonly onChange: (value: unknown) => void;
        readonly error?: ValidationError;
    }) => ReactNode;
    readonly renderNavigation?: (props: {
        readonly currentPage: number;
        readonly totalPages: number;
        readonly canPrev: boolean;
        readonly canNext: boolean;
        readonly onPrev: () => void;
        readonly onNext: () => void;
    }) => ReactNode;
    readonly renderSubmitButton?: (props: RenderSubmitButtonProps) => ReactNode;
    readonly renderValidationSummary?: (props: {
        readonly issues: readonly ValidationError[];
    }) => ReactNode;
    readonly renderCompletion?: (props: FormCompletionSlotProps & {
        readonly message: string;
    }) => ReactNode;
    readonly renderSubmittedValues?: (props: {
        readonly items: readonly FormSubmittedAnswerItem[];
        readonly schema: FormSchema;
    }) => ReactNode;
    readonly renderFields?: (props: FormFieldsSlotProps) => ReactNode;
    readonly renderSubmitError?: (props: {
        readonly error: Error;
        readonly onRetry?: () => void;
    }) => ReactNode;
    readonly renderSubmissionConfirmation?: (props: SubmissionConfirmationSlotProps) => ReactNode;
    readonly renderAlreadySubmitted?: (props: {
        readonly receipt: SubmissionReceipt;
        readonly onReset?: () => void;
    }) => ReactNode;
    readonly renderCharacterCount?: (props: {
        readonly fieldId: string;
        readonly current: number;
        readonly max: number;
    }) => ReactNode;
    readonly renderChoiceGroup?: (props: ChoiceGroupSlotProps) => ReactNode;
}
interface SubmissionProtectionProps {
    readonly submissionGuards?: readonly SubmissionGuard[];
    readonly receiptStore?: SubmissionReceiptStore;
    readonly attemptStore?: SubmissionAttemptStore;
    readonly onReceiptError?: (error: Error, receipt: SubmissionReceipt) => void;
}
type BeforeSubmit = (values: Readonly<Record<string, unknown>>) => "continue" | "cancel" | Promise<"continue" | "cancel">;

declare function resolveFieldEditorControls(config?: FieldEditorControlsConfig): Required<FieldEditorControlsConfig>;
declare function resolveFieldTypeSelectOptions(options: readonly BuilderSelectOption<QuestionType>[], config: FieldTypeSelectOptionsConfig | undefined, context: FieldTypeSelectOptionsContext): readonly BuilderSelectOption<QuestionType>[];
declare function resolveInitialFieldType(defaultType?: QuestionType, allowedTypes?: readonly QuestionType[]): QuestionType | null;
interface FormBuilderFeatures {
    readonly pages?: boolean;
    readonly localization?: boolean;
    readonly conditions?: boolean;
}
interface FormBuilderProps {
    readonly schema: FormSchema;
    readonly onChange: (newSchema: FormSchema) => void;
    readonly locale?: string;
    readonly translator?: TranslationAdapter;
    readonly translationAdapter?: AsyncTranslationAdapter;
    readonly translationOptions?: PopulateTranslationOptions;
    readonly onTranslationReport?: (report: TranslationReport) => void;
    readonly policy?: FormPolicy;
    readonly idFactory?: (kind: "field" | "option" | "page", existingIds: ReadonlySet<string>) => string;
    readonly factories?: BuilderFactories;
    readonly className?: string;
    readonly defaultFieldType?: QuestionType;
    readonly onActionError?: (error: BuilderActionError, context: BuilderActionContext) => void;
    readonly createManualTranslationMetadata?: (context: ManualTranslationContext) => Readonly<Record<string, JsonValue>> | undefined;
    readonly readOnly?: boolean;
    readonly features?: FormBuilderFeatures;
    readonly fieldEditorControls?: FieldEditorControlsConfig;
    readonly fieldTypeOptions?: FieldTypeSelectOptionsConfig;
    readonly components?: FormBuilderComponents;
    readonly slots?: FormBuilderSlots;
    readonly sectionOrder?: readonly FormBuilderSectionName[];
    readonly disableDefaultStyles?: boolean;
    readonly unstyled?: boolean;
    readonly fieldEditorMode?: "all" | "single";
    readonly activeFieldId?: string;
    readonly defaultActiveFieldId?: string;
    readonly onActiveFieldChange?: (fieldId: string | undefined) => void;
    readonly submissionSettingsOptions?: FormBuilderSubmissionSettingsOptions;
}
declare function FormBuilder({ schema, onChange, locale, translator, translationAdapter, translationOptions, onTranslationReport, policy, idFactory, factories, className, defaultFieldType, onActionError, createManualTranslationMetadata, readOnly, features, fieldEditorControls, fieldTypeOptions, components: componentOverrides, slots, sectionOrder, disableDefaultStyles, unstyled, fieldEditorMode, activeFieldId, defaultActiveFieldId, onActiveFieldChange, submissionSettingsOptions }: FormBuilderProps): react.JSX.Element;

type SubmitStatus = "idle" | "submitting" | "success" | "error";
interface FormContextValue {
    readonly schema: FormSchema;
    readonly locale: string;
    readonly translator: TranslationAdapter;
    readonly values: FormValues;
    readonly visibility: Readonly<Record<string, boolean>>;
    readonly pageVisibility: Readonly<Record<string, boolean>>;
    readonly errors: Readonly<Record<string, ValidationIssue | undefined>>;
    readonly submitStatus: SubmitStatus;
    readonly submitError: Error | null;
    readonly isSubmitting: boolean;
    readonly setValue: (fieldId: string, value: FormValue) => void;
    readonly setServerErrors?: (fieldErrors: Readonly<Record<string, string>>) => void;
    readonly restoreValues: (values: FormValues) => void;
    readonly validatePage: (pageIndex: number) => AnswerValidationResult;
    readonly reset: () => void;
    readonly submit: (beforeSubmit?: BeforeSubmit, submitContext?: SubmitContext) => Promise<SubmitResult>;
    readonly translate: (key: string, params?: Readonly<Record<string, string | number>>) => string;
}
interface FormProviderProps {
    readonly schema: FormSchema;
    readonly locale: string;
    readonly translator: TranslationAdapter;
    readonly initialValues?: FormValues;
    readonly resetOnSuccess?: boolean;
    readonly onSubmit: FormSubmitHandler;
    readonly children: ReactNode;
}
declare function FormProvider({ schema, locale, translator, initialValues, resetOnSuccess, onSubmit, children }: FormProviderProps): react.JSX.Element;
declare function useForm(): FormContextValue;
interface FieldState {
    readonly field: FormField;
    readonly value: FormValue;
    readonly error: ValidationIssue | undefined;
    readonly setValue: (value: FormValue) => void;
}
declare function useField(fieldId: string): FieldState;

interface UseTranslationWorkspaceOptions {
    readonly schema: FormSchema;
    readonly onChange?: (schema: FormSchema) => void;
    readonly sourceLocale?: string;
    readonly targetLocale?: string;
    readonly translationAdapter?: TranslationAdapter | AsyncTranslationAdapter;
    readonly readOnly?: boolean;
    readonly policy?: FormPolicy;
    readonly validateLocale?: (locale: string, currentLocales: readonly string[]) => LocaleValidationResult;
}
interface LocaleValidationResult {
    readonly valid: boolean;
    readonly error?: {
        readonly type: "locale_not_allowed" | "max_locales_exceeded" | "invalid_locale_format";
        readonly message: string;
    };
}
interface TranslationSummary {
    readonly totalSlots: number;
    readonly translatedCount: number;
    readonly missingCount: number;
    readonly staleCount: number;
    readonly manualCount: number;
    readonly completionPercentage: number;
}
interface UseTranslationWorkspaceResult {
    readonly sourceLocale: string;
    readonly targetLocale: string;
    readonly targetLocales: readonly string[];
    readonly setTargetLocale: (locale: string) => void;
    readonly slots: readonly TranslationSlot[];
    readonly summary: TranslationSummary;
    readonly addLocale: (locale: string) => {
        readonly success: boolean;
        readonly error?: string;
    };
    readonly isAddLocaleAllowed: (locale: string) => boolean;
    readonly removeLocale: (locale: string) => void;
    readonly setTranslation: (slot: TranslationSlot, text: string) => void;
    readonly translateAll: (options?: PopulateTranslationOptions) => Promise<TranslationReport>;
    readonly translateSlot: (slot: TranslationSlot) => Promise<void>;
    readonly isTranslating: boolean;
    readonly error?: string;
}
declare function useTranslationWorkspace({ schema, onChange, sourceLocale, targetLocale, translationAdapter, readOnly, policy, validateLocale }: UseTranslationWorkspaceOptions): UseTranslationWorkspaceResult;

declare const BUILDER_TRANSLATION_KEYS: {
    readonly ADD_FIELD: "builder.actions.addField";
    readonly SELECT_FIELD_TYPE: "builder.fields.selectType";
    readonly SELECT_LOCALE_TO_ADD: "builder.localization.selectLocaleToAdd";
    readonly FIELD_TYPE_TEXT: "builder.fields.typeText";
    readonly FIELD_TYPE_TEXTAREA: "builder.fields.typeTextarea";
    readonly FIELD_TYPE_NUMBER: "builder.fields.typeNumber";
    readonly FIELD_TYPE_RATING: "builder.fields.typeRating";
    readonly FIELD_TYPE_RADIO: "builder.fields.typeRadio";
    readonly FIELD_TYPE_CHECKBOX: "builder.fields.typeCheckbox";
    readonly FIELD_TYPE_SELECT: "builder.fields.typeSelect";
    readonly FIELD_TYPE_MULTI_SELECT: "builder.fields.typeMultiSelect";
};
type BuilderTranslationKey = (typeof BUILDER_TRANSLATION_KEYS)[keyof typeof BUILDER_TRANSLATION_KEYS];
/** Legacy keys are checked when an older catalog does not contain a canonical key. */
declare const BUILDER_TRANSLATION_ALIASES: Readonly<Record<string, string>>;
declare function isTranslationUnresolved(result: unknown, key: string, aliases?: readonly string[]): boolean;
declare function resolveTranslation(key: string, aliases: readonly string[], adapter?: TranslationAdapter, defaultCatalog?: Readonly<Record<string, string>>, params?: Readonly<Record<string, unknown>>, locale?: string): string;

declare function resolveChoiceFieldLayout(type: FieldType, appearance?: FormRendererAppearance, groupedChoiceFieldsLegacy?: boolean): "default" | "grouped";
interface FieldComponentProps {
    readonly field: FormField;
    readonly value: FormValue;
    readonly error: ValidationIssue | undefined;
    readonly setValue: (value: FormValue) => void;
    readonly translate: (key: string, params?: Readonly<Record<string, string | number>>) => string;
    readonly inputId: string;
    readonly errorId: string;
    readonly helpId: string;
    readonly renderCharacterCount?: FormRendererSlots["renderCharacterCount"];
}
type FieldComponents = Partial<Record<FieldType, ComponentType<FieldComponentProps>>>;
interface FormRendererPresentationProps extends SubmissionProtectionProps {
    readonly components?: FieldComponents;
    readonly className?: string;
    readonly appearance?: FormRendererAppearance;
    readonly slotProps?: FormRendererSlotProps;
    /** @deprecated Use appearance.choiceField="grouped" instead. */
    readonly groupedChoiceFields?: boolean;
    /**
     * Controls where the completion message is rendered after a successful submission.
     * Defaults to "append" for backwards compatibility.
     */
    readonly successRenderMode?: FormSuccessRenderMode;
    readonly submissionConfirmation?: SubmissionConfirmationOptions;
    /** @deprecated Use submissionConfirmation.renderMode instead. */
    readonly submissionConfirmationRenderMode?: SubmissionConfirmationRenderMode;
    readonly showHiddenFieldsInSummary?: boolean;
    readonly fieldsClassName?: string;
    /** @deprecated Use successRenderMode="replace" instead. */
    readonly hideFormOnSuccess?: boolean;
    readonly successMessageKey?: string;
    readonly errorMessageKey?: string;
    readonly attemptIdFactory?: () => string;
    readonly messages?: Partial<FormRendererMessages>;
    readonly messageResolver?: (key: keyof FormRendererMessages, defaultText: string) => string;
    readonly autoSaveKey?: string;
    readonly beforeSubmit?: BeforeSubmit;
    readonly onDraftSave?: (draft: FormValues) => void;
    readonly slots?: FormRendererSlots;
}
interface StandaloneFormRendererProps extends FormRendererPresentationProps {
    readonly schema: FormSchema;
    readonly locale?: string;
    readonly translator?: TranslationAdapter;
    readonly initialValues?: FormValues;
    readonly resetOnSuccess?: boolean;
    readonly onSubmit: FormSubmitHandler;
}
type FormRendererProps = FormRendererPresentationProps | StandaloneFormRendererProps;
declare function FormRenderer(props: FormRendererProps): react.JSX.Element;

export { BUILDER_TRANSLATION_ALIASES, BUILDER_TRANSLATION_KEYS, type BeforeSubmit, type BuilderActionContext, type BuilderActionError, type BuilderActionIconType, type BuilderActionResult, type BuilderButtonProps, type BuilderCheckboxProps, type BuilderErrorMessageProps, type BuilderFactories, type BuilderFieldEditorSlotProps, type BuilderFieldsetProps, type BuilderIconButtonProps, type BuilderIdKind, type BuilderLocalizationSlotProps, type BuilderOptionEditorSlotProps, type BuilderPagesSlotProps, type BuilderPolicy, type BuilderSectionProps, type BuilderSelectOption, type BuilderSelectProps, type BuilderSlotActions, type BuilderTextAreaProps, type BuilderTextInputProps, type BuilderTextTarget, type BuilderToolbarSlotProps, type BuilderTranslationActionsSlotProps, type BuilderTranslationKey, type ChoiceFieldLayoutMode, type ChoiceFieldTypeLayoutMap, type ChoiceGroupSlotProps, type ComponentBaseProps, type FieldComponentProps, type FieldComponents, type FieldEditorControlsConfig, type FieldEditorHeaderSlotProps, type FieldEditorMode, type FieldError, type FieldPropertyControlMode, type FieldState, type FieldTypeSelectOptionsConfig, type FieldTypeSelectOptionsContext, type FieldTypeSelectOptionsSorter, type FieldTypeSelectOptionsTransformer, type FieldTypeSelectSlotProps, FormBuilder, type FormBuilderActions, type FormBuilderComponents, type FormBuilderFeatures, type FormBuilderOptions, type FormBuilderProps, type FormBuilderResult, type FormBuilderSectionName, type FormBuilderSlots, type FormBuilderSubmissionSettingsOptions, type FormCompletionSlotProps, type FormContextValue, type FormFieldsSlotProps, FormProvider, type FormProviderProps, FormRenderer, type FormRendererAppearance, type FormRendererMessages, type FormRendererPresentationProps, type FormRendererProps, type FormRendererSlotProps, type FormRendererSlots, type FormServerErrorPayload, FormSubmissionError, type FormSubmitHandler, type FormSubmitState, type FormSubmitStatus, type FormSubmittedAnswerItem, type FormSuccessRenderMode, type IconButtonProps, type InputComponentProps, type LocaleValidationResult, type LocalizationSummaryContext, type ManualTranslationContext, type ManualTranslationTarget, type RenderSubmitButtonProps, type SelectComponentProps, type StandaloneFormRendererProps, type SubmissionAttempt, type SubmissionAttemptStore, type SubmissionConfirmationOptions, type SubmissionConfirmationRenderMode, type SubmissionConfirmationSlotProps, type SubmissionGuard, type SubmissionGuardResult, type SubmissionProtectionProps, type SubmissionReceipt, type SubmissionReceiptQuery, type SubmissionReceiptStore, type SubmitContext, type SubmitResponse, type SubmitResult, type SubmitStatus, type TranslationSummary, type UseFormBuilderOptions, type UseFormBuilderResult, type UseSubmissionReceiptsResult, type UseTranslationWorkspaceOptions, type UseTranslationWorkspaceResult, createLocalStorageSubmissionAttemptStore, createLocalStorageSubmissionReceiptStore, isTranslationUnresolved, resolveChoiceFieldLayout, resolveFieldEditorControls, resolveFieldTypeSelectOptions, resolveInitialFieldType, resolveTranslation, submissionReceiptQueryKey, useField, useForm, useFormBuilder, useSubmissionReceipts, useTranslationWorkspace };
