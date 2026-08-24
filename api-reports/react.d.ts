import * as react from 'react';
import { ReactNode, ComponentType, MouseEvent } from 'react';
import { QuestionType, FormField, ChoiceOption, FormPage, FormSchema, DisplayCondition, JsonValue, SchemaIssue, FormPolicy, FieldOption, TranslationReport, ValidationError, FormValues, TranslationAdapter, AsyncTranslationAdapter, PopulateTranslationOptions, FormValue, ValidationIssue, AnswerValidationResult, FieldType } from '@form-engine-ts/core';
import { SensitiveDataFinding } from '@form-engine-ts/privacy';

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
}
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
}
declare function useFormBuilder({ schema, onChange, policy, idFactory, factories }: FormBuilderOptions): FormBuilderResult;

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
    getBatch(queries: readonly SubmissionReceiptQuery[]): Promise<Map<string, SubmissionReceipt>>;
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
    readonly className?: string;
    readonly disabled?: boolean;
    readonly readOnly?: boolean;
    readonly "aria-label"?: string;
}
interface BuilderButtonProps extends ComponentBaseProps {
    readonly onClick?: () => void;
    readonly variant?: "primary" | "secondary" | "danger";
    readonly children: ReactNode;
    readonly title?: string;
    readonly action?: string;
    readonly targetId?: string;
}
interface BuilderIconButtonProps extends ComponentBaseProps {
    readonly onClick?: () => void;
    readonly icon: string;
    readonly title: string;
}
interface InputComponentProps extends ComponentBaseProps {
    readonly name?: string;
    readonly label?: string;
    readonly required?: boolean;
    readonly error?: boolean;
    readonly helperText?: string;
    readonly value: string;
    readonly onChange: (value: string) => void;
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
interface BuilderSelectOption {
    readonly label: string;
    readonly value: string;
    readonly disabled?: boolean;
}
interface BuilderSelectProps extends InputComponentProps {
    readonly options: readonly BuilderSelectOption[];
}
interface BuilderCheckboxProps extends ComponentBaseProps {
    readonly checked: boolean;
    readonly onChange: (checked: boolean) => void;
    readonly label: string;
}
interface BuilderSectionProps {
    readonly id?: string;
    readonly className?: string;
    readonly title?: string;
    readonly description?: string;
    readonly headingId?: string;
    readonly "aria-label"?: string;
    readonly onClickCapture?: (event: MouseEvent<HTMLElement>) => void;
    readonly children: ReactNode;
}
interface BuilderFieldsetProps {
    readonly className?: string;
    readonly legend?: string;
    readonly disabled?: boolean;
    readonly children: ReactNode;
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
}
type FormBuilderActions = Omit<FormBuilderResult, "schema" | "validationIssues">;
interface BuilderSlotBaseProps {
    readonly schema: FormSchema;
    readonly readOnly: boolean;
    readonly actions: FormBuilderActions;
    readonly components: Required<FormBuilderComponents>;
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
}
interface BuilderLocalizationSlotProps extends BuilderSlotBaseProps {
    readonly currentLocale: string;
    readonly onCurrentLocaleChange: (locale: string) => void;
    readonly onAutoTranslate: () => void;
    readonly isTranslating: boolean;
    readonly translationError?: string;
}
interface BuilderTranslationActionsSlotProps extends BuilderSlotBaseProps {
    readonly currentLocale: string;
    readonly onAutoTranslate: () => void;
    readonly isTranslating: boolean;
    readonly translationError?: string;
    readonly translationReport?: TranslationReport;
    readonly onClearTranslationError?: () => void;
}
interface FormBuilderSlots {
    readonly toolbar?: ComponentType<BuilderToolbarSlotProps>;
    readonly fieldEditor?: ComponentType<BuilderFieldEditorSlotProps>;
    readonly optionEditor?: ComponentType<BuilderOptionEditorSlotProps>;
    readonly pages?: ComponentType<BuilderPagesSlotProps>;
    readonly localization?: ComponentType<BuilderLocalizationSlotProps>;
    readonly translationActions?: ComponentType<BuilderTranslationActionsSlotProps>;
}
interface BuilderActionContext {
    readonly action: "addField" | "removeField" | "moveField" | "changeFieldType" | "updateField" | "addOption" | "removeOption" | "moveOption" | "updateOption" | "addPage" | "removePage" | "movePage" | "updatePage" | "assignFieldToPage" | "addLocale" | "setDefaultLocale" | "setDisplayCondition" | "setSourceText" | "setLocaleTranslation";
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
type FormSubmitHandler = (answers: FormValues) => SubmitResponse | void | Promise<SubmitResponse | undefined> | Promise<void>;
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
type FormSubmitState = "idle" | "submitting" | "confirming" | "success" | "error";
interface SubmissionConfirmationSlotProps {
    readonly findings: readonly SensitiveDataFinding[];
    readonly message?: string;
    readonly schema: FormSchema;
    readonly visibleValues: Record<string, unknown>;
    readonly onConfirm: () => void;
    readonly onCancel: () => void;
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
    readonly renderSubmitButton?: (props: {
        readonly isSubmitting: boolean;
        readonly onSubmit: () => void;
    }) => ReactNode;
    readonly renderValidationSummary?: (props: {
        readonly issues: readonly ValidationError[];
    }) => ReactNode;
    readonly renderCompletion?: (props: {
        readonly message: string;
    }) => ReactNode;
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
}
interface SubmissionProtectionProps {
    readonly submissionGuards?: readonly SubmissionGuard[];
    readonly receiptStore?: SubmissionReceiptStore;
}
type BeforeSubmit = (values: Readonly<Record<string, unknown>>) => "continue" | "cancel" | Promise<"continue" | "cancel">;

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
    readonly components?: FormBuilderComponents;
    readonly slots?: FormBuilderSlots;
}
declare function FormBuilder({ schema, onChange, locale, translator, translationAdapter, translationOptions, onTranslationReport, policy, idFactory, factories, className, defaultFieldType, onActionError, createManualTranslationMetadata, readOnly, features, components: componentOverrides, slots }: FormBuilderProps): react.JSX.Element;

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
    readonly restoreValues: (values: FormValues) => void;
    readonly validatePage: (pageIndex: number) => AnswerValidationResult;
    readonly reset: () => void;
    readonly submit: (beforeSubmit?: BeforeSubmit) => Promise<SubmitResult>;
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
    readonly successMessageKey?: string;
    readonly errorMessageKey?: string;
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

export { type BeforeSubmit, type BuilderActionContext, type BuilderActionError, type BuilderActionResult, type BuilderButtonProps, type BuilderCheckboxProps, type BuilderFactories, type BuilderFieldEditorSlotProps, type BuilderFieldsetProps, type BuilderIconButtonProps, type BuilderIdKind, type BuilderLocalizationSlotProps, type BuilderOptionEditorSlotProps, type BuilderPagesSlotProps, type BuilderPolicy, type BuilderSectionProps, type BuilderSelectOption, type BuilderSelectProps, type BuilderTextAreaProps, type BuilderTextInputProps, type BuilderTextTarget, type BuilderToolbarSlotProps, type BuilderTranslationActionsSlotProps, type ComponentBaseProps, type FieldComponentProps, type FieldComponents, type FieldState, FormBuilder, type FormBuilderActions, type FormBuilderComponents, type FormBuilderFeatures, type FormBuilderOptions, type FormBuilderProps, type FormBuilderResult, type FormBuilderSlots, type FormContextValue, FormProvider, type FormProviderProps, FormRenderer, type FormRendererPresentationProps, type FormRendererProps, type FormRendererSlots, type FormSubmitHandler, type FormSubmitState, type InputComponentProps, type ManualTranslationContext, type StandaloneFormRendererProps, type SubmissionConfirmationSlotProps, type SubmissionGuard, type SubmissionGuardResult, type SubmissionProtectionProps, type SubmissionReceipt, type SubmissionReceiptQuery, type SubmissionReceiptStore, type SubmitResponse, type SubmitResult, type SubmitStatus, type UseSubmissionReceiptsResult, createLocalStorageSubmissionReceiptStore, resolveInitialFieldType, submissionReceiptQueryKey, useField, useForm, useFormBuilder, useSubmissionReceipts };
