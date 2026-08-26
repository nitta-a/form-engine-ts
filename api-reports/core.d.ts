type Result<T, E> = {
    readonly success: true;
    readonly value: T;
} | {
    readonly success: false;
    readonly error: E;
};
type FormVersionStatus = "draft" | "published" | "archived";
interface FormVersionRecord extends ExtensibleNode {
    readonly formId: string;
    readonly version: number;
    readonly status: FormVersionStatus;
    readonly schema: FormSchema;
    readonly revision: number;
    readonly createdFromVersion?: number;
    readonly createdAt: string;
    readonly publishedAt?: string;
    readonly archivedAt?: string;
}
interface FormVersionState {
    readonly formId: string;
    readonly draftVersion?: number;
    readonly publishedVersion?: number;
    readonly nextVersion: number;
    readonly revision: number;
}
interface VersionTransitionEvent {
    readonly type: "draft.created" | "draft.deleted" | "version.published" | "version.archived";
    readonly formId: string;
    readonly fromRevision: number;
    readonly toRevision: number;
    readonly affectedVersions: readonly number[];
    readonly occurredAt: string;
}
type VersionTransitionError = {
    readonly type: "draft_already_exists";
    readonly currentDraftVersion: number;
} | {
    readonly type: "draft_not_found";
} | {
    readonly type: "missing_published_record";
    readonly expectedVersion: number;
} | {
    readonly type: "form_id_mismatch";
} | {
    readonly type: "invalid_published_status";
} | {
    readonly type: "unexpected_published_record";
} | {
    readonly type: "revision_conflict";
    readonly expectedRevision: number;
    readonly actualRevision: number;
} | {
    readonly type: "invalid_source_version";
    readonly requestedVersion: number;
    readonly publishedVersion?: number;
} | {
    readonly type: "version_immutable";
    readonly status: FormVersionStatus;
} | {
    readonly type: "max_version_exceeded";
    readonly max: number;
} | {
    readonly type: "validation_failed";
    readonly issues: readonly SchemaIssue[];
};
interface CloneVersionOptions {
    readonly maxVersions?: number;
    readonly expectedRevision?: number;
    readonly clonedAt?: string;
    readonly metadata?: Readonly<Record<string, JsonValue>>;
    /** Additional known published versions that may be used as a clone source. */
    readonly allowedSourceVersions?: readonly number[];
}
interface PublishDraftOptions {
    readonly expectedRevision?: number;
    readonly currentPublishedRecord?: FormVersionRecord;
    readonly validate?: (schema: FormSchema) => boolean | Promise<boolean> | readonly SchemaIssue[] | Promise<readonly SchemaIssue[]>;
    readonly publishedAt?: string;
    /** @deprecated Use publishedAt. */
    readonly timestamp?: string;
}
interface DeleteDraftOptions {
    readonly expectedRevision?: number;
    readonly deletedAt?: string;
}
interface PublishDraftResult {
    readonly nextState: FormVersionState;
    readonly publishedRecord: FormVersionRecord;
    readonly archivedRecords: readonly FormVersionRecord[];
    /** @deprecated Read archivedRecords instead. */
    readonly archivedVersion?: number;
}
declare function cloneVersionToDraft(state: FormVersionState, sourceSchema: FormSchema, options?: CloneVersionOptions): Result<{
    readonly nextState: FormVersionState;
    readonly draftSchema: FormSchema;
}, VersionTransitionError>;
declare function createCloneTransitionPlan(state: FormVersionState, sourceRecord: FormVersionRecord, options?: CloneVersionOptions): Result<{
    readonly nextState: FormVersionState;
    readonly plan: VersionTransitionPlan;
}, VersionTransitionError>;
declare function publishDraft(state: FormVersionState, draftSchema: FormSchema, options?: PublishDraftOptions): Promise<Result<PublishDraftResult, VersionTransitionError>>;
declare function createPublishTransitionPlan(state: FormVersionState, draftRecord: FormVersionRecord, options?: PublishDraftOptions): Promise<Result<{
    readonly nextState: FormVersionState;
    readonly plan: VersionTransitionPlan;
}, VersionTransitionError>>;
declare function deleteDraft(state: FormVersionState, options?: DeleteDraftOptions): Result<{
    readonly nextState: FormVersionState;
}, VersionTransitionError>;
declare function createDeleteDraftTransitionPlan(state: FormVersionState, draftRecord: FormVersionRecord, options?: DeleteDraftOptions): Result<{
    readonly nextState: FormVersionState;
    readonly plan: VersionTransitionPlan;
}, VersionTransitionError>;
declare function assertVersionMutable(status: FormVersionStatus): void;

type FieldType = "text" | "textarea" | "number" | "rating" | "select" | "multi-select" | "checkbox" | "radio";
interface FormPolicy {
    readonly allowedFieldTypes?: readonly FieldType[];
    readonly maxFields?: number;
    readonly maxOptionsPerField?: number;
    readonly requiredLocales?: readonly string[];
    readonly allowedLocales?: readonly string[];
    readonly maxLocales?: number;
    readonly maxTextLength?: number;
    readonly maxSchemaBytes?: number;
}
type ConditionOperator = "equals" | "not_equals" | "contains" | "not_empty";
type ConditionValue = string | number | boolean;
type JsonValue = string | number | boolean | null | readonly JsonValue[] | {
    readonly [key: string]: JsonValue;
};
/** Arbitrary, JSON-serializable data preserved by every form-engine operation. */
interface ExtensibleNode {
    readonly metadata?: Readonly<Record<string, JsonValue>>;
    /** Locale -> translated property -> metadata created for that translation. */
    readonly translationMetadata?: Readonly<Record<string, Readonly<Record<string, Readonly<Record<string, JsonValue>>>>>>;
}
interface DisplayCondition {
    readonly questionId: string;
    readonly operator: ConditionOperator;
    readonly value?: ConditionValue;
}
interface LocalizedText {
    readonly title?: string;
    readonly description?: string;
    readonly completionMessage?: string;
}
type SchemaTranslations = Readonly<Record<string, LocalizedText>>;
type ValidationCode = "required" | "invalid_type" | "min_length" | "max_length" | "pattern" | "min" | "max" | "step" | "invalid_option" | "min_selections" | "max_selections" | "unknown_field";
interface FieldOption extends ExtensibleNode {
    readonly id: string;
    readonly label: string;
    readonly translations?: Readonly<Record<string, string>>;
}
interface BaseField extends ExtensibleNode {
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
interface TextField extends BaseField {
    readonly type: "text" | "textarea";
    readonly placeholderKey?: string;
    readonly minLength?: number;
    readonly maxLength?: number;
    readonly pattern?: string;
}
interface NumberField extends BaseField {
    readonly type: "number";
    readonly placeholderKey?: string;
    readonly min?: number;
    readonly max?: number;
    readonly step?: number;
}
interface RatingField extends BaseField {
    readonly type: "rating";
    readonly min?: number;
    readonly max?: number;
}
interface SelectField extends BaseField {
    readonly type: "select" | "radio";
    readonly options: readonly FieldOption[];
}
interface MultiSelectField extends BaseField {
    readonly type: "multi-select";
    readonly options: readonly FieldOption[];
    readonly minSelections?: number;
    readonly maxSelections?: number;
}
interface CheckboxField extends BaseField {
    readonly type: "checkbox";
}
type FormField = TextField | NumberField | RatingField | SelectField | MultiSelectField | CheckboxField;
interface FormPage extends ExtensibleNode {
    readonly id: string;
    readonly title?: string;
    readonly description?: string;
    readonly questionIds: readonly string[];
    readonly displayCondition?: DisplayCondition;
    readonly translations?: SchemaTranslations;
}
interface FormSchema extends ExtensibleNode {
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
type FormValue = string | number | boolean | readonly string[] | undefined;
type FormValues = Readonly<Record<string, FormValue>>;
interface SchemaIssue {
    readonly path: string;
    readonly code: string;
    readonly message: string;
}
type SchemaValidationResult = {
    readonly valid: true;
    readonly value: FormSchema;
    readonly issues: readonly [];
} | {
    readonly valid: false;
    readonly issues: readonly SchemaIssue[];
};
interface ValidationIssue {
    readonly fieldId: string;
    readonly code: ValidationCode;
    readonly messageKey: string;
    readonly params: Readonly<Record<string, string | number>>;
}
type ValidationError = ValidationIssue;
type AnswerValidationResult = {
    readonly valid: true;
    readonly issues: readonly [];
} | {
    readonly valid: false;
    readonly issues: readonly ValidationIssue[];
};
interface FormSubmission extends ExtensibleNode {
    readonly id: string;
    readonly formId: string;
    readonly formVersion: number;
    readonly locale: string;
    readonly values: FormValues;
    readonly submittedAt: string;
}
interface TranslationAdapter {
    translate(key: string, locale: string, params?: Readonly<Record<string, string | number>>): string;
}
interface AsyncTranslationAdapter {
    translateText(text: string, targetLocale: string, sourceLocale?: string): Promise<string>;
    translateBatch(texts: readonly string[], targetLocale: string, sourceLocale?: string): Promise<readonly string[]>;
}
interface SubmissionQueryOptions {
    readonly since?: string;
    readonly until?: string;
}
interface StorageAdapter {
    saveSubmission(submission: FormSubmission): Promise<void>;
    listSubmissions(formId: string, formVersion?: number, options?: SubmissionQueryOptions): Promise<readonly FormSubmission[]>;
    clearResponses?(formId: string): Promise<void>;
    clear(): Promise<void>;
}
interface FormStorageAdapter extends StorageAdapter {
    saveSchema(schema: FormSchema): Promise<void>;
    getSchema(formId: string, formVersion: number): Promise<FormSchema | null>;
    listSchemas(): Promise<readonly FormSchema[]>;
    deleteSchema(formId: string, formVersion: number): Promise<void>;
    deleteSubmission(submissionId: string): Promise<void>;
}
interface SubmissionPageQueryOptions {
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
interface TextAnswerPageQueryOptions extends SubmissionPageQueryOptions {
    readonly fieldIds?: readonly string[];
}
type SubmissionFilter = {
    readonly op: "eq";
    readonly path: string;
    readonly value: JsonValue;
} | {
    readonly op: "in";
    readonly path: string;
    readonly values: readonly JsonValue[];
} | {
    readonly op: "range";
    readonly path: string;
    readonly from?: JsonValue;
    readonly to?: JsonValue;
} | {
    readonly op: "exists";
    readonly path: string;
    readonly value: boolean;
} | {
    readonly op: "and";
    readonly filters: readonly SubmissionFilter[];
} | {
    readonly op: "or";
    readonly filters: readonly SubmissionFilter[];
};
interface SubmissionPage {
    readonly items: readonly FormSubmission[];
    readonly nextCursor?: string;
    readonly hasMore: boolean;
}
interface PagedSubmissionStorageAdapter extends FormStorageAdapter {
    listSubmissionPage(formId: string, options?: SubmissionPageQueryOptions): Promise<SubmissionPage>;
    listTextAnswerPage?(formId: string, fieldIdOrOptions?: string | TextAnswerPageQueryOptions, options?: TextAnswerPageQueryOptions): Promise<TextAnswerPage>;
}
interface TextAnswerItem {
    readonly responseId: string;
    readonly formId: string;
    readonly formVersion: number;
    readonly fieldId: string;
    readonly text: string;
    readonly locale?: string;
    readonly submittedAt: string;
    readonly metadata?: Readonly<Record<string, JsonValue>>;
}
interface TextAnswerPage {
    readonly items: readonly TextAnswerItem[];
    readonly nextCursor?: string;
    readonly hasMore: boolean;
}
interface VersionTransitionPlan {
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
type StorageCommitError = {
    readonly type: "revision_conflict";
    readonly expectedRevision: number;
    readonly actualRevision?: number;
} | {
    readonly type: "draft_already_exists";
    readonly currentDraftVersion: number;
} | {
    readonly type: "transaction_unsupported";
} | {
    readonly type: "invalid_transition";
    readonly message: string;
} | {
    readonly type: "storage_error";
    readonly cause: unknown;
};
interface VersionedFormStorageAdapter extends FormStorageAdapter {
    getVersionState(formId: string): Promise<FormVersionState | null>;
    getVersionRecord(formId: string, version: number): Promise<FormVersionRecord | null>;
    listVersionRecords(formId: string): Promise<readonly FormVersionRecord[]>;
    commitVersionTransition(plan: VersionTransitionPlan): Promise<Result<{
        readonly success: true;
    }, StorageCommitError>>;
}
interface BaseQuestionAggregate {
    readonly fieldId: string;
    readonly answeredCount: number;
    readonly unansweredCount: number;
}
interface TextQuestionAggregate extends BaseQuestionAggregate {
    readonly kind: "text" | "textarea";
}
interface NumberQuestionAggregate extends BaseQuestionAggregate {
    readonly kind: "number" | "rating";
    readonly minimum: number | null;
    readonly maximum: number | null;
    readonly average: number | null;
    readonly total: number;
}
interface OptionAggregate {
    readonly id: string;
    readonly count: number;
    readonly percentageOfSubmissions: number;
}
interface ChoiceQuestionAggregate extends BaseQuestionAggregate {
    readonly kind: "select" | "radio" | "multi-select";
    readonly options: readonly OptionAggregate[];
}
interface CheckboxQuestionAggregate extends BaseQuestionAggregate {
    readonly kind: "checkbox";
    readonly trueCount: number;
    readonly falseCount: number;
    readonly truePercentageOfSubmissions: number;
    readonly falsePercentageOfSubmissions: number;
}
type QuestionAggregate = TextQuestionAggregate | NumberQuestionAggregate | ChoiceQuestionAggregate | CheckboxQuestionAggregate;
interface FormAnalytics {
    readonly formId: string;
    readonly formVersion: number;
    readonly submissionCount: number;
    readonly questions: readonly QuestionAggregate[];
}
type Question = FormField;
type QuestionType = FieldType;
type ChoiceOption = FieldOption;
/** Translation keys reserved for the form builder UI. */
type BuilderTranslationKey = `builder.${string}`;
interface FieldTypeDefinition {
    readonly type: QuestionType;
    readonly labelKey: BuilderTranslationKey;
    readonly defaultLabel: string;
    readonly category: "text" | "choice" | "number" | "advanced";
    readonly hasOptions: boolean;
}
interface FormResponse extends ExtensibleNode {
    readonly responseId: string;
    readonly formId: string;
    readonly formVersion?: number;
    readonly sourceLocale?: string;
    readonly answers: Readonly<Record<string, unknown>>;
    readonly submittedAt: string;
}
interface CrossTabulationResult {
    readonly rowQuestionId: string;
    readonly colQuestionId: string;
    readonly matrix: Readonly<Record<string, Readonly<Record<string, number>>>>;
    readonly rowTotals: Readonly<Record<string, number>>;
    readonly colTotals: Readonly<Record<string, number>>;
    readonly grandTotal: number;
}

interface ChoiceDistributionEntry {
    readonly count: number;
    readonly percentage: number;
}
interface NumericSummary {
    readonly average: number | null;
    readonly min: number | null;
    readonly max: number | null;
    readonly total: number;
}
declare function calculateChoiceDistribution(responses: readonly FormSubmission[], questionId: string): Record<string, ChoiceDistributionEntry>;
declare function calculateNumericSummary(responses: readonly FormSubmission[], questionId: string): NumericSummary;
declare function calculateCrossTabulation(responses: readonly FormSubmission[], rowQuestionId: string, colQuestionId: string): CrossTabulationResult;
declare function aggregateResponses(schema: FormSchema, submissions: readonly FormSubmission[]): FormAnalytics;
type AccumulatorResponse = FormSubmission | FormResponse;
type AccumulatorSkipReason = "form_id_mismatch" | "version_mismatch" | "invalid_structure";
interface AccumulatorReport {
    readonly processedCount: number;
    readonly skippedCount: number;
    readonly skipReasons: readonly {
        readonly responseId: string;
        readonly reason: AccumulatorSkipReason;
    }[];
}
interface ResponseAccumulator {
    add(submission: AccumulatorResponse): {
        readonly success: boolean;
        readonly skipped?: boolean;
        readonly error?: string;
    };
    addMany(submissions: Iterable<AccumulatorResponse>): AccumulatorReport;
    merge(other: ResponseAccumulator): ResponseAccumulator;
    finalize(): FormAnalytics;
    getReport(): AccumulatorReport;
}
interface ResponseAccumulatorOptions {
    readonly mode?: "strict" | "lenient";
}
declare function createResponseAccumulator(schema: FormSchema, options?: ResponseAccumulatorOptions): ResponseAccumulator;
declare function escapeCsvCell(value: string | number | boolean | null | undefined, neutralizeFormulas?: boolean): string;
interface CsvExportOptions {
    readonly withBom?: boolean;
    readonly neutralizeFormulas?: boolean;
}
interface CsvColumnDef {
    readonly header: string;
    readonly getValue: (context: CsvColumnContext) => string | number | boolean | null | undefined | Promise<string | number | boolean | null | undefined>;
}
interface CsvColumnContext extends FormResponse {
    readonly submission: FormResponse;
    readonly formVersion: number;
    readonly schema: FormSchema;
}
interface StreamCsvOptions extends CsvExportOptions {
    readonly columns?: readonly CsvColumnDef[];
    readonly includeDefaultColumns?: boolean;
}
declare function exportResponsesToCsvStream(schema: FormSchema, submissions: AsyncIterable<AccumulatorResponse>, options?: StreamCsvOptions): AsyncIterable<string>;
interface NodeWritableStream {
    write(chunk: Uint8Array): boolean;
    once(event: "drain", listener: () => void): unknown;
    once(event: "error", listener: (error: Error) => void): unknown;
    removeListener(event: "drain", listener: () => void): unknown;
    removeListener(event: "error", listener: (error: Error) => void): unknown;
    end(callback: () => void): unknown;
}
declare function pipeResponsesToCsvStream(schema: FormSchema, submissions: AsyncIterable<AccumulatorResponse>, writable: WritableStream<Uint8Array> | NodeWritableStream, options?: StreamCsvOptions): Promise<void>;
declare function exportResponsesToCsv(schema: FormSchema, responses: readonly FormSubmission[], options?: CsvExportOptions): string;

type FormEventType = "response.submitted" | "schema.updated";
interface FormEvent<T = unknown> {
    readonly id: string;
    readonly type: FormEventType;
    readonly formId: string;
    readonly timestamp: string;
    readonly payload: T;
}
interface WebhookConfig {
    readonly url: string;
    readonly secret?: string;
    readonly headers?: Readonly<Record<string, string>>;
    readonly timeoutMs?: number;
}
interface WebhookDispatchResult {
    readonly success: boolean;
    readonly status?: number;
    readonly error?: string;
}
declare function dispatchWebhook<T>(event: FormEvent<T>, config: WebhookConfig, fetchImpl?: typeof fetch): Promise<WebhookDispatchResult>;

/**
 * Changes only the type-specific shape of a field. Authoring content and extension
 * data are deliberately retained so UI adapters cannot accidentally discard them.
 */
declare function transformFieldType(field: FormField, nextType: QuestionType): FormField;

declare const DEFAULT_FIELD_TYPE_DEFINITIONS: readonly FieldTypeDefinition[];

interface PaginationIteratorOptions {
    readonly pageSize?: number;
    readonly maxItems?: number;
    readonly signal?: AbortSignal;
}
declare function iterateSubmissionPages(adapter: PagedSubmissionStorageAdapter, formId: string, queryOptions?: SubmissionPageQueryOptions, options?: PaginationIteratorOptions): AsyncIterable<readonly FormResponse[]>;
interface SubmissionCursorValue {
    readonly submittedAt: string;
    readonly responseId: string;
}
interface TextAnswerCursorValue {
    readonly responseId: string;
    readonly fieldId: string;
}
declare function encodeSubmissionCursor(value: SubmissionCursorValue): string;
declare function decodeSubmissionCursor(cursor: string): SubmissionCursorValue;
declare function encodeTextAnswerCursor(value: TextAnswerCursorValue): string;
declare function decodeTextAnswerCursor(cursor: string): TextAnswerCursorValue;
declare function normalizeSubmissionPageSize(pageSize: number | undefined, fallback?: number): number;
declare function jsonValuesEqual(left: JsonValue | undefined, right: JsonValue | undefined): boolean;
declare function matchesSubmissionFilter(submission: FormSubmission, filter: SubmissionFilter): boolean;
declare function matchesSubmissionPageFilters(submission: FormSubmission, options: Pick<SubmissionPageQueryOptions, "filter" | "metadataFilters">): boolean;

interface CollectedLocales {
    readonly defaultLocale?: string;
    readonly supportedLocales: readonly string[];
    readonly translationLocales: ReadonlySet<string>;
    readonly allUniqueLocales: ReadonlySet<string>;
    /** Every translation or translation-metadata locale and the schema paths where it occurs. */
    readonly translationLocalePaths: ReadonlyMap<string, readonly string[]>;
}
/** Collects locale registrations and every locale key used by translations or translation metadata. */
declare function collectSchemaLocales(schema: FormSchema): CollectedLocales;

type SchemaStructureIssueType = "dangling_condition_reference" | "duplicate_question_id" | "duplicate_choice_id" | "self_condition_reference" | "cyclic_condition_reference";
interface SchemaStructureIssue {
    readonly type: SchemaStructureIssueType;
    readonly questionId: string;
    readonly choiceId?: string;
    readonly message: string;
}
declare function validateSchemaStructure(schema: FormSchema): SchemaStructureIssue[];
declare function sanitizeSchema(schema: FormSchema): FormSchema;

interface ValidateFormSchemaOptions {
    readonly policy?: FormPolicy;
}
declare function validateFormSchema(input: unknown, options?: ValidateFormSchemaOptions): SchemaValidationResult;
declare function assertValidFormSchema(input: unknown): asserts input is FormSchema;

interface CreateSubmissionOptions extends ExtensibleNode {
    readonly id: string;
    readonly locale: string;
    readonly submittedAt: string;
}
declare function createSubmission(schema: FormSchema, values: FormValues, options: CreateSubmissionOptions): FormSubmission;

interface TranslationSlot {
    readonly kind: "form" | "page" | "field" | "option";
    readonly nodeId: string;
    readonly property: "title" | "description" | "label" | "completionMessage";
    readonly locale: string;
    readonly sourceText: string;
    readonly existingText?: string;
    readonly nodeMetadata?: Readonly<Record<string, JsonValue>>;
    readonly existingTranslationMetadata?: Readonly<Record<string, JsonValue>>;
    /** @deprecated Use nodeMetadata instead. */
    readonly metadata?: Readonly<Record<string, JsonValue>>;
}
interface PopulateTranslationOptions {
    readonly overwrite?: "missing-only" | "all";
    readonly shouldOverwrite?: (slot: TranslationSlot) => boolean;
    readonly createMetadata?: (slot: TranslationSlot, translatedText: string) => Readonly<Record<string, JsonValue>>;
    /** Applies locale admission and count limits before the adapter is called. */
    readonly policy?: Pick<FormPolicy, "allowedLocales" | "maxLocales">;
}
interface TranslationReport {
    readonly updatedSlots: readonly TranslationSlot[];
    readonly skippedSlots: readonly TranslationSlot[];
}
declare function resolveLocalizedSchema(schema: FormSchema, targetLocale?: string): FormSchema;
declare function populateSchemaTranslations(schema: FormSchema, targetLocales: readonly string[], adapter: AsyncTranslationAdapter, options?: PopulateTranslationOptions): Promise<{
    readonly schema: FormSchema;
    readonly report: TranslationReport;
}>;
declare function resolveFormTranslation(schema: FormSchema, adapter: AsyncTranslationAdapter, targetLocale: string, sourceLocale?: string): Promise<FormSchema>;

declare function validateAnswers(schema: FormSchema, values: FormValues): AnswerValidationResult;
declare function validatePageAnswers(schema: FormSchema, pageIndex: number, values: FormValues): AnswerValidationResult;

declare function isQuestionVisible(question: FormField, currentAnswers: Readonly<Record<string, unknown>>): boolean;
declare function isDisplayConditionSatisfied(condition: DisplayCondition | undefined, currentAnswers: Readonly<Record<string, unknown>>): boolean;
declare function calculatePageVisibility(schema: FormSchema, currentAnswers: Readonly<Record<string, unknown>>): Readonly<Record<string, boolean>>;
declare function calculateFieldVisibility(schema: FormSchema, currentAnswers: Readonly<Record<string, unknown>>): Readonly<Record<string, boolean>>;
declare function selectVisibleAnswers(schema: FormSchema, currentAnswers: FormValues): FormValues;

export { type AccumulatorReport, type AccumulatorResponse, type AccumulatorSkipReason, type AnswerValidationResult, type AsyncTranslationAdapter, type BaseField, type BuilderTranslationKey, type CheckboxField, type CheckboxQuestionAggregate, type ChoiceDistributionEntry, type ChoiceOption, type ChoiceQuestionAggregate, type CloneVersionOptions, type CollectedLocales, type ConditionOperator, type ConditionValue, type CreateSubmissionOptions, type CrossTabulationResult, type CsvColumnContext, type CsvColumnDef, type CsvExportOptions, DEFAULT_FIELD_TYPE_DEFINITIONS, type DeleteDraftOptions, type DisplayCondition, type ExtensibleNode, type FieldOption, type FieldType, type FieldTypeDefinition, type FormAnalytics, type FormEvent, type FormEventType, type FormField, type FormPage, type FormPolicy, type FormResponse, type FormSchema, type FormStorageAdapter, type FormSubmission, type FormValue, type FormValues, type FormVersionRecord, type FormVersionState, type FormVersionStatus, type JsonValue, type LocalizedText, type MultiSelectField, type NodeWritableStream, type NumberField, type NumberQuestionAggregate, type NumericSummary, type OptionAggregate, type PagedSubmissionStorageAdapter, type PaginationIteratorOptions, type PopulateTranslationOptions, type PublishDraftOptions, type PublishDraftResult, type Question, type QuestionAggregate, type QuestionType, type RatingField, type ResponseAccumulator, type ResponseAccumulatorOptions, type Result, type SchemaIssue, type SchemaStructureIssue, type SchemaStructureIssueType, type SchemaTranslations, type SchemaValidationResult, type SelectField, type StorageAdapter, type StorageCommitError, type StreamCsvOptions, type SubmissionCursorValue, type SubmissionFilter, type SubmissionPage, type SubmissionPageQueryOptions, type SubmissionQueryOptions, type TextAnswerCursorValue, type TextAnswerItem, type TextAnswerPage, type TextAnswerPageQueryOptions, type TextField, type TextQuestionAggregate, type TranslationAdapter, type TranslationReport, type TranslationSlot, type ValidateFormSchemaOptions, type ValidationCode, type ValidationError, type ValidationIssue, type VersionTransitionError, type VersionTransitionEvent, type VersionTransitionPlan, type VersionedFormStorageAdapter, type WebhookConfig, type WebhookDispatchResult, aggregateResponses, assertValidFormSchema, assertVersionMutable, calculateChoiceDistribution, calculateCrossTabulation, calculateFieldVisibility, calculateNumericSummary, calculatePageVisibility, cloneVersionToDraft, collectSchemaLocales, createCloneTransitionPlan, createDeleteDraftTransitionPlan, createPublishTransitionPlan, createResponseAccumulator, createSubmission, decodeSubmissionCursor, decodeTextAnswerCursor, deleteDraft, dispatchWebhook, encodeSubmissionCursor, encodeTextAnswerCursor, escapeCsvCell, exportResponsesToCsv, exportResponsesToCsvStream, isDisplayConditionSatisfied, isQuestionVisible, iterateSubmissionPages, jsonValuesEqual, matchesSubmissionFilter, matchesSubmissionPageFilters, normalizeSubmissionPageSize, pipeResponsesToCsvStream, populateSchemaTranslations, publishDraft, resolveFormTranslation, resolveLocalizedSchema, sanitizeSchema, selectVisibleAnswers, transformFieldType, validateAnswers, validateFormSchema, validatePageAnswers, validateSchemaStructure };
