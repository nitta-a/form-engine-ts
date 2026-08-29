import { z } from 'zod';

type AggregationSkipReason = "missing_field" | "type_mismatch" | "invalid_option" | "unsupported_version" | "locale_mismatch" | "pii_unconfirmed";
interface AggregationReport {
    readonly totalProcessed: number;
    readonly aggregatedCount: number;
    readonly skippedItems: readonly {
        readonly submissionId: string;
        readonly fieldId: string;
        readonly reason: AggregationSkipReason;
    }[];
}

type KnownBuilderTranslationKey = "builder.formTitle" | "builder.formDescription" | "builder.completionMessage" | "builder.addQuestion" | "builder.actions.addField" | "builder.actions.deleteField" | "builder.actions.moveUp" | "builder.actions.moveDown" | "builder.actions.add" | "builder.actions.delete" | "builder.actions.edit" | "builder.actions.settings" | "builder.actions.translate" | "builder.actions.close" | "builder.actions.dragHandle" | "builder.fields.selectType" | "builder.fields.typeText" | "builder.fields.typeTextarea" | "builder.fields.typeNumber" | "builder.fields.typeRadio" | "builder.fields.typeCheckbox" | "builder.fields.typeSelect" | "builder.fields.typeRating" | "builder.fields.typeMultiSelect" | "builder.fieldType.text" | "builder.fieldType.textarea" | "builder.fieldType.number" | "builder.fieldType.radio" | "builder.fieldType.checkbox" | "builder.fieldType.select" | "builder.fieldType.rating" | "builder.fieldType.multi-select" | "builder.fieldTypeDescription.text" | "builder.fieldTypeDescription.textarea" | "builder.fieldTypeDescription.number" | "builder.fieldTypeDescription.radio" | "builder.fieldTypeDescription.checkbox" | "builder.fieldTypeDescription.select" | "builder.fieldTypeDescription.rating" | "builder.fieldTypeDescription.multi-select" | "builder.fieldCategory.text" | "builder.fieldCategory.choice" | "builder.fieldCategory.number" | "builder.fieldCategory.advanced" | "builder.required" | "builder.options" | "builder.localization.title" | "builder.localization" | "builder.localization.addLocale" | "builder.localization.selectLocaleToAdd" | "builder.localization.defaultLocale" | "builder.localization.translateAll" | "builder.localization.noLocalesConfigured" | "builder.localization.localesConfiguredSummary" | "builder.localization.allLocalesAdded" | "builder.localization.maxLocalesReached" | "builder.submissionSettings.title" | "builder.submissionSettings.showConfirmation" | "builder.submissionSettings.renderMode" | "builder.formBuilder" | "builder.basicSettings" | "builder.description" | "builder.moveUp" | "builder.moveDown" | "builder.delete" | "builder.deleteAction" | "builder.questionTitle" | "builder.questionTitlePlaceholder" | "builder.newQuestionTitle" | "builder.type" | "builder.minimum" | "builder.maximum" | "builder.minimumLength" | "builder.maximumLength" | "builder.pattern" | "builder.step" | "builder.optionLabel" | "builder.optionLabelPlaceholder" | "builder.newOptionLabel" | "builder.remove" | "builder.addOption" | "builder.displayCondition" | "builder.alwaysVisible" | "builder.conditionOperator" | "builder.conditionValue" | "builder.conditionTrue" | "builder.conditionFalse" | "builder.pages" | "builder.enablePages" | "builder.addPage" | "builder.newPage" | "builder.pageTitle" | "builder.pageDescription" | "builder.pageQuestion" | "builder.questionPage" | "builder.pageCondition" | "builder.unassigned" | "builder.defaultLocale" | "builder.supportedLocales" | "builder.addLocale" | "builder.editLocale" | "builder.autoTranslate" | "builder.translating" | "builder.translationLocale" | "builder.selectLocale" | "builder.selectLocaleToAdd" | "builder.translation" | "builder.translatedFormTitle" | "builder.translatedFormDescription" | "builder.translatedCompletionMessage" | "builder.translatedQuestionTitle" | "builder.translatedDescription" | "builder.translationUnavailable" | "builder.operator.equals" | "builder.operator.not_equals" | "builder.operator.contains" | "builder.operator.not_empty" | "builder.showConfirmationBeforeSubmit" | "builder.confirmationRenderMode";
type BuilderTranslationKey = KnownBuilderTranslationKey;
type RendererTranslationKey = "renderer.submitButton" | "renderer.submittingButton" | "renderer.retryButton" | "renderer.requiredField" | "renderer.alreadySubmittedTitle" | "renderer.alreadySubmittedMessage" | "renderer.serverErrorSummary" | "renderer.confirmSensitiveDataTitle" | "renderer.confirmSensitiveDataMessage" | "renderer.confirmButton" | "renderer.cancelButton" | "form.submit" | "form.submitting" | "form.back" | "form.next" | "form.step" | "form.draftRestored" | "form.submissionBlocked" | "form.confirmSensitiveData" | "form.confirmSubmission" | "form.cancelSubmission" | "form.yes" | "form.no" | "form.alreadySubmitted" | "form.submitAnother" | "validation.required" | "validation.invalidOption" | "validation.invalidType" | "validation.max" | "validation.maxLength" | "validation.maxSelections" | "validation.min" | "validation.minLength" | "validation.minSelections" | "validation.pattern" | "validation.sensitiveData" | "validation.step" | "validation.unknownField";
type TranslationWorkspaceTranslationKey = "workspace.title" | "workspace.status.missing" | "workspace.status.translated" | "workspace.status.stale" | "workspace.status.manual" | "workspace.status.manualStale" | "workspace.errors.localeNotAllowed" | "workspace.errors.maxLocalesExceeded" | "workspace.errors.readOnly" | "workspace.errors.adapterNotConfigured" | "workspace.errors.translationFailed";
type TranslationWorkspaceDetailedKey = "workspace.header.title" | "workspace.header.sourceLocale" | "workspace.header.targetLocale" | "workspace.header.translateAll" | "workspace.header.progress" | "workspace.slot.sourceText" | "workspace.slot.translatedText" | "workspace.slot.translateSingle" | "workspace.slot.revertManual" | "workspace.confirm.removeLocaleTitle" | "workspace.confirm.removeLocaleMessage" | "workspace.empty.noTargetLocales" | "workspace.empty.noSlotsToTranslate";
type FormEngineTranslationKey = KnownBuilderTranslationKey | RendererTranslationKey | TranslationWorkspaceTranslationKey | TranslationWorkspaceDetailedKey;
type FormEngineMessages = Partial<Record<FormEngineTranslationKey, string>>;

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
} | {
    readonly type: "transition_failed";
    readonly cause: unknown;
};
interface VersionTransitionContext<TDomain = unknown> {
    readonly formId: string;
    readonly fromVersion: number;
    readonly toVersion: number;
    readonly expectedRevision: number;
    readonly plan: FormVersionTransitionPlan;
    readonly domainData?: TDomain;
}
type FormVersionTransitionPlan = VersionTransitionPlan;
interface CommitVersionTransitionOptions<TDomain = unknown> {
    readonly context: VersionTransitionContext<TDomain>;
    readonly beforeTransition?: (context: VersionTransitionContext<TDomain>) => Promise<TDomain | void> | TDomain | void;
    readonly afterTransition?: (context: VersionTransitionContext<TDomain> & {
        readonly nextRevision: number;
    }) => Promise<void> | void;
    readonly persistAdapter: (params: {
        readonly formId: string;
        readonly targetVersion: number;
        readonly expectedRevision: number;
        readonly schema: FormSchema;
        readonly domainData?: TDomain;
    }) => Promise<{
        readonly nextRevision: number;
    }>;
}
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
declare function applyTransitionPlan(plan: FormVersionTransitionPlan): FormSchema;
declare function commitVersionTransition<TDomain = unknown>(options: CommitVersionTransitionOptions<TDomain>): Promise<{
    readonly success: boolean;
    readonly nextRevision: number;
    readonly error?: VersionTransitionError;
}>;

type FieldType = "text" | "textarea" | "number" | "rating" | "select" | "multi-select" | "checkbox" | "radio";
type QuestionType = FieldType;
interface BaseFieldConstraintRule {
    readonly defaultRequired?: boolean;
    readonly fixedRequired?: boolean;
}
interface RatingFieldConstraintRule extends BaseFieldConstraintRule {
    readonly defaultMin?: number;
    readonly defaultMax?: number;
    readonly fixedMin?: number;
    readonly fixedMax?: number;
    readonly allowedMinRange?: readonly [number, number];
    readonly allowedMaxRange?: readonly [number, number];
}
interface TextFieldConstraintRule extends BaseFieldConstraintRule {
    readonly defaultMaxLength?: number;
    readonly maxMaxLength?: number;
}
interface ChoiceFieldConstraintRule extends BaseFieldConstraintRule {
    readonly minOptions?: number;
    readonly maxOptions?: number;
}
type FieldConstraintRule = RatingFieldConstraintRule | TextFieldConstraintRule | ChoiceFieldConstraintRule | BaseFieldConstraintRule;
interface FormPolicy {
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
type ConditionOperator = "equals" | "not_equals" | "contains" | "not_contains" | "is_empty" | "is_not_empty" | "greater_than" | "less_than"
/** @deprecated Use is_not_empty instead. */
 | "not_empty";
type ConditionValue = string | number | boolean;
type JsonValue = string | number | boolean | null | readonly JsonValue[] | {
    readonly [key: string]: JsonValue;
};
interface BaseSubmissionMetadata {
    readonly [key: string]: JsonValue | undefined;
}
/** A contract or tenant-managed locale and its translation capabilities. */
interface LocaleOption {
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
interface FieldDisplayCondition {
    readonly fieldId: string;
    readonly operator: ConditionOperator;
    readonly value?: unknown;
}
interface DisplayConditionGroup {
    readonly logic: "all" | "any";
    readonly conditions: readonly (FieldDisplayCondition | DisplayConditionGroup)[];
}
interface DisplayRule {
    readonly action: "show" | "hide";
    readonly condition: DisplayConditionGroup;
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
    readonly displayRule?: DisplayRule;
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
    readonly submissionSettings?: FormSubmissionSettings;
}
interface FormSubmissionSettings extends ExtensibleNode {
    readonly showConfirmationBeforeSubmit?: boolean;
    readonly confirmationRenderMode?: "dialog" | "inline" | "replace";
    readonly confirmButtonLabel?: string;
    readonly cancelButtonLabel?: string;
}
type FormValue = string | number | boolean | readonly string[] | undefined;
type FormValues = Readonly<Record<string, FormValue>>;
interface SchemaIssue {
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
interface FormSubmissionBase extends ExtensibleNode {
    readonly id: string;
    readonly formId: string;
    readonly formVersion: number;
    readonly locale: string;
    readonly values: FormValues;
    /** Alias used by API-facing consumers; values remains the canonical v4 field. */
    readonly answers?: Readonly<Record<string, unknown>>;
    readonly submittedAt: string;
    readonly schemaRevision?: number;
}
type FormSubmission<TMeta extends BaseSubmissionMetadata | undefined = undefined> = FormSubmissionBase & ([TMeta] extends [undefined] ? {
    readonly metadata?: BaseSubmissionMetadata;
} : {
    readonly metadata: TMeta;
});
/** Clean network and persistence representation of a form submission. */
interface FormSubmissionWire<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata> {
    readonly id: string;
    readonly formId: string;
    readonly formVersion: number;
    readonly values: Record<string, unknown>;
    readonly metadata: TMeta;
    readonly submittedAt: string;
    readonly schemaRevision?: number;
}
interface CreateSubmissionInput<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata> {
    readonly id?: string;
    readonly formId: string;
    readonly formVersion: number;
    readonly answers: Record<string, unknown>;
    readonly metadata: TMeta;
    readonly submittedAt?: string;
    readonly schemaRevision?: number;
}
interface TranslationAdapter {
    /** Return null or undefined when the key cannot be resolved by the adapter. */
    translate(key: string, locale: string, params?: Readonly<Record<string, string | number>>): string | undefined | null;
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
    /** Optional target schema for adapters that do not use a version record. */
    readonly schema?: FormSchema;
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
type ChoiceOption = FieldOption;

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
interface CsvColumnDefinition<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata> {
    readonly key: string;
    readonly header: string;
    readonly getValue: (submission: FormSubmission<TMeta>, schema: FormSchema) => string | number | boolean | null | undefined;
}
interface CsvExportOptions<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata> {
    readonly withBom?: boolean;
    readonly neutralizeFormulas?: boolean;
    /** Alias for withBom used by the public export contract. */
    readonly useBom?: boolean;
    /** Alias for neutralizeFormulas used by the public export contract. */
    readonly preventFormulaInjection?: boolean;
    readonly customColumns?: readonly CsvColumnDefinition<TMeta>[];
    readonly includePiiStatus?: boolean;
    readonly includeLocale?: boolean;
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

interface SensitiveDataFinding {
    readonly fieldId: string;
    readonly type: string;
    readonly start?: number;
    readonly end?: number;
    readonly matchedText?: string;
    readonly maskedText?: string;
}
interface PrivacyEngine {
    detect(schema: FormSchema, values: Record<string, unknown>): readonly SensitiveDataFinding[];
}
interface SubmissionValidationResult {
    readonly valid: boolean;
    readonly fieldErrors: Readonly<Record<string, string>>;
    readonly formErrors: readonly string[];
    readonly piiFindings?: readonly SensitiveDataFinding[];
}
declare function validateAnswers(schema: FormSchema, values: FormValues): AnswerValidationResult;
declare function validatePageAnswers(schema: FormSchema, pageIndex: number, values: FormValues): AnswerValidationResult;
declare function validateSubmission<TMeta extends BaseSubmissionMetadata | undefined = undefined>(schema: FormSchema, submission: FormSubmission<TMeta>, options?: {
    readonly privacyEngine?: PrivacyEngine;
}): SubmissionValidationResult;

interface FormSubmissionSerializedError {
    readonly code: "VALIDATION_FAILED" | "PII_CONFIRMATION_REQUIRED" | "SUBMISSION_BLOCKED" | "STORAGE_ERROR";
    readonly messageKey: FormEngineTranslationKey | string;
    readonly messageParams?: Readonly<Record<string, unknown>>;
    readonly fieldErrors: Readonly<Record<string, string>>;
    readonly formErrors: readonly string[];
    readonly piiFindings?: readonly SensitiveDataFinding[];
    readonly piiWarningAcknowledged?: boolean;
}
/** Error with a stable, JSON-serializable payload for RPC boundaries. */
declare class FormSubmissionError extends Error {
    readonly payload: FormSubmissionSerializedError;
    constructor(payload: FormSubmissionSerializedError);
    toJSON(): FormSubmissionSerializedError;
}

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

declare const EN_MESSAGES: Readonly<Record<FormEngineTranslationKey, string>>;

declare const JA_MESSAGES: Readonly<Record<FormEngineTranslationKey, string>>;

interface FormEngineTranslatorOptions {
    readonly locale?: string;
    readonly fallbackLocale?: string;
    readonly messages?: FormEngineMessages;
    readonly customCatalogs?: Record<string, FormEngineMessages>;
    readonly fallbackTextResolver?: (key: FormEngineTranslationKey, locale: string) => string;
}
type FormEngineTranslator = (key: FormEngineTranslationKey | string, params?: Record<string, unknown>) => string;
declare const createFormEngineTranslator: (options?: FormEngineTranslatorOptions) => FormEngineTranslator;

interface PaginationIteratorOptions {
    readonly pageSize?: number;
    readonly maxItems?: number;
    readonly signal?: AbortSignal;
}
interface SubmissionCursorPayload {
    readonly kind: "submission";
    readonly formId: string;
    readonly submittedAt: string;
    readonly id: string;
}
interface TextAnswerCursorPayload {
    readonly kind: "text_answer";
    readonly formId: string;
    readonly fieldId: string;
    readonly submittedAt: string;
    readonly submissionId: string;
}
type StorageCursor = string;
interface StorageFilterCriteria {
    readonly fieldId?: string;
    readonly fromDate?: string;
    readonly toDate?: string;
    readonly metadataFilters?: Readonly<Record<string, JsonValue>>;
}
interface PaginatedResult<T> {
    readonly items: readonly T[];
    readonly hasMore: boolean;
    readonly nextCursor?: StorageCursor;
    readonly totalScannedCount: number;
}
interface CursorPagingOptions {
    readonly pageSize: number;
    readonly cursor?: StorageCursor;
    readonly maxScanPages?: number;
}
declare function paginateWithFilter<T>(params: {
    readonly pageSize: number;
    readonly cursor?: StorageCursor;
    readonly maxScanPages?: number;
    readonly fetchPage: (rawCursor: StorageCursor | undefined, limit: number) => Promise<{
        readonly rawItems: readonly T[];
        readonly rawNextCursor?: StorageCursor;
    }>;
    readonly filterPredicate: (item: T) => boolean;
    readonly encodeCursor: (lastItem: T) => StorageCursor;
}): Promise<PaginatedResult<T>>;
declare function iterateSubmissionPages(adapter: PagedSubmissionStorageAdapter, formId: string, queryOptions?: SubmissionPageQueryOptions, options?: PaginationIteratorOptions): AsyncIterable<readonly FormResponse[]>;
interface SubmissionCursorValue {
    readonly submittedAt: string;
    readonly responseId: string;
}
declare function encodeStorageSubmissionCursor(value: SubmissionCursorPayload): StorageCursor;
declare function decodeStorageSubmissionCursor(cursor: StorageCursor): SubmissionCursorPayload;
declare function encodeStorageTextAnswerCursor(value: TextAnswerCursorPayload): StorageCursor;
declare function decodeStorageTextAnswerCursor(cursor: StorageCursor): TextAnswerCursorPayload;
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

interface SanitizeSchemaOptions {
    readonly policy?: FormPolicy;
}
type SchemaStructureIssueType = "dangling_condition_reference" | "duplicate_question_id" | "duplicate_choice_id" | "self_condition_reference" | "cyclic_condition_reference";
interface SchemaStructureIssue {
    readonly type: SchemaStructureIssueType;
    readonly questionId: string;
    readonly choiceId?: string;
    readonly message: string;
    readonly cycle?: readonly string[];
}
declare function validateSchemaStructure(schema: FormSchema): SchemaStructureIssue[];
declare function sanitizeSchema(schema: FormSchema, options?: SanitizeSchemaOptions): FormSchema;

interface ValidateFormSchemaOptions {
    readonly policy?: FormPolicy;
}
declare function validateFormSchema(input: unknown, options?: ValidateFormSchemaOptions): SchemaValidationResult;
declare function assertValidFormSchema(input: unknown): asserts input is FormSchema;

/** Runtime schema for the JSON metadata carried by a submission wire payload. */
declare const FormSubmissionMetadataSchema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
/** Runtime schema for the clean, alias-free submission wire format. */
declare const FormSubmissionWireSchema: z.ZodObject<{
    id: z.ZodString;
    formId: z.ZodString;
    formVersion: z.ZodNumber;
    values: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    metadata: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    submittedAt: z.ZodString;
    schemaRevision: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
type FormSubmissionWireSchemaType = z.infer<typeof FormSubmissionWireSchema>;

interface CreateSubmissionOptions<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata> extends ExtensibleNode {
    readonly id: string;
    readonly locale: string;
    readonly submittedAt: string;
    readonly metadata?: TMeta & Readonly<Record<string, JsonValue>>;
}
declare function toFormSubmissionWire<TMeta extends BaseSubmissionMetadata>(submission: FormSubmission<TMeta>): FormSubmissionWire<TMeta>;
declare function toFormSubmissionWire(submission: FormSubmission): FormSubmissionWire;
declare function createSubmission(schema: FormSchema, values: FormValues, options: CreateSubmissionOptions): FormSubmission;
declare function createSubmission<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata>(schema: FormSchema, values: FormValues, options: CreateSubmissionOptions<TMeta>): FormSubmission<TMeta>;
declare function createSubmission<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata>(input: CreateSubmissionInput<TMeta>): FormSubmission<TMeta>;

/**
 * Normalizes a locale string to its BCP 47 canonical form.
 *
 * Underscore-separated locale tags are accepted for compatibility with common
 * platform and user-input conventions. Invalid tags return null.
 */
declare const normalizeLocale: (rawLocale: string) => string | null;

interface TranslationProviderError {
    readonly code: "RATE_LIMIT" | "AUTH_FAILED" | "UNSUPPORTED_LANGUAGE" | "NETWORK_ERROR" | "UNKNOWN";
    readonly message: string;
    readonly retryable: boolean;
    readonly rawError?: unknown;
}
interface TranslationSlot {
    readonly kind: "form" | "page" | "field" | "option";
    readonly nodeId: string;
    readonly property: "title" | "description" | "label" | "completionMessage";
    readonly locale: string;
    readonly sourceText: string;
    readonly existingText?: string;
    readonly nodeMetadata?: Readonly<Record<string, JsonValue>>;
    readonly existingTranslationMetadata?: Readonly<Record<string, JsonValue>>;
    /** Canonical target information for workspace clients. */
    readonly target?: {
        readonly kind: "form" | "page" | "field" | "option";
        readonly id?: string;
        readonly property: "title" | "description" | "label" | "completionMessage";
    };
    readonly path?: string;
    readonly sourceTextHash?: string;
    readonly status?: TranslationStatus;
    /** @deprecated Use nodeMetadata instead. */
    readonly metadata?: Readonly<Record<string, JsonValue>>;
}
type TranslationStatus = "missing" | "translated" | "stale" | "manual" | "manual-stale";
interface CanonicalTranslationMetadata {
    readonly sourceLocale: string;
    readonly sourceTextHash: string;
    readonly translationSource: "automatic" | "manual";
    readonly translatedAt?: string;
    readonly editedAt?: string;
}
interface LegacyTranslationMetadata {
    readonly isManuallyEdited?: boolean;
    readonly translationSource?: "MANUAL" | "AUTOMATIC" | "manual" | "automatic" | string;
    readonly sourceTextHash?: string;
    readonly sourceText?: string;
    readonly sourceLocale?: string;
    readonly translatedAt?: string;
    readonly editedAt?: string;
    readonly isManual?: boolean;
    readonly [key: string]: unknown;
}
interface TranslationMigrationContext {
    /** Target locale code, for example "en" or "zh-Hans". */
    readonly locale: string;
    /** The schema's default locale. */
    readonly defaultLocale: string;
    /** JSON path of the translated property. */
    readonly path: string;
    /** Translated property name. */
    readonly property: "title" | "description" | "label" | "completionMessage";
    /** Kind of node that owns the translated property. */
    readonly nodeKind: "form" | "page" | "field" | "option";
    /** Identifier of the owning node. */
    readonly nodeId?: string;
    /** Identifier of the parent node, used for options. */
    readonly parentId?: string;
}
type TranslationMetadataMigrator = (oldMeta: unknown, sourceText: string, context: TranslationMigrationContext) => CanonicalTranslationMetadata;
interface MigrateSchemaTranslationMetadataOptions {
    /** Custom migration function used instead of the built-in legacy normalizer. */
    readonly migrator?: TranslationMetadataMigrator;
}
declare const isManualTranslationMetadata: (metadata?: LegacyTranslationMetadata | CanonicalTranslationMetadata) => boolean;
interface PopulateTranslationOptions {
    readonly overwrite?: "all" | "missing-only" | "stale-and-missing";
    readonly preserveManualTranslations?: boolean;
    readonly markStaleTranslations?: boolean;
    readonly shouldOverwrite?: (slot: TranslationSlot) => boolean;
    readonly createMetadata?: (slot: TranslationSlot, translatedText: string) => Readonly<Record<string, JsonValue>>;
    readonly isManualTranslation?: (metadata: unknown, context: {
        readonly path: string;
        readonly locale: string;
    }) => boolean;
    readonly normalizeMetadata?: (metadata: unknown, sourceText: string) => CanonicalTranslationMetadata;
    /** Applies locale admission and count limits before the adapter is called. */
    readonly policy?: Pick<FormPolicy, "allowedLocales" | "maxLocales">;
}
/** Compatibility alias for clients that used the pluralized options name. */
type PopulateTranslationsOptions = PopulateTranslationOptions;
interface TranslationReport {
    readonly updatedSlots: readonly TranslationSlot[];
    readonly skippedSlots: readonly TranslationSlot[];
    readonly staleSlots?: readonly TranslationSlot[];
    readonly skippedReasons?: Readonly<Record<string, "manual" | "unchanged" | "unsupported">>;
}
declare const computeSourceTextHash: (text: string) => string;
declare function getTranslationStatus(sourceText: string, translatedText: string | undefined, metadata: CanonicalTranslationMetadata | Readonly<Record<string, JsonValue>> | undefined): TranslationStatus;
declare const migrateSchemaTranslationMetadata: (schema: FormSchema, migratorOrOptions?: ((oldMeta: unknown, sourceText: string) => CanonicalTranslationMetadata) | TranslationMetadataMigrator | MigrateSchemaTranslationMetadataOptions) => FormSchema;
/** Removes a locale registration and every localized value and metadata entry for it. */
declare const removeLocaleFromSchema: (schema: FormSchema, localeToRemove: string) => FormSchema;
declare function collectTranslationSlots(schema: FormSchema, locale: string): readonly TranslationSlot[];
declare function resolveLocalizedSchema(schema: FormSchema, targetLocale?: string): FormSchema;
declare function populateSchemaTranslations(schema: FormSchema, targetLocales: readonly string[], adapter: AsyncTranslationAdapter, options?: PopulateTranslationOptions): Promise<{
    readonly schema: FormSchema;
    readonly report: TranslationReport;
}>;
declare function populateSchemaTranslations(schema: FormSchema, targetLocales: readonly string[], adapter: TranslationAdapter, options?: PopulateTranslationOptions): Promise<{
    readonly schema: FormSchema;
    readonly report: TranslationReport;
}>;
declare function resolveFormTranslation(schema: FormSchema, adapter: AsyncTranslationAdapter, targetLocale: string, sourceLocale?: string): Promise<FormSchema>;

declare function isDisplayConditionGroupSatisfied(group: DisplayConditionGroup, currentAnswers: Readonly<Record<string, unknown>>): boolean;
declare function isQuestionVisible(question: FormField, currentAnswers: Readonly<Record<string, unknown>>): boolean;
declare function isDisplayConditionSatisfied(condition: DisplayCondition | undefined, currentAnswers: Readonly<Record<string, unknown>>): boolean;
declare function calculatePageVisibility(schema: FormSchema, currentAnswers: Readonly<Record<string, unknown>>): Readonly<Record<string, boolean>>;
declare function calculateFieldVisibility(schema: FormSchema, currentAnswers: Readonly<Record<string, unknown>>): Readonly<Record<string, boolean>>;
declare function selectVisibleAnswers(schema: FormSchema, currentAnswers: FormValues): FormValues;

export { type AccumulatorReport, type AccumulatorResponse, type AccumulatorSkipReason, type AggregationReport, type AggregationSkipReason, type AnswerValidationResult, type AsyncTranslationAdapter, type BaseField, type BaseFieldConstraintRule, type BaseSubmissionMetadata, type BuilderTranslationKey, type CanonicalTranslationMetadata, type CheckboxField, type CheckboxQuestionAggregate, type ChoiceDistributionEntry, type ChoiceFieldConstraintRule, type ChoiceOption, type ChoiceQuestionAggregate, type CloneVersionOptions, type CollectedLocales, type CommitVersionTransitionOptions, type ConditionOperator, type ConditionValue, type CreateSubmissionInput, type CreateSubmissionOptions, type CrossTabulationResult, type CsvColumnContext, type CsvColumnDef, type CsvColumnDefinition, type CsvExportOptions, type CursorPagingOptions, DEFAULT_FIELD_TYPE_DEFINITIONS, type DeleteDraftOptions, type DisplayCondition, type DisplayConditionGroup, type DisplayRule, EN_MESSAGES, type ExtensibleNode, type FieldConstraintRule, type FieldDisplayCondition, type FieldOption, type FieldType, type FieldTypeDefinition, type FormAnalytics, type FormEngineMessages, type FormEngineTranslationKey, type FormEngineTranslator, type FormEngineTranslatorOptions, type FormEvent, type FormEventType, type FormField, type FormPage, type FormPolicy, type FormResponse, type FormSchema, type FormStorageAdapter, type FormSubmission, FormSubmissionError, FormSubmissionMetadataSchema, type FormSubmissionSerializedError, type FormSubmissionSettings, type FormSubmissionWire, FormSubmissionWireSchema, type FormSubmissionWireSchemaType, type FormValue, type FormValues, type FormVersionRecord, type FormVersionState, type FormVersionStatus, type FormVersionTransitionPlan, JA_MESSAGES, type JsonValue, type KnownBuilderTranslationKey, type LegacyTranslationMetadata, type LocaleOption, type LocalizedText, type MigrateSchemaTranslationMetadataOptions, type MultiSelectField, type NodeWritableStream, type NumberField, type NumberQuestionAggregate, type NumericSummary, type OptionAggregate, type PagedSubmissionStorageAdapter, type PaginatedResult, type PaginationIteratorOptions, type PopulateTranslationOptions, type PopulateTranslationsOptions, type PrivacyEngine, type PublishDraftOptions, type PublishDraftResult, type Question, type QuestionAggregate, type QuestionType, type RatingField, type RatingFieldConstraintRule, type RendererTranslationKey, type ResponseAccumulator, type ResponseAccumulatorOptions, type Result, type SanitizeSchemaOptions, type SchemaIssue, type SchemaStructureIssue, type SchemaStructureIssueType, type SchemaTranslations, type SchemaValidationResult, type SelectField, type SensitiveDataFinding, type StorageAdapter, type StorageCommitError, type StorageCursor, type StorageFilterCriteria, type StreamCsvOptions, type SubmissionCursorPayload, type SubmissionCursorValue, type SubmissionFilter, type SubmissionPage, type SubmissionPageQueryOptions, type SubmissionQueryOptions, type SubmissionValidationResult, type TextAnswerCursorPayload, type TextAnswerCursorValue, type TextAnswerItem, type TextAnswerPage, type TextAnswerPageQueryOptions, type TextField, type TextFieldConstraintRule, type TextQuestionAggregate, type TranslationAdapter, type TranslationMetadataMigrator, type TranslationMigrationContext, type TranslationProviderError, type TranslationReport, type TranslationSlot, type TranslationStatus, type TranslationWorkspaceDetailedKey, type TranslationWorkspaceTranslationKey, type ValidateFormSchemaOptions, type ValidationCode, type ValidationError, type ValidationIssue, type VersionTransitionContext, type VersionTransitionError, type VersionTransitionEvent, type VersionTransitionPlan, type VersionedFormStorageAdapter, type WebhookConfig, type WebhookDispatchResult, aggregateResponses, applyTransitionPlan, assertValidFormSchema, assertVersionMutable, calculateChoiceDistribution, calculateCrossTabulation, calculateFieldVisibility, calculateNumericSummary, calculatePageVisibility, cloneVersionToDraft, collectSchemaLocales, collectTranslationSlots, commitVersionTransition, computeSourceTextHash, createCloneTransitionPlan, createDeleteDraftTransitionPlan, createFormEngineTranslator, createPublishTransitionPlan, createResponseAccumulator, createSubmission, decodeStorageSubmissionCursor, decodeStorageTextAnswerCursor, decodeSubmissionCursor, decodeTextAnswerCursor, deleteDraft, dispatchWebhook, encodeStorageSubmissionCursor, encodeStorageTextAnswerCursor, encodeSubmissionCursor, encodeTextAnswerCursor, escapeCsvCell, exportResponsesToCsv, exportResponsesToCsvStream, getTranslationStatus, isDisplayConditionGroupSatisfied, isDisplayConditionSatisfied, isManualTranslationMetadata, isQuestionVisible, iterateSubmissionPages, jsonValuesEqual, matchesSubmissionFilter, matchesSubmissionPageFilters, migrateSchemaTranslationMetadata, normalizeLocale, normalizeSubmissionPageSize, paginateWithFilter, pipeResponsesToCsvStream, populateSchemaTranslations, publishDraft, removeLocaleFromSchema, resolveFormTranslation, resolveLocalizedSchema, sanitizeSchema, selectVisibleAnswers, toFormSubmissionWire, transformFieldType, validateAnswers, validateFormSchema, validatePageAnswers, validateSchemaStructure, validateSubmission };
