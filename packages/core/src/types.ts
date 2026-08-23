export type FieldType = "text" | "textarea" | "number" | "rating" | "select" | "multi-select" | "checkbox" | "radio";

export type ConditionOperator = "equals" | "not_equals" | "contains" | "not_empty";
export type ConditionValue = string | number | boolean;

export interface DisplayCondition {
  readonly questionId: string;
  readonly operator: ConditionOperator;
  readonly value?: ConditionValue;
}

export interface LocalizedText {
  readonly title?: string;
  readonly description?: string;
}

export type SchemaTranslations = Readonly<Record<string, LocalizedText>>;

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
  readonly id: string;
  readonly label: string;
  readonly translations?: Readonly<Record<string, string>>;
}

export interface BaseField {
  readonly id: string;
  readonly type: FieldType;
  readonly title: string;
  readonly description?: string;
  readonly translationKey?: string;
  readonly required: boolean;
  readonly messages?: Partial<Record<ValidationCode, string>>;
  readonly displayCondition?: DisplayCondition;
  readonly translations?: SchemaTranslations;
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

export interface RatingField extends BaseField {
  readonly type: "rating";
  readonly min?: number;
  readonly max?: number;
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

export type FormField = TextField | NumberField | RatingField | SelectField | MultiSelectField | CheckboxField;

export interface FormPage {
  readonly id: string;
  readonly title?: string;
  readonly description?: string;
  readonly questionIds: readonly string[];
  readonly displayCondition?: DisplayCondition;
  readonly translations?: SchemaTranslations;
}

export interface FormSchema {
  readonly id: string;
  readonly version: number;
  readonly title: string;
  readonly description?: string;
  readonly submitLabelKey?: string;
  readonly defaultLocale?: string;
  readonly supportedLocales?: readonly string[];
  readonly translations?: SchemaTranslations;
  readonly fields: readonly FormField[];
  readonly pages?: readonly FormPage[];
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

export interface AsyncTranslationAdapter {
  translateText(text: string, targetLocale: string, sourceLocale?: string): Promise<string>;
  translateBatch(texts: readonly string[], targetLocale: string, sourceLocale?: string): Promise<readonly string[]>;
}

export interface SubmissionQueryOptions {
  readonly since?: string;
  readonly until?: string;
}

export interface StorageAdapter {
  saveSubmission(submission: FormSubmission): Promise<void>;
  listSubmissions(
    formId: string,
    formVersion?: number,
    options?: SubmissionQueryOptions
  ): Promise<readonly FormSubmission[]>;
  clearResponses?(formId: string): Promise<void>;
  clear(): Promise<void>;
}

export interface FormStorageAdapter extends StorageAdapter {
  saveSchema(schema: FormSchema): Promise<void>;
  getSchema(formId: string, formVersion: number): Promise<FormSchema | null>;
  listSchemas(): Promise<readonly FormSchema[]>;
  deleteSchema(formId: string, formVersion: number): Promise<void>;
  deleteSubmission(submissionId: string): Promise<void>;
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
  readonly kind: "number" | "rating";
  readonly minimum: number | null;
  readonly maximum: number | null;
  readonly average: number | null;
  readonly total: number;
}

export interface OptionAggregate {
  readonly id: string;
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

export type Question = FormField;
export type QuestionType = FieldType;
export type ChoiceOption = FieldOption;
export type FormResponse = FormSubmission;

export interface CrossTabulationResult {
  readonly rowQuestionId: string;
  readonly colQuestionId: string;
  readonly matrix: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly rowTotals: Readonly<Record<string, number>>;
  readonly colTotals: Readonly<Record<string, number>>;
  readonly grandTotal: number;
}
