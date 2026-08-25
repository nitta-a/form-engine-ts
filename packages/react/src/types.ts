import type {
  FieldOption,
  FormField,
  FormPage,
  FormPolicy,
  FormSchema,
  FormValues,
  JsonValue,
  TranslationReport,
  ValidationError
} from "@form-engine-ts/core";
import type { SensitiveDataFinding } from "@form-engine-ts/privacy";
import type { ComponentType, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import type { SubmissionAttemptStore } from "./attempt";
import type { BuilderActionResult, FormBuilderResult } from "./hooks/useFormBuilder";
import type { SubmissionReceipt, SubmissionReceiptStore } from "./receipt";

export interface ComponentBaseProps {
  readonly id?: string;
  readonly className?: string | undefined;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly "aria-label"?: string | undefined;
  readonly "aria-describedby"?: string | undefined;
  readonly "aria-labelledby"?: string | undefined;
}

export type BuilderActionIconType =
  | "moveUp"
  | "moveDown"
  | "delete"
  | "add"
  | "edit"
  | "settings"
  | "translate"
  | "close"
  | "dragHandle";

export interface BuilderButtonProps extends ComponentBaseProps {
  readonly onClick?: () => void;
  readonly variant?: "primary" | "secondary" | "danger";
  readonly children: ReactNode;
  readonly title?: string;
  readonly action?: string;
  readonly targetId?: string;
}

export interface IconButtonProps extends ComponentBaseProps {
  readonly onClick?: () => void;
  readonly icon?: string | ReactNode;
  readonly actionType?: BuilderActionIconType;
  readonly title?: string;
}

export interface BuilderIconButtonProps extends ComponentBaseProps {
  readonly onClick?: () => void;
  readonly icon?: string | ReactNode;
  readonly actionType?: BuilderActionIconType;
  readonly title?: string;
}

export interface InputComponentProps extends ComponentBaseProps {
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

export interface BuilderTextInputProps extends InputComponentProps {
  readonly inputMode?: "text" | "numeric";
  readonly type?: "text" | "number";
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
}

export interface BuilderTextAreaProps extends InputComponentProps {
  readonly rows?: number;
}

export interface BuilderSelectOption {
  readonly label: string;
  readonly value: string;
  readonly disabled?: boolean;
}

export interface BuilderSelectProps extends InputComponentProps {
  readonly options: readonly BuilderSelectOption[];
}

export interface BuilderCheckboxProps extends ComponentBaseProps {
  readonly name?: string;
  readonly required?: boolean;
  readonly error?: boolean;
  readonly helperText?: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly label: string;
}

export interface BuilderSectionProps {
  readonly id?: string;
  readonly className?: string | undefined;
  readonly title?: string;
  readonly description?: string;
  readonly headingId?: string;
  readonly "aria-label"?: string;
  readonly onClickCapture?: (event: ReactMouseEvent<HTMLElement>) => void;
  readonly children: ReactNode;
}

export interface BuilderFieldsetProps {
  readonly className?: string | undefined;
  readonly legend?: string;
  readonly disabled?: boolean;
  readonly children: ReactNode;
}

export interface BuilderErrorMessageProps extends ComponentBaseProps {
  readonly message: string;
}

export interface FormBuilderComponents {
  readonly Button?: ComponentType<BuilderButtonProps>;
  readonly IconButton?: ComponentType<BuilderIconButtonProps>;
  readonly TextInput?: ComponentType<BuilderTextInputProps>;
  readonly TextArea?: ComponentType<BuilderTextAreaProps>;
  readonly Select?: ComponentType<BuilderSelectProps>;
  readonly Checkbox?: ComponentType<BuilderCheckboxProps>;
  readonly Section?: ComponentType<BuilderSectionProps>;
  readonly Fieldset?: ComponentType<BuilderFieldsetProps>;
  readonly ErrorMessage?: ComponentType<{ readonly message: string }>;
  readonly renderIcon?: (actionType: BuilderActionIconType) => ReactNode;
}

export type FormBuilderActions = Omit<FormBuilderResult, "schema" | "validationIssues">;

export interface ManualTranslationTarget {
  readonly kind: "form" | "page" | "field" | "option";
  readonly id?: string;
}

export interface BuilderSlotActions extends FormBuilderActions {
  readonly setManualTranslation: (
    locale: string,
    target: ManualTranslationTarget,
    property: "title" | "description" | "label" | "completionMessage",
    text: string
  ) => BuilderActionResult;
}

interface BuilderSlotBaseProps {
  readonly schema: FormSchema;
  readonly readOnly: boolean;
  readonly actions: BuilderSlotActions;
  readonly components: Required<FormBuilderComponents>;
  readonly translate: (key: string, params?: Record<string, unknown>) => string;
}

export interface BuilderToolbarSlotProps extends BuilderSlotBaseProps {
  readonly kind: "page" | "field" | "option";
  readonly targetId: string;
  readonly index: number;
  readonly total: number;
  readonly title: string;
  readonly onMoveUp: () => void;
  readonly onMoveDown: () => void;
  readonly onRemove: () => void;
}

export interface BuilderFieldEditorSlotProps extends BuilderSlotBaseProps {
  readonly field: FormField;
  readonly index: number;
  readonly currentLocale: string;
  readonly policy?: FormPolicy;
  readonly features?: {
    readonly pages?: boolean;
    readonly localization?: boolean;
    readonly conditions?: boolean;
  };
}

export interface BuilderOptionEditorSlotProps extends BuilderSlotBaseProps {
  readonly field: FormField & { readonly options: readonly FieldOption[] };
  readonly option: FieldOption;
  readonly index: number;
  readonly currentLocale: string;
}

export interface BuilderPagesSlotProps extends BuilderSlotBaseProps {
  readonly currentLocale: string;
  readonly features?: {
    readonly pages?: boolean;
    readonly localization?: boolean;
    readonly conditions?: boolean;
  };
}

export interface BuilderLocalizationSlotProps extends BuilderSlotBaseProps {
  readonly currentLocale: string;
  readonly onCurrentLocaleChange: (locale: string) => void;
  readonly onAutoTranslate: () => void;
  readonly isTranslating: boolean;
  readonly translationError?: string;
  readonly policy?: FormPolicy;
  readonly translationAdapterAvailable?: boolean;
}

export interface BuilderTranslationActionsSlotProps extends BuilderSlotBaseProps {
  readonly currentLocale: string;
  readonly onAutoTranslate: () => void;
  readonly isTranslating: boolean;
  readonly translationError?: string;
  readonly translationReport?: TranslationReport;
  readonly onClearTranslationError?: () => void;
  readonly translationAdapterAvailable?: boolean;
}

export type FormBuilderSectionName =
  | "basicSettings"
  | "completionMessage"
  | "questions"
  | "addQuestion"
  | "localization";

export interface FormBuilderSlots {
  readonly toolbar?: ComponentType<BuilderToolbarSlotProps>;
  readonly fieldEditor?: ComponentType<BuilderFieldEditorSlotProps>;
  readonly optionEditor?: ComponentType<BuilderOptionEditorSlotProps>;
  readonly pages?: ComponentType<BuilderPagesSlotProps>;
  readonly localization?: ComponentType<BuilderLocalizationSlotProps>;
  readonly translationActions?: ComponentType<BuilderTranslationActionsSlotProps>;
  readonly sectionOrder?: readonly FormBuilderSectionName[];
}

export interface BuilderActionContext {
  readonly action:
    | "addField"
    | "removeField"
    | "moveField"
    | "changeFieldType"
    | "updateField"
    | "addOption"
    | "removeOption"
    | "moveOption"
    | "updateOption"
    | "addPage"
    | "removePage"
    | "movePage"
    | "updatePage"
    | "assignFieldToPage"
    | "addLocale"
    | "setDefaultLocale"
    | "setDisplayCondition"
    | "setSourceText"
    | "setLocaleTranslation"
    | "setManualTranslation";
  readonly targetId?: string;
  readonly params?: Record<string, unknown>;
}

export interface ManualTranslationContext {
  readonly locale: string;
  readonly kind: "form" | "page" | "field" | "option";
  readonly nodeId: string;
  readonly property: "title" | "description" | "label" | "completionMessage";
  readonly sourceText: string;
  readonly translatedText: string;
  readonly existingTranslationMetadata?: Readonly<Record<string, JsonValue>>;
}

export type SubmitResult =
  | { readonly status: "invalid"; readonly issues: readonly ValidationError[] }
  | { readonly status: "cancelled" }
  | { readonly status: "success"; readonly response?: SubmitResponse }
  | { readonly status: "error"; readonly error: Error };

export interface SubmitResponse {
  readonly submissionId?: string;
  readonly submittedAt?: string;
}

export type FormSubmitHandler = (
  answers: FormValues
) => SubmitResponse | void | Promise<SubmitResponse | undefined> | Promise<void>;

export type SubmissionGuardResult =
  | { readonly status: "allow" }
  | { readonly status: "confirm"; readonly findings: readonly SensitiveDataFinding[]; readonly message?: string }
  | { readonly status: "block"; readonly findings: readonly SensitiveDataFinding[]; readonly message?: string };

export type SubmissionGuard = (
  schema: FormSchema,
  values: Record<string, unknown>
) => SubmissionGuardResult | Promise<SubmissionGuardResult>;

export type FormSuccessRenderMode = "append" | "replace";

export type FormSubmitStatus = "idle" | "submitting" | "confirming" | "success" | "error";

/** @deprecated Use FormSubmitStatus instead. */
export type FormSubmitState = "idle" | "submitting" | "confirming" | "success" | "error";

export interface RenderSubmitButtonProps {
  readonly isSubmitting: boolean;
  readonly submitStatus: FormSubmitStatus;
  readonly disabled: boolean;
  readonly onSubmit: () => void;
}

export interface SubmissionConfirmationSlotProps {
  readonly findings: readonly SensitiveDataFinding[];
  readonly message?: string;
  readonly schema: FormSchema;
  readonly visibleValues: Record<string, unknown>;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export interface FormRendererSlots {
  readonly renderHeader?: (props: { readonly title: string; readonly description?: string }) => ReactNode;
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
  readonly renderValidationSummary?: (props: { readonly issues: readonly ValidationError[] }) => ReactNode;
  readonly renderCompletion?: (props: { readonly message: string }) => ReactNode;
  readonly renderSubmitError?: (props: { readonly error: Error; readonly onRetry?: () => void }) => ReactNode;
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

export interface SubmissionProtectionProps {
  readonly submissionGuards?: readonly SubmissionGuard[];
  readonly receiptStore?: SubmissionReceiptStore;
  readonly attemptStore?: SubmissionAttemptStore;
  readonly onReceiptError?: (error: Error, receipt: SubmissionReceipt) => void;
}

export type BeforeSubmit = (
  values: Readonly<Record<string, unknown>>
) => "continue" | "cancel" | Promise<"continue" | "cancel">;
