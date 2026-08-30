import type { MetadataCsvExportOptions } from "./analytics";
import type { BuilderTranslationKey } from "./i18n/keys";
import type { FormSubmissionValidationSource } from "./validation";
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

export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "is_empty"
  | "is_not_empty"
  | "greater_than"
  | "less_than"
  /** @deprecated Use is_not_empty instead. */
  | "not_empty";
export type ConditionValue = string | number | boolean;

export type JsonValue = string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export interface BaseSubmissionMetadata {
  readonly [key: string]: JsonValue | undefined;
}

/** A contract or tenant-managed locale and its translation capabilities. */
export interface LocaleOption {
  /** Canonical BCP 47 locale tag. */
  readonly locale: string;
  /** Human-readable locale name. */
  readonly label: string;
  /** Whether automatic translation is allowed for this locale. Defaults to true. */
  readonly translatable?: boolean;
  /** Whether the locale may be removed from the form. Defaults to true. */
  readonly removable?: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

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

export interface FieldDisplayCondition {
  readonly fieldId: string;
  readonly operator: ConditionOperator;
  readonly value?: unknown;
}

export interface DisplayConditionGroup {
  readonly logic: "all" | "any";
  readonly conditions: readonly (FieldDisplayCondition | DisplayConditionGroup)[];
}

export interface DisplayRule {
  readonly action: "show" | "hide";
  readonly condition: DisplayConditionGroup;
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
  readonly displayRule?: DisplayRule;
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
  readonly submissionSettings?: FormSubmissionSettings;
}

export interface FormSubmissionSettings extends ExtensibleNode {
  readonly showConfirmationBeforeSubmit?: boolean;
  readonly confirmationRenderMode?: "dialog" | "inline" | "replace";
  readonly confirmButtonLabel?: string;
  readonly cancelButtonLabel?: string;
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
  readonly cycle?: readonly string[];
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

interface FormSubmissionBase extends Pick<ExtensibleNode, "translationMetadata"> {
  readonly id: string;
  readonly formId: string;
  readonly formVersion: number;
  readonly locale?: string;
  readonly values: FormValues;
  readonly submittedAt: string;
  readonly schemaRevision?: number;
}

export type FormSubmission<TMeta extends BaseSubmissionMetadata | undefined = undefined> = FormSubmissionBase &
  ([TMeta] extends [undefined] ? { readonly metadata?: BaseSubmissionMetadata } : { readonly metadata: TMeta });

export type SubmissionSaveResult<TMeta extends BaseSubmissionMetadata | undefined = undefined> =
  | {
      readonly status: "created";
      readonly submission: FormSubmission<TMeta>;
      readonly payloadHash: string;
    }
  | {
      readonly status: "duplicate";
      readonly submission: FormSubmission<TMeta>;
      readonly payloadHash: string;
    }
  | {
      readonly status: "conflict";
      readonly submissionId: string;
      readonly payloadHash: string;
      readonly existingPayloadHash: string;
    };

export interface SaveSubmissionOptions {
  /** Return a typed duplicate/conflict result instead of propagating a duplicate-key error. */
  readonly idempotent?: boolean;
  /** Re-fetch and validate the stored FormSchema before persisting. */
  readonly validateAgainstSchema?: boolean;
  /** Validate with an explicitly supplied FormSchema, Zod-compatible schema, or callback. */
  readonly validation?: FormSubmissionValidationSource;
  /** Alias for `validation` for adapters that expose a validator-oriented API. */
  readonly validator?: FormSubmissionValidationSource;
  /** Explicit schema alias for adapters that expose schema-oriented options. */
  readonly schema?: FormSubmissionValidationSource;
}

/** A submission whose persisted or transport representation always includes a locale. */
export interface StrictFormSubmission<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata>
  extends Omit<FormSubmissionBase, "locale" | "values"> {
  readonly values: Readonly<Record<string, unknown>>;
  readonly locale: string;
  readonly metadata: TMeta;
}

/** Clean network and persistence representation of a form submission. */
export interface FormSubmissionWire<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata> {
  readonly id: string;
  readonly formId: string;
  readonly formVersion: number;
  readonly values: Readonly<Record<string, unknown>>;
  readonly locale?: string;
  readonly metadata: TMeta;
  readonly submittedAt: string;
  readonly schemaRevision?: number;
}

/** Strict wire representation used by integrations that require a locale. */
export interface StrictFormSubmissionWire<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata>
  extends Omit<FormSubmissionWire<TMeta>, "locale"> {
  readonly locale: string;
}

export interface CreateSubmissionInput<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata> {
  readonly id?: string;
  readonly idFormat?: "uuid" | "ulid" | "custom";
  readonly formId: string;
  readonly formVersion: number;
  readonly answers: Record<string, unknown>;
  readonly metadata: TMeta;
  readonly submittedAt?: string;
  readonly schemaRevision?: number;
}

export interface TranslationAdapter {
  /** Return null or undefined when the key cannot be resolved by the adapter. */
  translate(key: string, locale: string, params?: Readonly<Record<string, string | number>>): string | undefined | null;
}

export interface AsyncTranslationAdapter {
  translateText(text: string, targetLocale: string, sourceLocale?: string, signal?: AbortSignal): Promise<string>;
  translateBatch(
    texts: readonly string[],
    targetLocale: string,
    sourceLocale?: string,
    signal?: AbortSignal
  ): Promise<readonly string[]>;
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

/** Metadata-typed submission contract for application-owned storage adapters. */
export interface TypedStorageAdapter<TMeta extends BaseSubmissionMetadata> {
  saveSubmission(submission: FormSubmission<TMeta>): Promise<void>;
  listSubmissions(
    formId: string,
    formVersion?: number,
    options?: SubmissionQueryOptions
  ): Promise<readonly FormSubmission<TMeta>[]>;
  clearResponses?(formId: string): Promise<void>;
  clear(): Promise<void>;
}

/** Metadata-typed form storage contract. */
export interface TypedFormStorageAdapter<TMeta extends BaseSubmissionMetadata> extends TypedStorageAdapter<TMeta> {
  saveSchema(schema: FormSchema): Promise<void>;
  getSchema(formId: string, formVersion: number): Promise<FormSchema | null>;
  listSchemas(): Promise<readonly FormSchema[]>;
  deleteSchema(formId: string, formVersion: number): Promise<void>;
  deleteSubmission(submissionId: string): Promise<void>;
}

/** Metadata-typed query options for paged storage. */
export interface TypedSubmissionPageQueryOptions<TMeta extends BaseSubmissionMetadata | undefined> {
  readonly version?: number;
  readonly cursor?: string;
  readonly pageSize?: number;
  readonly since?: string;
  readonly until?: string;
  /** @deprecated Use `since`. */
  readonly fromSubmittedAt?: string;
  /** @deprecated Use `until`. */
  readonly toSubmittedAt?: string;
  readonly locale?: string;
  readonly filter?: SubmissionFilter | ((submission: FormSubmission<TMeta>) => boolean);
  readonly metadataFilters?: Readonly<Record<string, JsonValue>>;
}

/** Metadata-typed page returned by application-owned paged storage. */
export interface TypedSubmissionPage<TMeta extends BaseSubmissionMetadata | undefined> {
  readonly items: readonly FormSubmission<TMeta>[];
  readonly nextCursor?: string;
  readonly hasMore: boolean;
}

/** Metadata-typed paged form storage contract. */
export interface TypedPagedSubmissionStorageAdapter<TMeta extends BaseSubmissionMetadata>
  extends TypedFormStorageAdapter<TMeta> {
  listSubmissionPage(
    formId: string,
    options?: TypedSubmissionPageQueryOptions<TMeta>
  ): Promise<TypedSubmissionPage<TMeta>>;
}

/**
 * Common submission-only contract for storage adapters that support typed saves and cursor paging.
 * MongoDB and Azure Table implementations expose this same surface so callers do not need an
 * adapter-specific branch.
 */
export interface UnifiedSubmissionStorageAdapter<TMeta extends BaseSubmissionMetadata | undefined = undefined> {
  saveSubmission(
    submission: FormSubmission<TMeta>,
    options?: SaveSubmissionOptions
  ): Promise<undefined | SubmissionSaveResult<TMeta>>;
  listSubmissionPage(
    formId: string,
    options?: TypedSubmissionPageQueryOptions<TMeta>
  ): Promise<TypedSubmissionPage<TMeta>>;
  listTextAnswerPage(
    formId: string,
    fieldIdOrOptions?: string | TextAnswerPageQueryOptions,
    options?: TextAnswerPageQueryOptions
  ): Promise<TypedTextAnswerPage<TMeta>>;
  aggregateResponses(schema: FormSchema, options?: TypedSubmissionPageQueryOptions<TMeta>): Promise<FormAnalytics>;
  exportResponsesToCsv(schema: FormSchema, options?: StorageSubmissionExportOptions<TMeta>): Promise<string>;
  validateSubmission(submission: FormSubmission<TMeta>, source?: FormSubmissionValidationSource<TMeta>): Promise<void>;
}

export interface StorageSubmissionExportOptions<TMeta extends BaseSubmissionMetadata | undefined = undefined>
  extends Omit<MetadataCsvExportOptions<BaseSubmissionMetadata>, "customColumns" | "includeMetadataFields"> {
  readonly query?: TypedSubmissionPageQueryOptions<TMeta>;
  readonly customColumns?: TMeta extends BaseSubmissionMetadata
    ? MetadataCsvExportOptions<TMeta>["customColumns"]
    : MetadataCsvExportOptions<BaseSubmissionMetadata>["customColumns"];
  readonly includeMetadataFields?: TMeta extends BaseSubmissionMetadata
    ? MetadataCsvExportOptions<TMeta>["includeMetadataFields"]
    : MetadataCsvExportOptions<BaseSubmissionMetadata>["includeMetadataFields"];
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

/** Text-answer page retaining the metadata type of the source submission. */
export interface TypedTextAnswerItem<TMeta extends BaseSubmissionMetadata | undefined>
  extends Omit<TextAnswerItem, "metadata"> {
  readonly metadata?: [TMeta] extends [undefined] ? Readonly<Record<string, JsonValue>> : TMeta;
}

export interface TypedTextAnswerPage<TMeta extends BaseSubmissionMetadata | undefined> {
  readonly items: readonly TypedTextAnswerItem<TMeta>[];
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
  /** Optional target schema for adapters that do not use a version record. */
  readonly schema?: FormSchema;
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
export type { BuilderTranslationKey } from "./i18n/keys";

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
