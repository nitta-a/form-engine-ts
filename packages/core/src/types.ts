export type FieldType = "text" | "textarea" | "number" | "select" | "multi-select" | "checkbox" | "radio";

export type ValidationCode =
  | "required"
  | "invalid_type"
  | "min_length"
  | "max_length"
  | "pattern"
  | "min"
  | "max"
  | "step"
  | "invalid_option"
  | "min_selections"
  | "max_selections"
  | "unknown_field";

export interface FieldOption {
  readonly value: string;
  readonly labelKey: string;
}

export interface BaseField {
  readonly id: string;
  readonly type: FieldType;
  readonly labelKey: string;
  readonly helpTextKey?: string;
  readonly required?: boolean;
  readonly messages?: Partial<Record<ValidationCode, string>>;
}

export interface TextField extends BaseField {
  readonly type: "text" | "textarea";
  readonly placeholderKey?: string;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
}

export interface NumberField extends BaseField {
  readonly type: "number";
  readonly placeholderKey?: string;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
}

export interface SelectField extends BaseField {
  readonly type: "select" | "radio";
  readonly options: readonly FieldOption[];
}

export interface MultiSelectField extends BaseField {
  readonly type: "multi-select";
  readonly options: readonly FieldOption[];
  readonly minSelections?: number;
  readonly maxSelections?: number;
}

export interface CheckboxField extends BaseField {
  readonly type: "checkbox";
}

export type FormField = TextField | NumberField | SelectField | MultiSelectField | CheckboxField;

export interface FormSchema {
  readonly id: string;
  readonly version: number;
  readonly titleKey: string;
  readonly descriptionKey?: string;
  readonly submitLabelKey?: string;
  readonly fields: readonly FormField[];
}

export type FormValue = string | number | boolean | readonly string[] | undefined;
export type FormValues = Readonly<Record<string, FormValue>>;

export interface SchemaIssue {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export type SchemaValidationResult =
  | { readonly valid: true; readonly value: FormSchema; readonly issues: readonly [] }
  | { readonly valid: false; readonly issues: readonly SchemaIssue[] };

export interface ValidationIssue {
  readonly fieldId: string;
  readonly code: ValidationCode;
  readonly messageKey: string;
  readonly params: Readonly<Record<string, string | number>>;
}

export type AnswerValidationResult =
  | { readonly valid: true; readonly issues: readonly [] }
  | { readonly valid: false; readonly issues: readonly ValidationIssue[] };

export interface FormSubmission {
  readonly id: string;
  readonly formId: string;
  readonly formVersion: number;
  readonly locale: string;
  readonly values: FormValues;
  readonly submittedAt: string;
}

export interface TranslationAdapter {
  translate(key: string, locale: string, params?: Readonly<Record<string, string | number>>): string;
}

export interface StorageAdapter {
  saveSubmission(submission: FormSubmission): Promise<void>;
  listSubmissions(formId: string, formVersion?: number): Promise<readonly FormSubmission[]>;
  clear(): Promise<void>;
}

interface BaseQuestionAggregate {
  readonly fieldId: string;
  readonly answeredCount: number;
  readonly unansweredCount: number;
}

export interface TextQuestionAggregate extends BaseQuestionAggregate {
  readonly kind: "text" | "textarea";
}

export interface NumberQuestionAggregate extends BaseQuestionAggregate {
  readonly kind: "number";
  readonly minimum: number | null;
  readonly maximum: number | null;
  readonly average: number | null;
}

export interface OptionAggregate {
  readonly value: string;
  readonly count: number;
  readonly percentageOfSubmissions: number;
}

export interface ChoiceQuestionAggregate extends BaseQuestionAggregate {
  readonly kind: "select" | "radio" | "multi-select";
  readonly options: readonly OptionAggregate[];
}

export interface CheckboxQuestionAggregate extends BaseQuestionAggregate {
  readonly kind: "checkbox";
  readonly trueCount: number;
  readonly falseCount: number;
  readonly truePercentageOfSubmissions: number;
  readonly falsePercentageOfSubmissions: number;
}

export type QuestionAggregate =
  | TextQuestionAggregate
  | NumberQuestionAggregate
  | ChoiceQuestionAggregate
  | CheckboxQuestionAggregate;

export interface FormAnalytics {
  readonly formId: string;
  readonly formVersion: number;
  readonly submissionCount: number;
  readonly questions: readonly QuestionAggregate[];
}
