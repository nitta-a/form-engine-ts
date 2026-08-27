import type { FormVersionRecord, FormVersionState, Result, VersionTransitionEvent } from "./versioning";

export type FieldType = "text" | "textarea" | "number" | "rating" | "select" | "multi-select" | "checkbox" | "radio";

export type QuestionType = FieldType;

export interface BaseFieldConstraintRule {
  readonly defaultRequired?: boolean;
  readonly fixedRequired?: boolean;
}

export interface RatingFieldConstraintRule extends BaseFieldConstraintRule {
  readonly defaultMin?: number;
  readonly defaultMax?: number;
  readonly fixedMin?: number;
  readonly fixedMax?: number;
  readonly allowedMinRange?: readonly [number, number];
  readonly allowedMaxRange?: readonly [number, number];
}

export interface TextFieldConstraintRule extends BaseFieldConstraintRule {
  readonly defaultMaxLength?: number;
  readonly maxMaxLength?: number;
}

export interface ChoiceFieldConstraintRule extends BaseFieldConstraintRule {
  readonly minOptions?: number;
  readonly maxOptions?: number;
}

export type FieldConstraintRule =
  | RatingFieldConstraintRule
  | TextFieldConstraintRule
  | ChoiceFieldConstraintRule
  | BaseFieldConstraintRule;

export interface FormPolicy {
  readonly allowedFieldTypes?: readonly FieldType[];
  readonly maxFields?: number;
  readonly maxOptionsPerField?: number;
  readonly requiredLocales?: readonly string[];
  readonly allowedLocales?: readonly string[];
  readonly maxLocales?: number;
  readonly maxTextLength?: number;
  readonly maxSchemaBytes?: number;
  /** Per-question-type defaults and immutable or bounded field constraints. */
  readonly fieldConstraints?: Partial<Record<QuestionType, FieldConstraintRule>>;
}

export type ConditionOperator = "equals" | "not_equals" | "contains" | "not_empty";
export type ConditionValue = string | number | boolean;

export type JsonValue = string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue };

/** Arbitrary, JSON-serializable data preserved by every form-engine operation. */
export interface ExtensibleNode {
  readonly metadata?: Readonly<Record<string, JsonValue>>;
  /** Locale -> translated property -> metadata created for that translation. */
  readonly translationMetadata?: Readonly<
    Record<string, Readonly<Record<string, Readonly<Record<string, JsonValue>>>>>
  >;
}

export interface DisplayCondition {
  readonly questionId: string;
  readonly operator: ConditionOperator;
  readonly value?: ConditionValue;
}

export interface LocalizedText {
  readonly title?: string;
  readonly description?: string;
  readonly completionMessage?: string;
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

export interface FieldOption extends ExtensibleNode {
  readonly id: string;
  readonly label: string;
  readonly translations?: Readonly<Record<string, string>>;
}

export interface BaseField extends ExtensibleNode {
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

export interface FormPage extends ExtensibleNode {
  readonly id: string;
  readonly title?: string;
  readonly description?: string;
  readonly questionIds: readonly string[];
  readonly displayCondition?: DisplayCondition;
  readonly translations?: SchemaTranslations;
}

export interface FormSchema extends ExtensibleNode {
  readonly id: string;
  readonly version: number;
  readonly title: string;
  readonly description?: string;
  readonly completionMessage?: string;
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
  /** Compatibility discriminator for structured policy issues. */
  readonly type?: string;
  /** Present for policy issues that identify a field property and its expected value. */
  readonly fieldId?: string;
  readonly property?: string;
  readonly expected?: boolean | number | readonly [number, number];
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

export type ValidationError = ValidationIssue;

export type AnswerValidationResult =
  | { readonly valid: true; readonly issues: readonly [] }
  | { readonly valid: false; readonly issues: readonly ValidationIssue[] };

export interface FormSubmission extends ExtensibleNode {
  readonly id: string;
  readonly formId: string;
  readonly formVersion: number;
  readonly locale: string;
  readonly values: FormValues;
  readonly submittedAt: string;
}

export interface TranslationAdapter {
  /** Return null or undefined when the key cannot be resolved by the adapter. */
  translate(key: string, locale: string, params?: Readonly<Record<string, string | number>>): string | undefined | null;
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

export interface SubmissionPageQueryOptions {
  readonly version?: number;
  readonly cursor?: string;
  readonly pageSize?: number;
  readonly since?: string;
  readonly until?: string;
  readonly locale?: string;
  readonly filter?: SubmissionFilter | ((submission: FormSubmission) => boolean);
  /** @deprecated Prefer the generic filter AST. */
  readonly metadataFilters?: Readonly<Record<string, JsonValue>>;
}

export interface TextAnswerPageQueryOptions extends SubmissionPageQueryOptions {
  readonly fieldIds?: readonly string[];
}

export type SubmissionFilter =
  | { readonly op: "eq"; readonly path: string; readonly value: JsonValue }
  | { readonly op: "in"; readonly path: string; readonly values: readonly JsonValue[] }
  | { readonly op: "range"; readonly path: string; readonly from?: JsonValue; readonly to?: JsonValue }
  | { readonly op: "exists"; readonly path: string; readonly value: boolean }
  | { readonly op: "and"; readonly filters: readonly SubmissionFilter[] }
  | { readonly op: "or"; readonly filters: readonly SubmissionFilter[] };

export interface SubmissionPage {
  readonly items: readonly FormSubmission[];
  readonly nextCursor?: string;
  readonly hasMore: boolean;
}

export interface PagedSubmissionStorageAdapter extends FormStorageAdapter {
  listSubmissionPage(formId: string, options?: SubmissionPageQueryOptions): Promise<SubmissionPage>;
  listTextAnswerPage?(
    formId: string,
    fieldIdOrOptions?: string | TextAnswerPageQueryOptions,
    options?: TextAnswerPageQueryOptions
  ): Promise<TextAnswerPage>;
}

export interface TextAnswerItem {
  readonly responseId: string;
  readonly formId: string;
  readonly formVersion: number;
  readonly fieldId: string;
  readonly text: string;
  readonly locale?: string;
  readonly submittedAt: string;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export interface TextAnswerPage {
  readonly items: readonly TextAnswerItem[];
  readonly nextCursor?: string;
  readonly hasMore: boolean;
}

export interface VersionTransitionPlan {
  readonly formId: string;
  readonly expectedRevision: number;
  readonly nextRevision: number;
  readonly draftToCreate?: FormVersionRecord;
  readonly draftToDeleteVersion?: number;
  readonly publishedRecordToSave?: FormVersionRecord;
  readonly archivedRecordsToSave?: readonly FormVersionRecord[];
  readonly events: readonly VersionTransitionEvent[];
  /** The complete next state value used by persistent adapters. */
  readonly nextVersion?: number;
  readonly timestamp: string;
}

export type StorageCommitError =
  | { readonly type: "revision_conflict"; readonly expectedRevision: number; readonly actualRevision?: number }
  | { readonly type: "draft_already_exists"; readonly currentDraftVersion: number }
  | { readonly type: "transaction_unsupported" }
  | { readonly type: "invalid_transition"; readonly message: string }
  | { readonly type: "storage_error"; readonly cause: unknown };

export interface VersionedFormStorageAdapter extends FormStorageAdapter {
  getVersionState(formId: string): Promise<FormVersionState | null>;
  getVersionRecord(formId: string, version: number): Promise<FormVersionRecord | null>;
  listVersionRecords(formId: string): Promise<readonly FormVersionRecord[]>;
  commitVersionTransition(plan: VersionTransitionPlan): Promise<Result<{ readonly success: true }, StorageCommitError>>;
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
export type ChoiceOption = FieldOption;

/** Translation keys reserved for the form builder UI. */
export type BuilderTranslationKey = `builder.${string}`;

export interface FieldTypeDefinition {
  readonly type: QuestionType;
  readonly labelKey: BuilderTranslationKey;
  readonly defaultLabel: string;
  readonly category: "text" | "choice" | "number" | "advanced";
  readonly hasOptions: boolean;
}

export interface FormResponse extends ExtensibleNode {
  readonly responseId: string;
  readonly formId: string;
  readonly formVersion?: number;
  readonly sourceLocale?: string;
  readonly answers: Readonly<Record<string, unknown>>;
  readonly submittedAt: string;
}

export interface CrossTabulationResult {
  readonly rowQuestionId: string;
  readonly colQuestionId: string;
  readonly matrix: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly rowTotals: Readonly<Record<string, number>>;
  readonly colTotals: Readonly<Record<string, number>>;
  readonly grandTotal: number;
}
