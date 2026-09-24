import { z } from 'zod';

type FormResourceKind = "schema" | "version" | "state" | "submission" | "auditEvent" | "internal";
type FormDeletionCounts = Readonly<Record<FormResourceKind, number>>;
interface FormDeletionScope {
    readonly tenantId?: string;
    readonly ownerId?: string;
}
interface FormDeletionRequest extends FormDeletionScope {
    readonly formId: string;
    readonly allowNonAtomic?: boolean;
    readonly dryRun?: boolean;
    readonly pageSize?: number;
    readonly cursor?: string;
}
interface FormResource {
    readonly kind: FormResourceKind;
    readonly id: string;
    readonly value: unknown;
}
interface FormLifecycleOptions {
    /** Map each stored resource (including internal records) to its actual scope. */
    readonly scope?: (resource: FormResource) => FormDeletionScope;
}
interface FormDeletionInspection {
    readonly counts: FormDeletionCounts;
    readonly targets: readonly Pick<FormResource, "kind" | "id">[];
    readonly nextCursor?: string;
}
interface FormDeletionResult {
    readonly status: "deleted" | "dry_run" | "partial" | "failed";
    readonly atomic: boolean;
    readonly counts: FormDeletionCounts;
    readonly inspection?: FormDeletionInspection;
    readonly error?: {
        readonly code: "transaction_unsupported" | "storage_error";
        readonly cause?: unknown;
    };
}
interface FormLifecycleAdapter {
    readonly lifecycleCapabilities: {
        readonly resources: readonly FormResourceKind[];
        readonly atomic: boolean;
    };
    inspectFormDeletion(request: FormDeletionRequest): Promise<FormDeletionInspection>;
    deleteForm(request: FormDeletionRequest): Promise<FormDeletionResult>;
}
interface FormLifecycleBackend {
    readonly resources: readonly FormResourceKind[];
    readonly list: (formId: string) => Promise<readonly FormResource[]>;
    /** Must condition deletion on the enumerated identity/value and return the actual affected count. */
    readonly remove: (resource: FormResource) => Promise<number>;
    /** Supplies an isolated backend bound to the transaction; rejection rolls back every removal. */
    readonly transaction?: <T>(operation: (backend: FormLifecycleBackend) => Promise<T>) => Promise<T>;
}
declare function emptyFormDeletionCounts(): Record<FormResourceKind, number>;
declare function createFormLifecycleAdapter(backend: FormLifecycleBackend, options?: FormLifecycleOptions): FormLifecycleAdapter;

type FormContentMode = "survey" | "poll" | "quiz";
interface PollMetadata {
    readonly resultVisibility: "after_submit" | "always" | "closed_only" | "private";
    readonly strictOneVotePerUser?: boolean;
}
interface QuizFieldMetadata {
    readonly correctOptionId: string;
    readonly explanation?: string;
    readonly points?: number;
}
interface QuizMetadata {
    readonly showExplanation: "after_submit" | "immediate";
    readonly passingScore?: number;
}
interface CustomFormMetadata {
    readonly mode: FormContentMode;
    readonly poll?: PollMetadata;
    readonly quiz?: QuizMetadata;
    readonly [key: string]: unknown;
}
type ContentModeConstraintCode = "CONTENT_MODE_CONSTRAINT" | "POLL_SINGLE_FIELD_REQUIRED" | "POLL_INVALID_FIELD_TYPE" | "POLL_MIN_OPTIONS_REQUIRED" | "RADIO_TEXT_INPUT_SURVEY_ONLY" | "QUIZ_CORRECT_OPTION_MISSING" | "QUIZ_INVALID_CORRECT_OPTION";
interface ContentModeConstraintIssue extends SchemaIssue {
    readonly code: ContentModeConstraintCode;
}
interface ContentModeValidationResult {
    readonly valid: boolean;
    readonly issues: readonly ContentModeConstraintIssue[];
}
declare function getFormContentMode(metadata: unknown): FormContentMode;
declare function readPollMetadata(metadata: unknown): PollMetadata;
declare function readQuizMetadata(metadata: unknown): QuizMetadata;
declare function readQuizFieldMetadata(metadata: unknown): QuizFieldMetadata;
interface ContentModeSettings {
    readonly minFields?: number;
    readonly maxFields?: number;
    readonly allowedFieldTypes?: FormPolicy["allowedFieldTypes"];
    readonly minOptionsPerField?: number;
    readonly maxOptionsPerField?: number;
    readonly evaluateQuiz?: (schema: FormSchema, answers: FormValues) => QuizEvaluationResult;
}
declare function resolveContentModeSettings(mode: FormContentMode, policy?: FormPolicy): ContentModeSettings;
declare function validateContentModeConstraints(schema: FormSchema, policy?: FormPolicy): ContentModeValidationResult;
/** Explicit JSON boundary: rejects non-JSON values instead of silently dropping them. */
declare function contentMetadataToJson(value: unknown): Readonly<Record<string, JsonValue>>;
declare function createInitialSchemaByMode(mode: FormContentMode, options: {
    readonly title: string;
    readonly locale: string;
    readonly id?: string;
}): FormSchema;
declare function getContentModePolicy(mode: FormContentMode, policy?: FormPolicy): FormPolicy;
interface ContentModeIssue {
    readonly path: string;
    readonly message: string;
}
type ContentModeIssueCode = "field_count" | "options_maximum" | "quiz_evaluator_missing" | "poll_field_count" | "quiz_field_count" | "unsupported_field_type" | "options_minimum" | "radio_text_input" | "correct_option_missing" | "points_type" | "explanation_type" | "points_range" | "poll_result_visibility" | "poll_strict_one_vote" | "quiz_explanation_timing" | "quiz_passing_score";
interface ContentModeDiagnostic extends ContentModeIssue {
    readonly code: ContentModeIssueCode;
}
/** Opt-in validation, separate from the backwards-compatible base schema validator. */
declare function getContentModeDiagnostics(schema: FormSchema, policy?: FormPolicy): readonly ContentModeDiagnostic[];
/** Opt-in validation, separate from the backwards-compatible base schema validator. */
declare function validateContentMode(schema: FormSchema, policy?: FormPolicy): readonly ContentModeIssue[];
interface QuizQuestionResult {
    readonly fieldId: string;
    readonly title: string;
    readonly correct: boolean;
    readonly correctOption: string;
    readonly explanation?: string;
    readonly points: number;
    readonly earned: number;
}
interface QuizResult {
    readonly questions: readonly QuizQuestionResult[];
    readonly score: number;
    readonly total: number;
    readonly passed?: boolean;
}
interface QuizQuestionEvaluation {
    readonly questionId: string;
    readonly isCorrect: boolean;
    readonly correctOptionId?: string;
    readonly selectedOptionId?: string;
    readonly explanation?: string;
    readonly scoreEarned: number;
    readonly maxScore: number;
}
interface QuizEvaluationResult {
    readonly totalScore: number;
    readonly maxPossibleScore: number;
    readonly isPassed?: boolean;
    readonly questions: readonly QuizQuestionEvaluation[];
    readonly reward?: {
        readonly type: "coupon" | "badge" | "text";
        readonly code?: string;
        readonly message?: string;
    };
}
declare function evaluateQuizLocally(schema: FormSchema, answers: FormValues, policy?: FormPolicy): QuizEvaluationResult;
declare function evaluateQuiz(schema: FormSchema, answers: FormValues, policy?: FormPolicy): QuizResult;
interface PollAccessContext {
    readonly submitted: boolean;
    readonly closed: boolean;
    readonly canViewResults: boolean;
}
declare function canShowPollResults(metadata: PollMetadata, context: PollAccessContext): boolean;
/** Implementations must enforce identity and authorization at the persistence boundary. */
interface PollRuntimeAdapter<TSummary> {
    readonly loadResults: (schema: FormSchema, signal: AbortSignal) => Promise<TSummary>;
    readonly canVote: (schema: FormSchema) => Promise<boolean>;
}

interface ValidateFormSchemaOptions {
    readonly policy?: FormPolicy;
}
declare function validateFormSchema(input: unknown, options?: ValidateFormSchemaOptions): SchemaValidationResult;
declare function assertValidFormSchema(input: unknown, options?: ValidateFormSchemaOptions): asserts input is FormSchema;

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
declare function aggregateResponses(schema: FormSchema, submissions: readonly FormSubmission[], options?: ValidateFormSchemaOptions): FormAnalytics;
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
    readonly policy?: FormPolicy;
}
declare function createResponseAccumulator(schema: FormSchema, options?: ResponseAccumulatorOptions): ResponseAccumulator;
declare function escapeCsvCell(value: string | number | boolean | null | undefined, neutralizeFormulas?: boolean): string;
interface CsvColumnDefinition<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata> {
    readonly key: string;
    readonly header: string;
    readonly getValue: (submission: FormSubmission<TMeta>, schema: FormSchema) => string | number | boolean | null | undefined;
}
interface CsvExportOptions<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata> {
    readonly policy?: FormPolicy;
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
interface MetadataCsvExportOptions<TMeta extends BaseSubmissionMetadata> extends CsvExportOptions<TMeta> {
    readonly includeMetadataFields?: readonly Extract<keyof TMeta, string | number>[];
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
interface TypedStreamCsvOptions<TMeta extends BaseSubmissionMetadata> extends Omit<StreamCsvOptions, "includeMetadataFields"> {
    readonly includeMetadataFields?: readonly Extract<keyof TMeta, string | number>[];
}
type CsvStream = ReadableStream<Uint8Array> & AsyncIterable<string>;
declare function exportResponsesToCsvStream(schema: FormSchema, submissions: AsyncIterable<AccumulatorResponse>, options?: StreamCsvOptions): AsyncIterable<string>;
declare function exportResponsesToCsvStream<TMeta extends BaseSubmissionMetadata>(schema: FormSchema, submissions: Iterable<FormSubmission<TMeta>> | AsyncIterable<FormSubmission<TMeta>>, options?: TypedStreamCsvOptions<TMeta>): CsvStream;
declare function exportResponsesToCsvStream(schema: FormSchema, submissions: Iterable<AccumulatorResponse> | AsyncIterable<AccumulatorResponse>, options?: StreamCsvOptions): CsvStream;
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
declare function exportResponsesToCsv<TMeta extends BaseSubmissionMetadata>(schema: FormSchema, responses: readonly FormSubmission<TMeta>[], options?: MetadataCsvExportOptions<TMeta>): string;

type KnownBuilderTranslationKey = "authoring.prompt.label" | "authoring.prompt.submit" | "authoring.preview.selectAll" | "authoring.preview.apply" | "authoring.preview.reject" | "authoring.preview.before" | "authoring.preview.after" | "authoring.preview.invalid" | "authoring.preview.label" | "authoring.preview.property.type" | "authoring.preview.property.title" | "authoring.preview.property.description" | "authoring.preview.property.required" | "authoring.preview.property.option" | "authoring.preview.property.completionMessage" | "authoring.preview.property.submitLabel" | "authoring.preview.value.required" | "authoring.preview.value.optional" | "authoring.preview.value.none" | "authoring.preview.value.enabled" | "authoring.preview.value.disabled" | "authoring.action.ai" | "authoring.action.rewrite" | "authoring.action.shorten" | "authoring.action.generateOptions" | "authoring.operation.addField" | "authoring.operation.updateField" | "authoring.operation.updateForm" | "authoring.operation.addOption" | "authoring.operation.updateOption" | "builder.content.mode" | "builder.content.survey" | "builder.content.poll" | "builder.content.quiz" | "builder.content.pollSettings" | "builder.content.quizSettings" | "builder.content.resultVisibility" | "builder.content.after_submit" | "builder.content.always" | "builder.content.closed_only" | "builder.content.private" | "builder.content.strictOneVotePerUser" | "builder.content.showExplanation" | "builder.content.immediate" | "builder.content.enablePassingScore" | "builder.content.passingScore" | "builder.content.correctAnswer" | "builder.content.explanation" | "builder.content.points" | "builder.content.validationTitle" | "builder.content.validation.poll_field_count" | "builder.content.validation.quiz_field_count" | "builder.content.validation.unsupported_field_type" | "builder.content.validation.options_minimum" | "builder.content.validation.correct_option_missing" | "builder.content.validation.points_type" | "builder.content.validation.explanation_type" | "builder.content.validation.points_range" | "builder.content.validation.poll_result_visibility" | "builder.content.validation.poll_strict_one_vote" | "builder.content.validation.quiz_explanation_timing" | "builder.content.validation.quiz_passing_score" | "builder.formTitle" | "builder.formDescription" | "builder.completionMessage" | "builder.structure" | "builder.page" | "builder.questions" | "builder.expand" | "builder.collapse" | "builder.validationProblems" | "builder.fixIssue" | "builder.addQuestion" | "builder.actions.addField" | "builder.actions.deleteField" | "builder.actions.moveUp" | "builder.actions.moveDown" | "builder.actions.add" | "builder.actions.delete" | "builder.actions.edit" | "builder.actions.settings" | "builder.actions.translate" | "builder.actions.close" | "builder.actions.dragHandle" | "builder.fields.selectType" | "builder.fields.typeText" | "builder.fields.typeTextarea" | "builder.fields.typeNumber" | "builder.fields.typeRadio" | "builder.fields.typeCheckbox" | "builder.fields.typeSelect" | "builder.fields.typeRating" | "builder.fields.typeMultiSelect" | "builder.fields.typeDate" | "builder.fields.typeTime" | "builder.fields.typeEmail" | "builder.fields.typeTel" | "builder.fields.typeUrl" | "builder.fieldType.text" | "builder.fieldType.textarea" | "builder.fieldType.number" | "builder.fieldType.radio" | "builder.fieldType.checkbox" | "builder.fieldType.select" | "builder.fieldType.rating" | "builder.fieldType.multi-select" | "builder.fieldType.date" | "builder.fieldType.time" | "builder.fieldType.email" | "builder.fieldType.tel" | "builder.fieldType.url" | "builder.fieldTypeDescription.text" | "builder.fieldTypeDescription.textarea" | "builder.fieldTypeDescription.number" | "builder.fieldTypeDescription.radio" | "builder.fieldTypeDescription.checkbox" | "builder.fieldTypeDescription.select" | "builder.fieldTypeDescription.rating" | "builder.fieldTypeDescription.multi-select" | "builder.fieldTypeDescription.date" | "builder.fieldTypeDescription.time" | "builder.fieldTypeDescription.email" | "builder.fieldTypeDescription.tel" | "builder.fieldTypeDescription.url" | "builder.fieldCategory.text" | "builder.fieldCategory.choice" | "builder.fieldCategory.number" | "builder.fieldCategory.advanced" | "builder.required" | "builder.options" | "builder.shuffleOptions" | "builder.optionDisplayOrder" | "builder.pinOption" | "builder.optionTextInput" | "builder.openAt" | "builder.closeAt" | "builder.maxResponses" | "builder.closedMessage" | "builder.notYetOpenMessage" | "builder.honeypotFieldId" | "builder.localization.title" | "builder.localization" | "builder.localization.addLocale" | "builder.localization.selectLocaleToAdd" | "builder.localization.defaultLocale" | "builder.localization.translateAll" | "builder.localization.noLocalesConfigured" | "builder.localization.localesConfiguredSummary" | "builder.localization.allLocalesAdded" | "builder.localization.maxLocalesReached" | "builder.submissionSettings.title" | "builder.submissionSettings.showConfirmation" | "builder.submissionSettings.renderMode" | "builder.formBuilder" | "builder.basicSettings" | "builder.description" | "builder.moveUp" | "builder.moveDown" | "builder.delete" | "builder.deleteAction" | "builder.questionTitle" | "builder.questionTitlePlaceholder" | "builder.newQuestionTitle" | "builder.type" | "builder.minimum" | "builder.maximum" | "builder.minimumLength" | "builder.maximumLength" | "builder.pattern" | "builder.step" | "builder.optionLabel" | "builder.optionLabelPlaceholder" | "builder.newOptionLabel" | "builder.remove" | "builder.addOption" | "builder.displayCondition" | "builder.alwaysVisible" | "builder.conditionOperator" | "builder.conditionValue" | "builder.conditionTrue" | "builder.conditionFalse" | "builder.pages" | "builder.enablePages" | "builder.addPage" | "builder.splitPage" | "builder.newPage" | "builder.pageTitle" | "builder.pageDescription" | "builder.pageQuestion" | "builder.pageQuestionToMove" | "builder.noPageQuestions" | "builder.pageDeleteMoves" | "builder.pageDeleteLast" | "builder.questionPage" | "builder.pageCondition" | "builder.unassigned" | "builder.defaultLocale" | "builder.supportedLocales" | "builder.addLocale" | "builder.editLocale" | "builder.autoTranslate" | "builder.translating" | "builder.translationLocale" | "builder.selectLocale" | "builder.selectLocaleToAdd" | "builder.translation" | "builder.translatedFormTitle" | "builder.translatedFormDescription" | "builder.translatedCompletionMessage" | "builder.translatedQuestionTitle" | "builder.translatedDescription" | "builder.translationUnavailable" | "builder.operator.equals" | "builder.operator.not_equals" | "builder.operator.contains" | "builder.operator.not_empty" | "builder.showConfirmationBeforeSubmit" | "builder.confirmationRenderMode";
type BuilderTranslationKey = KnownBuilderTranslationKey;
type RendererTranslationKey = "renderer.submitButton" | "renderer.submittingButton" | "renderer.retryButton" | "renderer.requiredField" | "renderer.validationSummary" | "renderer.validationSummaryPlural" | "renderer.alreadySubmittedTitle" | "renderer.alreadySubmittedMessage" | "renderer.progressLabel" | "renderer.remainingQuestions" | "renderer.serverErrorSummary" | "renderer.confirmSensitiveDataTitle" | "renderer.confirmSensitiveDataMessage" | "renderer.confirmButton" | "renderer.cancelButton" | "renderer.draftResumeTitle" | "renderer.draftResumeMessage" | "renderer.draftResumeContinue" | "renderer.draftResumeStartOver" | "renderer.draftResumeEnabled" | "renderer.draftResumeDisabled" | "renderer.draftSaved" | "renderer.draftSaveFailed" | "renderer.draftDeleteFailed" | "form.submit" | "form.submitting" | "form.back" | "form.next" | "form.step" | "form.draftRestored" | "form.submissionBlocked" | "form.confirmSensitiveData" | "form.confirmSubmission" | "form.cancelSubmission" | "form.yes" | "form.no" | "form.alreadySubmitted" | "form.submitAnother" | "form.closed" | "form.notYetOpen" | "form.responseLimitReached" | "form.optionText" | "validation.required" | "validation.invalidOption" | "validation.invalidType" | "validation.max" | "validation.maxLength" | "validation.maxSelections" | "validation.min" | "validation.minLength" | "validation.minSelections" | "validation.pattern" | "validation.invalidFormat" | "validation.sensitiveData" | "validation.step" | "validation.unknownField";
type ContentResultTranslationKey = "content.results.totalScore" | "content.results.passed" | "content.results.notPassed" | "content.results.correct" | "content.results.incorrect" | "content.results.correctOption" | "content.results.pollResults" | "content.results.votes" | "content.results.loading" | "content.results.retry" | "content.results.loadError" | "content.results.invalidQuiz" | "content.results.share" | "content.results.shared" | "content.results.copied" | "content.results.shareFailed";
type TranslationWorkspaceTranslationKey = "workspace.title" | "workspace.status.missing" | "workspace.status.translated" | "workspace.status.stale" | "workspace.status.manual" | "workspace.status.manualStale" | "workspace.errors.localeNotAllowed" | "workspace.errors.maxLocalesExceeded" | "workspace.errors.readOnly" | "workspace.errors.adapterNotConfigured" | "workspace.errors.translationFailed" | "workspace.errors.localeAlreadyExists" | "workspace.errors.sourceLocale" | "workspace.errors.invalidLocale" | "workspace.errors.targetLocaleMissing" | "workspace.errors.partialFailure" | "workspace.errors.cancelled";
type TranslationWorkspaceDetailedKey = "workspace.header.title" | "workspace.header.sourceLocale" | "workspace.header.targetLocale" | "workspace.header.addLocale" | "workspace.header.removeLocale" | "workspace.header.translateAll" | "workspace.header.cancel" | "workspace.header.retry" | "workspace.header.progress" | "workspace.header.batchProgress" | "workspace.slot.sourceText" | "workspace.slot.translatedText" | "workspace.slot.translateSingle" | "workspace.slot.revertManual" | "workspace.confirm.removeLocaleTitle" | "workspace.confirm.removeLocaleMessage" | "workspace.confirm.removeLocaleTranslatedCount" | "workspace.confirm.cancel" | "workspace.confirm.remove" | "workspace.empty.noTargetLocales" | "workspace.empty.noSlotsToTranslate";
type TranslationComparisonTranslationKey = "workspace.comparison.title" | "workspace.comparison.emptyStateTitle" | "workspace.comparison.sourceHeader" | "workspace.comparison.targetHeader" | "workspace.comparison.property.title" | "workspace.comparison.property.description" | "workspace.comparison.property.label" | "workspace.comparison.property.completionMessage" | "workspace.comparison.property.closedMessage" | "workspace.comparison.property.notYetOpenMessage" | "workspace.comparison.nodeKind.form" | "workspace.comparison.nodeKind.page" | "workspace.comparison.nodeKind.field" | "workspace.comparison.nodeKind.option" | "workspace.comparison.emptySource" | "workspace.comparison.staleWarning" | "workspace.comparison.placeholder.title" | "workspace.comparison.placeholder.completionMessage" | "workspace.comparison.placeholder.question" | "workspace.comparison.placeholder.option";
type FormEngineTranslationKey = KnownBuilderTranslationKey | RendererTranslationKey | ContentResultTranslationKey | TranslationWorkspaceTranslationKey | TranslationWorkspaceDetailedKey | TranslationComparisonTranslationKey;
type FormEngineMessages = Partial<Record<FormEngineTranslationKey, string>>;

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
/** A Zod-compatible schema accepted by storage and RPC integrations. */
interface SubmissionSchema<TOutput = unknown> {
    readonly safeParse: (value: unknown) => {
        readonly success: true;
        readonly data: TOutput;
    } | {
        readonly success: false;
        readonly error: unknown;
    };
}
type FormSubmissionValidatorResult = undefined | boolean | SubmissionValidationResult;
/** Application-owned submission validation callback. */
type FormSubmissionValidator<TMeta extends BaseSubmissionMetadata | undefined = undefined> = (submission: FormSubmission<TMeta>) => unknown | Promise<unknown>;
type FormSubmissionValidationSource<TMeta extends BaseSubmissionMetadata | undefined = undefined> = FormSchema | SubmissionSchema | FormSubmissionValidator<TMeta>;
/** Validates one non-empty field value with the same rules used by form submission validation. */
declare function validateFieldValue(field: FormField, value: FormValue): boolean;
declare function validateAnswers(schema: FormSchema, values: FormValues): AnswerValidationResult;
declare function validatePageAnswers(schema: FormSchema, pageIndex: number, values: FormValues): AnswerValidationResult;
declare function validateSubmission<TMeta extends BaseSubmissionMetadata | undefined = undefined>(schema: FormSchema, submission: FormSubmission<TMeta>, options?: {
    readonly privacyEngine?: PrivacyEngine;
}): SubmissionValidationResult;

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

type FieldType = "text" | "textarea" | "number" | "rating" | "date" | "time" | "email" | "tel" | "url" | "select" | "multi-select" | "checkbox" | "radio";
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
    readonly contentMode?: ContentModeSettings;
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
    readonly closedMessage?: string;
    readonly notYetOpenMessage?: string;
}
type SchemaTranslations = Readonly<Record<string, LocalizedText>>;
type ValidationCode = "required" | "invalid_type" | "min_length" | "max_length" | "pattern" | "min" | "max" | "step" | "invalid_option" | "min_selections" | "max_selections" | "invalid_format" | "unknown_field";
interface FieldOption extends ExtensibleNode {
    readonly id: string;
    readonly label: string;
    readonly textInput?: boolean;
    readonly pinned?: boolean;
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
interface DateField extends BaseField {
    readonly type: "date";
    readonly placeholderKey?: string;
    readonly minDate?: string;
    readonly maxDate?: string;
}
interface TimeField extends BaseField {
    readonly type: "time";
    readonly placeholderKey?: string;
    readonly minTime?: string;
    readonly maxTime?: string;
}
interface EmailField extends BaseField {
    readonly type: "email";
    readonly placeholderKey?: string;
}
interface TelField extends BaseField {
    readonly type: "tel";
    readonly placeholderKey?: string;
}
interface UrlField extends BaseField {
    readonly type: "url";
    readonly placeholderKey?: string;
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
    readonly shuffleOptions?: boolean;
}
interface MultiSelectField extends BaseField {
    readonly type: "multi-select";
    readonly options: readonly FieldOption[];
    readonly shuffleOptions?: boolean;
    readonly minSelections?: number;
    readonly maxSelections?: number;
}
interface CheckboxField extends BaseField {
    readonly type: "checkbox";
}
type FormField = TextField | DateField | TimeField | EmailField | TelField | UrlField | NumberField | RatingField | SelectField | MultiSelectField | CheckboxField;
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
/** Metadata-typed schema view that keeps the legacy FormSchema contract unchanged. */
type TypedExtensibleNode<TMetadata extends Readonly<Record<string, JsonValue>> = Readonly<Record<string, JsonValue>>, TTranslationMetadata extends Readonly<Record<string, JsonValue>> = Readonly<Record<string, JsonValue>>> = Omit<ExtensibleNode, "metadata" | "translationMetadata"> & {
    readonly metadata?: TMetadata;
    readonly translationMetadata?: Readonly<Record<string, Readonly<Record<string, TTranslationMetadata>>>>;
};
type TypedFieldOption<TMetadata extends Readonly<Record<string, JsonValue>> = Readonly<Record<string, JsonValue>>, TTranslationMetadata extends Readonly<Record<string, JsonValue>> = Readonly<Record<string, JsonValue>>> = Omit<FieldOption, "metadata" | "translationMetadata"> & TypedExtensibleNode<TMetadata, TTranslationMetadata>;
type TypedFormFieldVariant<TField extends FormField, TMetadata extends Readonly<Record<string, JsonValue>>, TTranslationMetadata extends Readonly<Record<string, JsonValue>>> = Omit<TField, "metadata" | "translationMetadata" | "options"> & TypedExtensibleNode<TMetadata, TTranslationMetadata> & (TField extends {
    readonly options: readonly FieldOption[];
} ? {
    readonly options: readonly TypedFieldOption<TMetadata, TTranslationMetadata>[];
} : object);
type TypedFormField<TMetadata extends Readonly<Record<string, JsonValue>> = Readonly<Record<string, JsonValue>>, TTranslationMetadata extends Readonly<Record<string, JsonValue>> = Readonly<Record<string, JsonValue>>> = FormField extends infer TField ? TField extends FormField ? TypedFormFieldVariant<TField, TMetadata, TTranslationMetadata> : never : never;
type TypedFormSchema<TMetadata extends Readonly<Record<string, JsonValue>> = Readonly<Record<string, JsonValue>>, TTranslationMetadata extends Readonly<Record<string, JsonValue>> = Readonly<Record<string, JsonValue>>> = Omit<FormSchema, "metadata" | "translationMetadata" | "fields"> & TypedExtensibleNode<TMetadata, TTranslationMetadata> & {
    readonly fields: readonly TypedFormField<TMetadata, TTranslationMetadata>[];
};
interface FormSubmissionSettings extends ExtensibleNode {
    readonly showConfirmationBeforeSubmit?: boolean;
    readonly confirmationRenderMode?: "dialog" | "inline" | "replace";
    readonly confirmButtonLabel?: string;
    readonly cancelButtonLabel?: string;
    readonly openAt?: string;
    readonly closeAt?: string;
    readonly maxResponses?: number;
    readonly closedMessage?: string;
    readonly notYetOpenMessage?: string;
    readonly honeypotFieldId?: string;
}
interface RadioTextAnswer {
    readonly optionId: string;
    readonly text: string;
}
type FormValue = string | number | boolean | readonly string[] | RadioTextAnswer | undefined;
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
interface FormSubmissionBase extends Pick<ExtensibleNode, "translationMetadata"> {
    readonly id: string;
    readonly formId: string;
    readonly formVersion: number;
    readonly locale?: string;
    readonly values: FormValues;
    readonly submittedAt: string;
    readonly schemaRevision?: number;
}
type FormSubmission<TMeta extends BaseSubmissionMetadata | undefined = undefined> = FormSubmissionBase & ([TMeta] extends [undefined] ? {
    readonly metadata?: BaseSubmissionMetadata;
} : {
    readonly metadata: TMeta;
});
type SubmissionSaveResult<TMeta extends BaseSubmissionMetadata | undefined = undefined> = {
    readonly status: "created";
    readonly submission: FormSubmission<TMeta>;
    readonly payloadHash: string;
} | {
    readonly status: "duplicate";
    readonly submission: FormSubmission<TMeta>;
    readonly payloadHash: string;
} | {
    readonly status: "conflict";
    readonly submissionId: string;
    readonly payloadHash: string;
    readonly existingPayloadHash: string;
};
interface SaveSubmissionOptions {
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
interface StrictFormSubmission<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata> extends Omit<FormSubmissionBase, "locale" | "values"> {
    readonly values: Readonly<Record<string, unknown>>;
    readonly locale: string;
    readonly metadata: TMeta;
}
/** Clean network and persistence representation of a form submission. */
interface FormSubmissionWire<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata> {
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
interface StrictFormSubmissionWire<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata> extends Omit<FormSubmissionWire<TMeta>, "locale"> {
    readonly locale: string;
}
interface CreateSubmissionInput<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata> {
    readonly id?: string;
    readonly idFormat?: "uuid" | "ulid" | "custom";
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
    translateText(text: string, targetLocale: string, sourceLocale?: string, signal?: AbortSignal): Promise<string>;
    translateBatch(texts: readonly string[], targetLocale: string, sourceLocale?: string, signal?: AbortSignal): Promise<readonly string[]>;
}
interface SubmissionQueryOptions {
    readonly since?: string;
    readonly until?: string;
}
interface StorageAdapter {
    saveSubmission(submission: FormSubmission): Promise<void>;
    /** Atomically saves a submission only while the form version remains below its response limit. */
    saveSubmissionWithinLimit?(submission: FormSubmission, maxResponses: number, options?: SaveSubmissionOptions): Promise<undefined | SubmissionSaveResult | {
        readonly status: "limit_reached";
    }>;
    countSubmissions(formId: string, formVersion?: number, options?: SubmissionQueryOptions): Promise<number>;
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
    readonly inspectFormDeletion?: FormLifecycleAdapter["inspectFormDeletion"];
    readonly deleteForm?: FormLifecycleAdapter["deleteForm"];
    readonly lifecycleCapabilities?: FormLifecycleAdapter["lifecycleCapabilities"];
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
/** Metadata-typed submission contract for application-owned storage adapters. */
interface TypedStorageAdapter<TMeta extends BaseSubmissionMetadata> {
    saveSubmission(submission: FormSubmission<TMeta>): Promise<void>;
    countSubmissions(formId: string, formVersion?: number, options?: SubmissionQueryOptions): Promise<number>;
    listSubmissions(formId: string, formVersion?: number, options?: SubmissionQueryOptions): Promise<readonly FormSubmission<TMeta>[]>;
    clearResponses?(formId: string): Promise<void>;
    clear(): Promise<void>;
}
/** Metadata-typed form storage contract. */
interface TypedFormStorageAdapter<TMeta extends BaseSubmissionMetadata> extends TypedStorageAdapter<TMeta> {
    saveSchema(schema: FormSchema): Promise<void>;
    getSchema(formId: string, formVersion: number): Promise<FormSchema | null>;
    listSchemas(): Promise<readonly FormSchema[]>;
    deleteSchema(formId: string, formVersion: number): Promise<void>;
    deleteSubmission(submissionId: string): Promise<void>;
}
/** Metadata-typed query options for paged storage. */
interface TypedSubmissionPageQueryOptions<TMeta extends BaseSubmissionMetadata | undefined> {
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
interface TypedSubmissionPage<TMeta extends BaseSubmissionMetadata | undefined> {
    readonly items: readonly FormSubmission<TMeta>[];
    readonly nextCursor?: string;
    readonly hasMore: boolean;
}
/** Metadata-typed paged form storage contract. */
interface TypedPagedSubmissionStorageAdapter<TMeta extends BaseSubmissionMetadata> extends TypedFormStorageAdapter<TMeta> {
    listSubmissionPage(formId: string, options?: TypedSubmissionPageQueryOptions<TMeta>): Promise<TypedSubmissionPage<TMeta>>;
}
/**
 * Common submission-only contract for storage adapters that support typed saves and cursor paging.
 * MongoDB and Azure Table implementations expose this same surface so callers do not need an
 * adapter-specific branch.
 */
interface UnifiedSubmissionStorageAdapter<TMeta extends BaseSubmissionMetadata | undefined = undefined> {
    saveSubmission(submission: FormSubmission<TMeta>, options?: SaveSubmissionOptions): Promise<undefined | SubmissionSaveResult<TMeta>>;
    /** Atomically saves a submission only while the form version remains below its response limit. */
    saveSubmissionWithinLimit(submission: FormSubmission<TMeta>, maxResponses: number, options?: SaveSubmissionOptions): Promise<undefined | SubmissionSaveResult<TMeta> | {
        readonly status: "limit_reached";
    }>;
    listSubmissionPage(formId: string, options?: TypedSubmissionPageQueryOptions<TMeta>): Promise<TypedSubmissionPage<TMeta>>;
    listTextAnswerPage(formId: string, fieldIdOrOptions?: string | TextAnswerPageQueryOptions, options?: TextAnswerPageQueryOptions): Promise<TypedTextAnswerPage<TMeta>>;
    countSubmissions(formId: string, formVersion?: number, options?: SubmissionQueryOptions): Promise<number>;
    aggregateResponses(schema: FormSchema, options?: TypedSubmissionPageQueryOptions<TMeta>): Promise<FormAnalytics>;
    exportResponsesToCsv(schema: FormSchema, options?: StorageSubmissionExportOptions<TMeta>): Promise<string>;
    validateSubmission(submission: FormSubmission<TMeta>, source?: FormSubmissionValidationSource<TMeta>): Promise<void>;
}
interface StorageSubmissionExportOptions<TMeta extends BaseSubmissionMetadata | undefined = undefined> extends Omit<MetadataCsvExportOptions<BaseSubmissionMetadata>, "customColumns" | "includeMetadataFields"> {
    readonly query?: TypedSubmissionPageQueryOptions<TMeta>;
    readonly customColumns?: TMeta extends BaseSubmissionMetadata ? MetadataCsvExportOptions<TMeta>["customColumns"] : MetadataCsvExportOptions<BaseSubmissionMetadata>["customColumns"];
    readonly includeMetadataFields?: TMeta extends BaseSubmissionMetadata ? MetadataCsvExportOptions<TMeta>["includeMetadataFields"] : MetadataCsvExportOptions<BaseSubmissionMetadata>["includeMetadataFields"];
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
/** Text-answer page retaining the metadata type of the source submission. */
interface TypedTextAnswerItem<TMeta extends BaseSubmissionMetadata | undefined> extends Omit<TextAnswerItem, "metadata"> {
    readonly metadata?: [TMeta] extends [undefined] ? Readonly<Record<string, JsonValue>> : TMeta;
}
interface TypedTextAnswerPage<TMeta extends BaseSubmissionMetadata | undefined> {
    readonly items: readonly TypedTextAnswerItem<TMeta>[];
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
    readonly kind: "text" | "textarea" | "date" | "time" | "email" | "tel" | "url";
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

type FormAcceptanceStatus = "open" | "not_yet_open" | "closed" | "limit_reached";
type FormAcceptanceResult = {
    readonly status: "open";
    readonly accepted: true;
} | {
    readonly status: Exclude<FormAcceptanceStatus, "open">;
    readonly accepted: false;
};
declare function getFormAcceptanceStatus(schema: FormSchema, options?: {
    readonly now?: Date;
    readonly submissionCount?: number;
}): FormAcceptanceResult;

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

type AuthoringIntent = "generate_form" | "add_questions" | "improve_text" | "generate_options" | "rewrite_field";
type AuthoringTarget = {
    readonly kind: "form";
} | {
    readonly kind: "field";
    readonly fieldId: string;
} | {
    readonly kind: "option";
    readonly fieldId: string;
    readonly optionId: string;
};
interface AuthoringRequest {
    readonly intent: AuthoringIntent;
    readonly prompt?: string;
    readonly target?: AuthoringTarget;
    readonly context?: Readonly<Record<string, JsonValue>>;
}
interface AuthoringAssistantAdapter {
    generate: (request: AuthoringRequest, signal?: AbortSignal) => Promise<AuthoringSuggestion>;
}
interface AuthoringOptionInput {
    readonly label: string;
    readonly textInput?: boolean;
    readonly pinned?: boolean;
}
/** A field proposed by AI. IDs are deliberately absent and are assigned on apply. */
interface AuthoringFieldInput {
    readonly type: QuestionType;
    readonly title: string;
    readonly description?: string;
    readonly required?: boolean;
    readonly translationKey?: string;
    readonly messages?: FormField["messages"];
    readonly placeholderKey?: string;
    readonly minLength?: number;
    readonly maxLength?: number;
    readonly pattern?: string;
    readonly minDate?: string;
    readonly maxDate?: string;
    readonly minTime?: string;
    readonly maxTime?: string;
    readonly min?: number;
    readonly max?: number;
    readonly step?: number;
    readonly shuffleOptions?: boolean;
    readonly minSelections?: number;
    readonly maxSelections?: number;
    readonly options?: readonly AuthoringOptionInput[];
}
interface AddFieldOperation {
    readonly operationId: string;
    readonly type: "addField";
    readonly field: AuthoringFieldInput;
    readonly pageId?: string;
}
type AuthoringFieldPatch = Readonly<{
    readonly title?: string;
    readonly description?: string;
    readonly required?: boolean;
    readonly placeholderKey?: string;
    readonly minLength?: number;
    readonly maxLength?: number;
    readonly pattern?: string;
    readonly minDate?: string;
    readonly maxDate?: string;
    readonly minTime?: string;
    readonly maxTime?: string;
    readonly min?: number;
    readonly max?: number;
    readonly step?: number;
    readonly shuffleOptions?: boolean;
    readonly minSelections?: number;
    readonly maxSelections?: number;
    readonly messages?: FormField["messages"];
}>;
interface UpdateFieldOperation {
    readonly operationId: string;
    readonly type: "updateField";
    readonly fieldId: string;
    readonly patch: AuthoringFieldPatch;
}
interface UpdateFormOperation {
    readonly operationId: string;
    readonly type: "updateForm";
    readonly patch: Readonly<Partial<Pick<FormSchema, "title" | "description" | "completionMessage" | "submitLabelKey">>>;
}
interface AddOptionOperation {
    readonly operationId: string;
    readonly type: "addOption";
    readonly fieldId: string;
    readonly option: AuthoringOptionInput;
}
interface UpdateOptionOperation {
    readonly operationId: string;
    readonly type: "updateOption";
    readonly fieldId: string;
    readonly optionId: string;
    readonly patch: Readonly<Partial<Pick<FieldOption, "label" | "textInput" | "pinned">>>;
}
type AuthoringOperation = AddFieldOperation | UpdateFieldOperation | UpdateFormOperation | AddOptionOperation | UpdateOptionOperation;
interface AuthoringSuggestion {
    readonly id: string;
    readonly summary: string;
    readonly operations: readonly AuthoringOperation[];
    readonly rationale?: string;
    readonly baseSchemaHash: string;
}
type AuthoringValidationCode = "invalid_suggestion" | "duplicate_operation_id" | "unsupported_operation" | "stale_schema" | "field_not_found" | "option_not_found" | "page_not_found" | "disallowed_field_type" | "max_fields_exceeded" | "max_options_exceeded" | "max_text_length_exceeded" | "schema_invalid" | "policy_violation";
interface AuthoringValidationIssue {
    readonly code: AuthoringValidationCode;
    readonly operationId?: string;
    readonly path?: string;
    readonly message: string;
}
interface AuthoringValidationResult {
    readonly valid: boolean;
    readonly issues: readonly AuthoringValidationIssue[];
}
type AuthoringPreviewValue = {
    readonly kind: "form";
    readonly title?: string;
    readonly description?: string;
    readonly completionMessage?: string;
    readonly submitLabelKey?: string;
} | {
    readonly kind: "field";
    readonly field?: FormField | AuthoringFieldInput;
} | {
    readonly kind: "option";
    readonly option?: FieldOption | AuthoringOptionInput;
};
interface AuthoringOperationPreview {
    readonly operationId: string;
    readonly operation: AuthoringOperation;
    readonly valid: boolean;
    readonly before?: AuthoringPreviewValue;
    readonly after?: AuthoringPreviewValue;
    readonly issues: readonly AuthoringValidationIssue[];
}
interface AuthoringPreview {
    readonly valid: boolean;
    readonly baseSchemaHash: string;
    readonly schema: FormSchema;
    readonly operations: readonly AuthoringOperation[];
    readonly operationPreviews: readonly AuthoringOperationPreview[];
    readonly issues: readonly AuthoringValidationIssue[];
}
interface AuthoringPreviewOptions {
    readonly operationIds?: readonly string[];
    readonly policy?: FormPolicy;
    readonly idFactory?: AuthoringApplyOptions["idFactory"];
}
type AuthoringApplyError = {
    readonly code: "stale_schema";
    readonly issues: readonly AuthoringValidationIssue[];
} | {
    readonly code: "validation_failed";
    readonly issues: readonly AuthoringValidationIssue[];
} | {
    readonly code: "apply_failed";
    readonly issues: readonly AuthoringValidationIssue[];
};
type AuthoringApplyResult = {
    readonly success: true;
    readonly schema: FormSchema;
    readonly appliedOperationIds: readonly string[];
} | {
    readonly success: false;
    readonly error: AuthoringApplyError;
};
interface AuthoringApplyOptions {
    readonly policy?: FormPolicy;
    readonly idFactory?: (kind: "field" | "option", existingIds: ReadonlySet<string>) => string;
}

declare function applyAuthoringSuggestion(schema: FormSchema, suggestion: AuthoringSuggestion, selectedOperationIds?: readonly string[], options?: AuthoringApplyOptions): AuthoringApplyResult;

interface BuildAuthoringContextOptions {
    readonly schema: FormSchema;
    readonly request: AuthoringRequest;
    readonly policy?: FormPolicy;
}
interface AuthoringContext extends Readonly<Record<string, JsonValue>> {
    readonly fields: readonly JsonValue[];
}
declare function buildAuthoringContext({ schema, request, policy }: BuildAuthoringContextOptions): AuthoringContext;

/** Deterministic, local fingerprint for stale-suggestion protection. */
declare function computeAuthoringSchemaHash(schema: FormSchema): string;

declare const AuthoringSuggestionSchema: z.ZodObject<{
    id: z.ZodString;
    summary: z.ZodString;
    operations: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        operationId: z.ZodString;
        type: z.ZodLiteral<"addField">;
        field: z.ZodObject<{
            type: z.ZodEnum<{
                number: "number";
                text: "text";
                select: "select";
                radio: "radio";
                "multi-select": "multi-select";
                textarea: "textarea";
                date: "date";
                time: "time";
                email: "email";
                tel: "tel";
                url: "url";
                rating: "rating";
                checkbox: "checkbox";
            }>;
            title: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            required: z.ZodOptional<z.ZodBoolean>;
            translationKey: z.ZodOptional<z.ZodString>;
            messages: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            placeholderKey: z.ZodOptional<z.ZodString>;
            minLength: z.ZodOptional<z.ZodNumber>;
            maxLength: z.ZodOptional<z.ZodNumber>;
            pattern: z.ZodOptional<z.ZodString>;
            minDate: z.ZodOptional<z.ZodString>;
            maxDate: z.ZodOptional<z.ZodString>;
            minTime: z.ZodOptional<z.ZodString>;
            maxTime: z.ZodOptional<z.ZodString>;
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
            step: z.ZodOptional<z.ZodNumber>;
            shuffleOptions: z.ZodOptional<z.ZodBoolean>;
            minSelections: z.ZodOptional<z.ZodNumber>;
            maxSelections: z.ZodOptional<z.ZodNumber>;
            options: z.ZodOptional<z.ZodArray<z.ZodObject<{
                label: z.ZodString;
                textInput: z.ZodOptional<z.ZodBoolean>;
                pinned: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strict>>>;
        }, z.core.$strict>;
        pageId: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>, z.ZodObject<{
        operationId: z.ZodString;
        type: z.ZodLiteral<"updateField">;
        fieldId: z.ZodString;
        patch: z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            required: z.ZodOptional<z.ZodBoolean>;
            placeholderKey: z.ZodOptional<z.ZodString>;
            minLength: z.ZodOptional<z.ZodNumber>;
            maxLength: z.ZodOptional<z.ZodNumber>;
            pattern: z.ZodOptional<z.ZodString>;
            minDate: z.ZodOptional<z.ZodString>;
            maxDate: z.ZodOptional<z.ZodString>;
            minTime: z.ZodOptional<z.ZodString>;
            maxTime: z.ZodOptional<z.ZodString>;
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
            step: z.ZodOptional<z.ZodNumber>;
            shuffleOptions: z.ZodOptional<z.ZodBoolean>;
            minSelections: z.ZodOptional<z.ZodNumber>;
            maxSelections: z.ZodOptional<z.ZodNumber>;
            messages: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        operationId: z.ZodString;
        type: z.ZodLiteral<"updateForm">;
        patch: z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            completionMessage: z.ZodOptional<z.ZodString>;
            submitLabelKey: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        operationId: z.ZodString;
        type: z.ZodLiteral<"addOption">;
        fieldId: z.ZodString;
        option: z.ZodObject<{
            label: z.ZodString;
            textInput: z.ZodOptional<z.ZodBoolean>;
            pinned: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        operationId: z.ZodString;
        type: z.ZodLiteral<"updateOption">;
        fieldId: z.ZodString;
        optionId: z.ZodString;
        patch: z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            textInput: z.ZodOptional<z.ZodBoolean>;
            pinned: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>;
    }, z.core.$strict>], "type">>;
    rationale: z.ZodOptional<z.ZodString>;
    baseSchemaHash: z.ZodString;
}, z.core.$strict>;
declare const AUTHORING_SUGGESTION_JSON_SCHEMA: z.core.ZodStandardJSONSchemaPayload<z.ZodObject<{
    id: z.ZodString;
    summary: z.ZodString;
    operations: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        operationId: z.ZodString;
        type: z.ZodLiteral<"addField">;
        field: z.ZodObject<{
            type: z.ZodEnum<{
                number: "number";
                text: "text";
                select: "select";
                radio: "radio";
                "multi-select": "multi-select";
                textarea: "textarea";
                date: "date";
                time: "time";
                email: "email";
                tel: "tel";
                url: "url";
                rating: "rating";
                checkbox: "checkbox";
            }>;
            title: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            required: z.ZodOptional<z.ZodBoolean>;
            translationKey: z.ZodOptional<z.ZodString>;
            messages: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            placeholderKey: z.ZodOptional<z.ZodString>;
            minLength: z.ZodOptional<z.ZodNumber>;
            maxLength: z.ZodOptional<z.ZodNumber>;
            pattern: z.ZodOptional<z.ZodString>;
            minDate: z.ZodOptional<z.ZodString>;
            maxDate: z.ZodOptional<z.ZodString>;
            minTime: z.ZodOptional<z.ZodString>;
            maxTime: z.ZodOptional<z.ZodString>;
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
            step: z.ZodOptional<z.ZodNumber>;
            shuffleOptions: z.ZodOptional<z.ZodBoolean>;
            minSelections: z.ZodOptional<z.ZodNumber>;
            maxSelections: z.ZodOptional<z.ZodNumber>;
            options: z.ZodOptional<z.ZodArray<z.ZodObject<{
                label: z.ZodString;
                textInput: z.ZodOptional<z.ZodBoolean>;
                pinned: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strict>>>;
        }, z.core.$strict>;
        pageId: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>, z.ZodObject<{
        operationId: z.ZodString;
        type: z.ZodLiteral<"updateField">;
        fieldId: z.ZodString;
        patch: z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            required: z.ZodOptional<z.ZodBoolean>;
            placeholderKey: z.ZodOptional<z.ZodString>;
            minLength: z.ZodOptional<z.ZodNumber>;
            maxLength: z.ZodOptional<z.ZodNumber>;
            pattern: z.ZodOptional<z.ZodString>;
            minDate: z.ZodOptional<z.ZodString>;
            maxDate: z.ZodOptional<z.ZodString>;
            minTime: z.ZodOptional<z.ZodString>;
            maxTime: z.ZodOptional<z.ZodString>;
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
            step: z.ZodOptional<z.ZodNumber>;
            shuffleOptions: z.ZodOptional<z.ZodBoolean>;
            minSelections: z.ZodOptional<z.ZodNumber>;
            maxSelections: z.ZodOptional<z.ZodNumber>;
            messages: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        operationId: z.ZodString;
        type: z.ZodLiteral<"updateForm">;
        patch: z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            completionMessage: z.ZodOptional<z.ZodString>;
            submitLabelKey: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        operationId: z.ZodString;
        type: z.ZodLiteral<"addOption">;
        fieldId: z.ZodString;
        option: z.ZodObject<{
            label: z.ZodString;
            textInput: z.ZodOptional<z.ZodBoolean>;
            pinned: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        operationId: z.ZodString;
        type: z.ZodLiteral<"updateOption">;
        fieldId: z.ZodString;
        optionId: z.ZodString;
        patch: z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            textInput: z.ZodOptional<z.ZodBoolean>;
            pinned: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>;
    }, z.core.$strict>], "type">>;
    rationale: z.ZodOptional<z.ZodString>;
    baseSchemaHash: z.ZodString;
}, z.core.$strict>>;
declare function parseAuthoringSuggestion(value: unknown): AuthoringSuggestion;

declare function validateAuthoringSuggestion(suggestion: AuthoringSuggestion, schema: FormSchema, policy?: FormPolicy): AuthoringValidationResult;
declare function previewAuthoringSuggestion(schema: FormSchema, suggestion: AuthoringSuggestion, options?: AuthoringPreviewOptions): AuthoringPreview;

interface SurveyCreationBrief {
    readonly purpose?: string;
    readonly audience?: string;
    readonly goals?: readonly string[];
    readonly constraints?: {
        readonly targetQuestionCount?: number;
        readonly targetDurationMinutes?: number;
        readonly anonymous?: boolean;
        readonly tone?: "formal" | "neutral" | "casual";
    };
    readonly locale?: string;
    readonly contentMode?: FormContentMode;
    readonly notes?: readonly string[];
}
type CreationBriefField = "purpose" | "audience" | "goals" | "constraints" | "locale" | "contentMode";
interface CreationQuickReply {
    readonly id: string;
    readonly label: string;
    readonly value: string;
}
interface CreationMessage {
    readonly role: "user" | "assistant";
    readonly content: string;
}
interface CreationAssistantRequest {
    readonly latestMessage: string;
    readonly brief: SurveyCreationBrief;
    readonly messages?: readonly CreationMessage[];
    readonly policy?: FormPolicy;
    readonly locale?: string;
    readonly contentMode?: FormContentMode;
    readonly appConstraints?: Readonly<Record<string, JsonValue>>;
}
interface CreationClarificationResponse {
    readonly type: "clarification";
    readonly message: string;
    readonly brief: SurveyCreationBrief;
    readonly missing: readonly CreationBriefField[];
    readonly suggestions?: readonly CreationQuickReply[];
}
interface CreationReadyResponse {
    readonly type: "ready";
    readonly message: string;
    readonly brief: SurveyCreationBrief;
}
type CreationAssistantResponse = CreationClarificationResponse | CreationReadyResponse;
interface CreationAssistantAdapter {
    respond: (request: CreationAssistantRequest, signal?: AbortSignal) => Promise<unknown>;
}
interface CreationBriefReadiness {
    readonly ready: boolean;
    readonly missing: readonly CreationBriefField[];
}
interface CreationAuthoringRequestOptions {
    readonly brief: SurveyCreationBrief;
    readonly prompt?: string;
    readonly target?: AuthoringRequest["target"];
}
type CreationDraftResult = {
    readonly success: true;
    readonly suggestion: AuthoringSuggestion;
} | {
    readonly success: false;
    readonly error: unknown;
};

declare const SurveyCreationBriefSchema: z.ZodObject<{
    purpose: z.ZodOptional<z.ZodString>;
    audience: z.ZodOptional<z.ZodString>;
    goals: z.ZodOptional<z.ZodArray<z.ZodString>>;
    constraints: z.ZodOptional<z.ZodObject<{
        targetQuestionCount: z.ZodOptional<z.ZodNumber>;
        targetDurationMinutes: z.ZodOptional<z.ZodNumber>;
        anonymous: z.ZodOptional<z.ZodBoolean>;
        tone: z.ZodOptional<z.ZodEnum<{
            formal: "formal";
            neutral: "neutral";
            casual: "casual";
        }>>;
    }, z.core.$strict>>;
    locale: z.ZodOptional<z.ZodString>;
    contentMode: z.ZodOptional<z.ZodEnum<{
        survey: "survey";
        poll: "poll";
        quiz: "quiz";
    }>>;
    notes: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strict>;
declare const CreationAssistantResponseSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"clarification">;
    message: z.ZodString;
    brief: z.ZodObject<{
        purpose: z.ZodOptional<z.ZodString>;
        audience: z.ZodOptional<z.ZodString>;
        goals: z.ZodOptional<z.ZodArray<z.ZodString>>;
        constraints: z.ZodOptional<z.ZodObject<{
            targetQuestionCount: z.ZodOptional<z.ZodNumber>;
            targetDurationMinutes: z.ZodOptional<z.ZodNumber>;
            anonymous: z.ZodOptional<z.ZodBoolean>;
            tone: z.ZodOptional<z.ZodEnum<{
                formal: "formal";
                neutral: "neutral";
                casual: "casual";
            }>>;
        }, z.core.$strict>>;
        locale: z.ZodOptional<z.ZodString>;
        contentMode: z.ZodOptional<z.ZodEnum<{
            survey: "survey";
            poll: "poll";
            quiz: "quiz";
        }>>;
        notes: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strict>;
    missing: z.ZodArray<z.ZodEnum<{
        locale: "locale";
        contentMode: "contentMode";
        purpose: "purpose";
        audience: "audience";
        goals: "goals";
        constraints: "constraints";
    }>>;
    suggestions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        value: z.ZodString;
    }, z.core.$strict>>>;
}, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"ready">;
    message: z.ZodString;
    brief: z.ZodObject<{
        purpose: z.ZodOptional<z.ZodString>;
        audience: z.ZodOptional<z.ZodString>;
        goals: z.ZodOptional<z.ZodArray<z.ZodString>>;
        constraints: z.ZodOptional<z.ZodObject<{
            targetQuestionCount: z.ZodOptional<z.ZodNumber>;
            targetDurationMinutes: z.ZodOptional<z.ZodNumber>;
            anonymous: z.ZodOptional<z.ZodBoolean>;
            tone: z.ZodOptional<z.ZodEnum<{
                formal: "formal";
                neutral: "neutral";
                casual: "casual";
            }>>;
        }, z.core.$strict>>;
        locale: z.ZodOptional<z.ZodString>;
        contentMode: z.ZodOptional<z.ZodEnum<{
            survey: "survey";
            poll: "poll";
            quiz: "quiz";
        }>>;
        notes: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strict>;
}, z.core.$strict>], "type">;
declare const CREATION_ASSISTANT_RESPONSE_JSON_SCHEMA: z.core.ZodStandardJSONSchemaPayload<z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"clarification">;
    message: z.ZodString;
    brief: z.ZodObject<{
        purpose: z.ZodOptional<z.ZodString>;
        audience: z.ZodOptional<z.ZodString>;
        goals: z.ZodOptional<z.ZodArray<z.ZodString>>;
        constraints: z.ZodOptional<z.ZodObject<{
            targetQuestionCount: z.ZodOptional<z.ZodNumber>;
            targetDurationMinutes: z.ZodOptional<z.ZodNumber>;
            anonymous: z.ZodOptional<z.ZodBoolean>;
            tone: z.ZodOptional<z.ZodEnum<{
                formal: "formal";
                neutral: "neutral";
                casual: "casual";
            }>>;
        }, z.core.$strict>>;
        locale: z.ZodOptional<z.ZodString>;
        contentMode: z.ZodOptional<z.ZodEnum<{
            survey: "survey";
            poll: "poll";
            quiz: "quiz";
        }>>;
        notes: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strict>;
    missing: z.ZodArray<z.ZodEnum<{
        locale: "locale";
        contentMode: "contentMode";
        purpose: "purpose";
        audience: "audience";
        goals: "goals";
        constraints: "constraints";
    }>>;
    suggestions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        value: z.ZodString;
    }, z.core.$strict>>>;
}, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"ready">;
    message: z.ZodString;
    brief: z.ZodObject<{
        purpose: z.ZodOptional<z.ZodString>;
        audience: z.ZodOptional<z.ZodString>;
        goals: z.ZodOptional<z.ZodArray<z.ZodString>>;
        constraints: z.ZodOptional<z.ZodObject<{
            targetQuestionCount: z.ZodOptional<z.ZodNumber>;
            targetDurationMinutes: z.ZodOptional<z.ZodNumber>;
            anonymous: z.ZodOptional<z.ZodBoolean>;
            tone: z.ZodOptional<z.ZodEnum<{
                formal: "formal";
                neutral: "neutral";
                casual: "casual";
            }>>;
        }, z.core.$strict>>;
        locale: z.ZodOptional<z.ZodString>;
        contentMode: z.ZodOptional<z.ZodEnum<{
            survey: "survey";
            poll: "poll";
            quiz: "quiz";
        }>>;
        notes: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strict>;
}, z.core.$strict>], "type">>;
declare function parseSurveyCreationBrief(value: unknown): SurveyCreationBrief;
declare function parseCreationAssistantResponse(value: unknown): CreationAssistantResponse;

declare function mergeSurveyCreationBrief(current: SurveyCreationBrief, update: SurveyCreationBrief): SurveyCreationBrief;
declare function evaluateCreationBriefReadiness(brief: SurveyCreationBrief): CreationBriefReadiness;
declare function canGenerateCreationDraft(brief: SurveyCreationBrief, clarificationTurns: number, maxClarificationTurns?: number): boolean;

type CrossFormSkipReason = "schema_missing" | "invalid_answers" | "not_quiz" | "evaluation_failed";
interface CrossFormAnalyticsOptions<TSubmission extends FormSubmission = FormSubmission> {
    readonly policy?: FormPolicy;
    readonly byLocale?: boolean;
    readonly byContentMode?: boolean;
    readonly metadata?: Readonly<Record<string, (submission: TSubmission) => string | number | boolean | null | undefined>>;
    readonly scores?: boolean;
    readonly includeSkipDetails?: boolean;
}
interface CrossFormScoreSummary {
    readonly evaluatedCount: number;
    readonly averageScore: number | null;
    readonly scoreRate: number | null;
    readonly passCount: number;
    readonly passEligibleCount: number;
    readonly passRate: number | null;
}
interface CrossFormAnalytics {
    readonly processedCount: number;
    readonly aggregatedCount: number;
    readonly forms: readonly FormAnalytics[];
    readonly groups: Readonly<Record<string, readonly {
        readonly key: string | number | boolean | null;
        readonly count: number;
        readonly forms: readonly FormAnalytics[];
        readonly scores?: CrossFormScoreSummary;
    }[]>>;
    readonly scores?: CrossFormScoreSummary;
    readonly skipCounts: Readonly<Record<CrossFormSkipReason, number>>;
    readonly skipDetails?: readonly {
        readonly submissionId: string;
        readonly reason: CrossFormSkipReason;
    }[];
}
declare function aggregateForms<TSubmission extends FormSubmission = FormSubmission>(schemas: readonly FormSchema[], submissions: readonly TSubmission[], options?: CrossFormAnalyticsOptions<TSubmission>): CrossFormAnalytics;

interface FormSubmissionSerializedError {
    readonly code: "VALIDATION_FAILED" | "PII_CONFIRMATION_REQUIRED" | "SUBMISSION_BLOCKED" | "FORM_CLOSED" | "STORAGE_ERROR";
    readonly messageKey: FormEngineTranslationKey | string;
    readonly messageParams?: Readonly<Record<string, unknown>>;
    readonly fieldErrors?: Readonly<Record<string, string>>;
    readonly formErrors?: readonly string[];
    readonly piiFindings?: readonly SensitiveDataFinding[];
    readonly piiWarningAcknowledged?: boolean;
}
/** JSON payload carried by a tRPC error's `data` or `shape.data` property. */
interface TrpcFormSubmissionErrorData extends FormSubmissionSerializedError {
    readonly source: "form-engine";
}
interface TrpcSubmissionErrorAdapter {
    readonly serialize: (error: FormSubmissionError) => TrpcFormSubmissionErrorData;
    readonly deserialize: (error: unknown) => FormSubmissionError | undefined;
}
type TrpcProcedureType = "query" | "mutation" | "subscription";
/** Structural equivalent of tRPC's ErrorFormatter input; no `@trpc/server` dependency is required. */
interface TrpcSubmissionErrorFormatterOptions<TShape extends Record<string, unknown> = Record<string, unknown>> {
    readonly error: unknown;
    readonly type: TrpcProcedureType | undefined;
    readonly path: string | undefined;
    readonly input: unknown;
    readonly ctx: unknown;
    readonly shape: TShape & {
        readonly data?: unknown;
    };
}
type TrpcSubmissionErrorShape<TShape extends Record<string, unknown>> = Omit<TShape, "data"> & {
    readonly data: Partial<TrpcFormSubmissionErrorData> & Omit<TShape extends {
        readonly data?: infer TData;
    } ? TData extends object ? TData : Record<string, unknown> : Record<string, unknown>, keyof TrpcFormSubmissionErrorData>;
};
type TrpcSubmissionErrorFormatter<TShape extends Record<string, unknown> = Record<string, unknown>> = (options: TrpcSubmissionErrorFormatterOptions<TShape>) => TrpcSubmissionErrorShape<TShape>;
/** A ready-to-use server/client tRPC boundary for FormSubmissionError. */
interface TrpcSubmissionErrorIntegration {
    readonly errorFormatter: TrpcSubmissionErrorFormatter;
    readonly deserialize: (error: unknown) => FormSubmissionError | undefined;
    readonly getData: (error: unknown) => TrpcFormSubmissionErrorData | undefined;
}
declare function isFormSubmissionSerializedError(value: unknown): value is FormSubmissionSerializedError;
/** Error with a stable, JSON-serializable payload for RPC boundaries. */
declare class FormSubmissionError extends Error {
    readonly payload: FormSubmissionSerializedError;
    constructor(payload: FormSubmissionSerializedError);
    toJSON(): FormSubmissionSerializedError;
}
declare const serializeSubmissionError: (error: FormSubmissionError) => FormSubmissionSerializedError;
declare const deserializeSubmissionError: (json: FormSubmissionSerializedError) => FormSubmissionError;
/** Converts a FormSubmissionError into data safe to return from a tRPC procedure. */
declare function serializeSubmissionErrorForTrpc(error: FormSubmissionError): TrpcFormSubmissionErrorData;
/** Restores a FormSubmissionError from a tRPC error, including `data` and `shape.data`. */
declare function deserializeSubmissionErrorFromTrpc(error: unknown): FormSubmissionError | undefined;
/** Returns the typed Form Engine payload from a tRPC error shape without an application cast. */
declare function getTrpcSubmissionErrorData(error: unknown): TrpcFormSubmissionErrorData | undefined;
/** Standard transport adapter for tRPC server/client boundaries. */
declare const trpcSubmissionErrorAdapter: TrpcSubmissionErrorAdapter;
declare const createTrpcSubmissionErrorAdapter: () => TrpcSubmissionErrorAdapter;
/**
 * Creates the tRPC integration used by both a server `errorFormatter` and a client error boundary.
 * The formatter preserves tRPC's existing `shape.data` values and adds the typed submission payload
 * only when the thrown error is a FormSubmissionError.
 */
declare function createTrpcSubmissionErrorIntegration(): TrpcSubmissionErrorIntegration;
/** Server-side convenience helper for tRPC's `errorFormatter` option. */
declare const createTrpcSubmissionErrorFormatter: () => TrpcSubmissionErrorFormatter<Record<string, unknown>>;

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

interface SubmissionGuardContext<TMeta extends BaseSubmissionMetadata | undefined = undefined> {
    readonly formId: string;
    readonly formVersion: number;
    readonly locale: string;
    readonly submittedAt: string;
    readonly challengeToken?: string;
    readonly clientKey?: string;
    readonly honeypotValue?: string;
    readonly metadata?: TMeta;
}
type SubmissionGuardResult = {
    readonly status: "allow";
} | {
    readonly status: "confirm";
    readonly message?: string;
} | {
    readonly status: "block";
    readonly message?: string;
};
type SubmissionGuard<TMeta extends BaseSubmissionMetadata | undefined = undefined> = (input: {
    readonly schema: FormSchema;
    readonly values: FormValues;
    readonly context: SubmissionGuardContext<TMeta>;
}) => SubmissionGuardResult | Promise<SubmissionGuardResult>;
declare function createHoneypotGuard<TMeta extends BaseSubmissionMetadata | undefined = undefined>(fieldId?: string): SubmissionGuard<TMeta>;
interface RateLimiter {
    check(key: string, now?: Date): Promise<{
        readonly allowed: boolean;
        readonly retryAfterMs?: number;
    }>;
}
declare function createMemoryRateLimiter(options: {
    readonly limit: number;
    readonly windowMs: number;
}): RateLimiter;
declare function createRateLimitGuard<TMeta extends BaseSubmissionMetadata | undefined = undefined>(limiter: RateLimiter, keyFrom: (context: SubmissionGuardContext<TMeta>) => string): SubmissionGuard<TMeta>;
declare function createChallengeGuard<TMeta extends BaseSubmissionMetadata | undefined = undefined>(verify: (token: string, context: SubmissionGuardContext<TMeta>) => boolean | Promise<boolean>): SubmissionGuard<TMeta>;

declare const EN_MESSAGES: Readonly<Record<FormEngineTranslationKey, string>>;

declare const JA_COMPARISON_MESSAGES: Readonly<Record<string, string>>;
declare const JA_MESSAGES: Readonly<Record<FormEngineTranslationKey, string>>;

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
    readonly property: "title" | "description" | "label" | "completionMessage" | "closedMessage" | "notYetOpenMessage";
    readonly locale: string;
    readonly sourceText: string;
    readonly existingText?: string;
    readonly nodeMetadata?: Readonly<Record<string, JsonValue>>;
    readonly existingTranslationMetadata?: Readonly<Record<string, JsonValue>>;
    /** Canonical target information for workspace clients. */
    readonly target?: {
        readonly kind: "form" | "page" | "field" | "option";
        readonly id?: string;
        readonly property: "title" | "description" | "label" | "completionMessage" | "closedMessage" | "notYetOpenMessage";
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
    readonly property: "title" | "description" | "label" | "completionMessage" | "closedMessage" | "notYetOpenMessage";
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
    /** Aborts an in-flight translation operation when requested. */
    readonly signal?: AbortSignal;
    /** Reports progress for the slots selected for translation. */
    readonly onProgress?: (progress: TranslationProgress) => void;
    /** Keeps successful slots when individual translation calls fail. */
    readonly continueOnError?: boolean;
}
/** Compatibility alias for clients that used the pluralized options name. */
type PopulateTranslationsOptions = PopulateTranslationOptions;
interface TranslationReport {
    readonly updatedSlots: readonly TranslationSlot[];
    readonly skippedSlots: readonly TranslationSlot[];
    readonly staleSlots?: readonly TranslationSlot[];
    readonly skippedReasons?: Readonly<Record<string, "manual" | "unchanged" | "unsupported">>;
    readonly totalSlots?: number;
    readonly attemptedSlots?: number;
    readonly succeeded?: number;
    readonly failed?: number;
    readonly cancelled?: boolean;
    readonly failures?: readonly TranslationFailure[];
}
interface TranslationProgress {
    readonly total: number;
    readonly completed: number;
    readonly succeeded: number;
    readonly failed: number;
    readonly percentage: number;
}
interface TranslationFailure {
    readonly slot: TranslationSlot;
    readonly cause: unknown;
}
declare const computeSourceTextHash: (text: string) => string;
declare function getTranslationStatus(sourceText: string, translatedText: string | undefined, metadata: CanonicalTranslationMetadata | Readonly<Record<string, JsonValue>> | undefined): TranslationStatus;
/** Normalizes canonical and legacy translation metadata for application-owned text codecs. */
declare function normalizeTranslationMetadata(metadata: unknown, sourceText: string, defaultLocale?: string): CanonicalTranslationMetadata;
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

type TranslationTargetKind = "title" | "completionMessage" | "question" | "option";
interface TranslationWorkspaceCustomDictionary {
    readonly messages?: Partial<Record<FormEngineTranslationKey, string>>;
    readonly localeNames?: Readonly<Record<string, string>>;
    readonly statusLabels?: Partial<Record<TranslationStatus, string>>;
    readonly placeholders?: Partial<Record<TranslationTargetKind, string>>;
    readonly headers?: {
        readonly sourceTitle?: string;
        readonly targetTitle?: string;
    };
}
interface FormEngineTranslatorOptions {
    readonly locale?: string;
    readonly fallbackLocale?: string;
    readonly messages?: FormEngineMessages;
    readonly customCatalogs?: Record<string, FormEngineMessages>;
    readonly customDictionary?: TranslationWorkspaceCustomDictionary;
    readonly fallbackTextResolver?: (key: FormEngineTranslationKey, locale: string) => string;
    readonly onMissingKey?: (event: TranslationMissingKeyEvent) => void;
    readonly strict?: boolean;
}
interface TranslationMissingKeyEvent {
    readonly key: string;
    readonly locale: string;
    readonly fallbackLocale: string;
    readonly resolvedValue: string;
    readonly reason: "missing_in_current_locale" | "missing_in_all_catalogs";
}
type FormEngineTranslator = (key: FormEngineTranslationKey | string, params?: Record<string, unknown>) => string;
declare const createFormEngineTranslator: (options?: FormEngineTranslatorOptions) => FormEngineTranslator;

type FormInteractionEventType = "form.viewed" | "form.started" | "page.viewed" | "page.completed" | "field.presented" | "field.focused" | "field.completed" | "validation.failed" | "form.submit_attempted" | "form.submitted" | "form.submit_failed" | "form.exited";
type FormTelemetryContextValue = string | number | boolean | null;
interface FormInteractionEventBase {
    readonly eventId: string;
    readonly eventVersion: 1;
    readonly type: FormInteractionEventType;
    readonly sessionId: string;
    readonly sequence: number;
    readonly formId: string;
    readonly formVersion: number;
    readonly occurredAt: string;
    readonly elapsedMs: number;
    readonly context?: Readonly<Record<string, FormTelemetryContextValue>>;
}
interface FormViewedEvent extends FormInteractionEventBase {
    readonly type: "form.viewed";
}
interface FormStartedEvent extends FormInteractionEventBase {
    readonly type: "form.started";
}
interface PageViewedEvent extends FormInteractionEventBase {
    readonly type: "page.viewed";
    readonly pageId: string;
}
interface PageCompletedEvent extends FormInteractionEventBase {
    readonly type: "page.completed";
    readonly pageId: string;
    readonly durationMs?: number;
}
interface FieldPresentedEvent extends FormInteractionEventBase {
    readonly type: "field.presented";
    readonly fieldId: string;
    readonly fieldType: QuestionType;
    readonly pageId?: string;
}
interface FieldFocusedEvent extends FormInteractionEventBase {
    readonly type: "field.focused";
    readonly fieldId: string;
    readonly fieldType: QuestionType;
    readonly pageId?: string;
}
interface FieldCompletedEvent extends FormInteractionEventBase {
    readonly type: "field.completed";
    readonly fieldId: string;
    readonly fieldType: QuestionType;
    readonly pageId?: string;
    readonly durationMs?: number;
}
interface ValidationFailedEvent extends FormInteractionEventBase {
    readonly type: "validation.failed";
    readonly scope: "field" | "page" | "form";
    readonly pageId?: string;
    readonly issues: readonly {
        readonly fieldId: string;
        readonly code: ValidationCode;
    }[];
}
interface FormSubmitAttemptedEvent extends FormInteractionEventBase {
    readonly type: "form.submit_attempted";
}
interface FormSubmittedEvent extends FormInteractionEventBase {
    readonly type: "form.submitted";
    readonly durationMs?: number;
}
interface FormSubmitFailedEvent extends FormInteractionEventBase {
    readonly type: "form.submit_failed";
    readonly code?: string;
}
interface FormExitedEvent extends FormInteractionEventBase {
    readonly type: "form.exited";
    readonly reason?: "pagehide" | "unmount";
}
type FormInteractionEvent = FormViewedEvent | FormStartedEvent | PageViewedEvent | PageCompletedEvent | FieldPresentedEvent | FieldFocusedEvent | FieldCompletedEvent | ValidationFailedEvent | FormSubmitAttemptedEvent | FormSubmittedEvent | FormSubmitFailedEvent | FormExitedEvent;
interface FormTelemetryAdapter {
    track(event: FormInteractionEvent): void | Promise<void>;
    flush?(): void | Promise<void>;
}

interface InteractionAnalyticsOptions {
    readonly abandonmentThresholdMs?: number;
    readonly now?: Date | string;
}
interface FormInteractionFunnel {
    readonly viewedCount: number;
    readonly startedCount: number;
    readonly submitAttemptedCount: number;
    readonly submitFailedCount?: number;
    readonly submittedCount: number;
    readonly abandonedCount: number;
    readonly startRate: number;
    readonly submissionRateFromView: number;
    readonly submissionRateFromStart: number;
    readonly abandonmentRate?: number;
    readonly submitFailureRate?: number;
}
interface PageInteractionAnalytics {
    readonly pageId: string;
    readonly viewedCount: number;
    readonly completedCount: number;
    readonly completionRate: number;
    readonly averageCompletionMs?: number;
}
interface FieldInteractionAnalytics {
    readonly fieldId: string;
    readonly fieldType: QuestionType;
    readonly presentedCount: number;
    readonly focusedCount: number;
    readonly completedCount: number;
    readonly focusRate: number;
    readonly completionRate: number;
    readonly validationFailureCount: number;
    readonly validationFailureSessionCount: number;
    readonly averageCompletionMs?: number;
}
interface FormInteractionAnalytics {
    readonly formId: string;
    readonly formVersion: number;
    readonly sessions: number;
    readonly funnel: FormInteractionFunnel;
    readonly pages: readonly PageInteractionAnalytics[];
    readonly fields: readonly FieldInteractionAnalytics[];
}
declare function aggregateInteractionEvents(events: readonly FormInteractionEvent[], options?: InteractionAnalyticsOptions): FormInteractionAnalytics;

interface RateComparison {
    readonly before: number;
    readonly after: number;
    readonly deltaPercentagePoints: number;
}
interface DurationComparison {
    readonly before?: number;
    readonly after?: number;
    readonly deltaMs?: number;
}
interface CountComparison {
    readonly before: number;
    readonly after: number;
    readonly delta: number;
}
interface FunnelInteractionComparison {
    readonly startRate: RateComparison;
    readonly submissionRateFromView: RateComparison;
    readonly submissionRateFromStart: RateComparison;
    readonly abandonmentRate: RateComparison;
    readonly submitFailureRate: RateComparison;
}
interface PageInteractionComparison {
    readonly pageId: string;
    readonly status: "matched" | "added" | "removed";
    readonly completionRate?: RateComparison;
    readonly averageCompletionMs?: DurationComparison;
    readonly viewedCount?: CountComparison;
    readonly completedCount?: CountComparison;
}
interface FieldInteractionComparison {
    readonly fieldId: string;
    readonly status: "matched" | "added" | "removed";
    readonly focusRate?: RateComparison;
    readonly completionRate?: RateComparison;
    readonly validationFailureRate?: RateComparison;
    readonly averageCompletionMs?: DurationComparison;
    readonly presentedCount?: CountComparison;
    readonly focusedCount?: CountComparison;
    readonly completedCount?: CountComparison;
}
interface InteractionAnalyticsComparison {
    readonly formId: string;
    readonly beforeVersion: number;
    readonly afterVersion: number;
    readonly funnel: FunnelInteractionComparison;
    readonly pages: readonly PageInteractionComparison[];
    readonly fields: readonly FieldInteractionComparison[];
}
declare function compareInteractionAnalytics(before: FormInteractionAnalytics, after: FormInteractionAnalytics): InteractionAnalyticsComparison;

/** Updates only explicitly supplied properties, retaining unknown JSON properties. */
declare function mapSchemaNode<T extends object>(node: T, update: (node: Readonly<T>) => Partial<T>): T;
declare function mapField<T extends FormField>(field: T, update: (field: Readonly<T>) => Partial<T & FormField>): T;
declare function mapOption<T extends FieldOption>(option: T, update: (option: Readonly<T>) => Partial<T & FieldOption>): T;
declare function mapPage<T extends FormPage>(page: T, update: (page: Readonly<T>) => Partial<T & FormPage>): T;
declare function mapSchema<T extends FormSchema>(schema: T, update: (schema: Readonly<T>) => Partial<T>, options?: ValidateFormSchemaOptions): T;
interface SchemaDomainCodec<TDomain, TSchema extends FormSchema = FormSchema> {
    readonly toFormSchema: (domain: TDomain) => TSchema;
    readonly fromFormSchema: (schema: TSchema, original: TDomain) => TDomain;
}
/** Validates mapped schemas at both boundaries; domain-specific merging belongs to the codec. */
declare function createSchemaDomainCodec<TDomain, TSchema extends FormSchema = FormSchema>(codec: SchemaDomainCodec<TDomain, TSchema>, options?: ValidateFormSchemaOptions): SchemaDomainCodec<TDomain, TSchema>;

type FormOptimizationInsightType = "low_start_rate" | "high_form_abandonment" | "high_page_dropoff" | "low_field_focus_rate" | "low_field_completion_rate" | "high_validation_friction" | "high_submit_failure_rate" | "slow_page_completion" | "slow_field_completion";
type FormOptimizationMetric = "startRate" | "abandonmentRate" | "completionRate" | "dropoffRate" | "focusRate" | "validationFailureRate" | "submitFailureRate" | "averageCompletionMs";
interface FormOptimizationInsight {
    readonly id: string;
    readonly type: FormOptimizationInsightType;
    readonly scope: "form" | "page" | "field";
    readonly targetId?: string;
    readonly metric: FormOptimizationMetric;
    readonly sampleSize: number;
    readonly observedValue: number;
    readonly threshold: number;
}
interface OptimizationInsightThresholds {
    readonly lowStartRate?: number;
    readonly highAbandonmentRate?: number;
    readonly highPageDropoffRate?: number;
    readonly lowFieldFocusRate?: number;
    readonly lowFieldCompletionRate?: number;
    readonly highValidationFailureRate?: number;
    readonly highSubmitFailureRate?: number;
    readonly slowPageCompletionMs?: number;
    readonly slowFieldCompletionMs?: number;
}
interface OptimizationInsightOptions {
    readonly minimumSamples?: {
        readonly form?: number;
        readonly page?: number;
        readonly field?: number;
    };
    readonly thresholds?: OptimizationInsightThresholds;
}
interface FormOptimizationReport {
    readonly formId: string;
    readonly formVersion: number;
    readonly insights: readonly FormOptimizationInsight[];
}
declare const DEFAULT_OPTIMIZATION_MINIMUM_SAMPLES: {
    readonly form: 30;
    readonly page: 20;
    readonly field: 20;
};
declare const DEFAULT_OPTIMIZATION_THRESHOLDS: {
    readonly lowStartRate: 50;
    readonly highAbandonmentRate: 50;
    readonly highPageDropoffRate: 40;
    readonly lowFieldCompletionRate: 70;
    readonly highValidationFailureRate: 20;
    readonly highSubmitFailureRate: 10;
};
declare function analyzeInteractionAnalytics(analytics: FormInteractionAnalytics, options?: OptimizationInsightOptions): FormOptimizationReport;

/** Returns a stable order while preserving the original positions of pinned options. */
declare function shuffleOptions(options: readonly FieldOption[], seed: string): readonly FieldOption[];

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

interface SubmissionCodecResult<TValues extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>> {
    readonly success: true;
    readonly data: TValues;
}
interface SubmissionCodecFailure {
    readonly success: false;
    readonly error: unknown;
}
/** Minimal codec contract accepted by the submission pipeline, including Zod codecs. */
interface SubmissionCodec<TInput = unknown, TValues extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>> {
    readonly safeParse: (input: TInput) => SubmissionCodecResult<TValues> | SubmissionCodecFailure;
}
interface SubmissionPipelineOptions<TInput = unknown, TMeta extends BaseSubmissionMetadata | undefined = undefined, TValues extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>> {
    readonly schema: FormSchema;
    readonly storage: UnifiedSubmissionStorageAdapter<TMeta>;
    readonly codec?: SubmissionCodec<TInput, TValues>;
    readonly id: string;
    readonly locale: string;
    readonly metadata?: TMeta;
    readonly submittedAt?: string;
    readonly schemaRevision?: number;
    readonly privacyEngine?: PrivacyEngine;
    /** Must be true when the client has reviewed the PII findings. */
    readonly piiWarningAcknowledged?: boolean;
    /** Idempotency is enabled by default for pipeline saves. */
    readonly idempotent?: boolean;
    readonly now?: () => Date;
    readonly guards?: readonly SubmissionGuard<TMeta>[];
    readonly challengeToken?: string;
    readonly clientKey?: string;
    readonly honeypotValue?: string;
}
type SubmissionPipelineResult<TMeta extends BaseSubmissionMetadata | undefined = undefined> = SubmissionSaveResult<TMeta> | {
    readonly status: "created";
    readonly submission: FormSubmission<TMeta>;
    readonly payloadHash: string;
};
interface SubmissionPipeline<TInput, TMeta extends BaseSubmissionMetadata | undefined = undefined> {
    submit(input: TInput): Promise<SubmissionPipelineResult<TMeta>>;
}
/** Runs the complete normalized, validated, privacy-checked, idempotent save flow. */
declare function runSubmissionPipeline<TInput, TMeta extends BaseSubmissionMetadata | undefined = undefined, TValues extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>>(options: SubmissionPipelineOptions<TInput, TMeta, TValues>, input: TInput): Promise<SubmissionPipelineResult<TMeta>>;
/** Creates a reusable submission pipeline with fixed schema, storage, and submission identity settings. */
declare function createSubmissionPipeline<TInput, TMeta extends BaseSubmissionMetadata | undefined = undefined, TValues extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>>(options: Omit<SubmissionPipelineOptions<TInput, TMeta, TValues>, "submittedAt"> & {
    readonly submittedAt?: string;
}): SubmissionPipeline<TInput, TMeta>;

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

type ResponseSummaryInput = FormAnalytics | {
    readonly questions: readonly QuestionAggregate[];
    readonly formId?: string;
    readonly formVersion?: number;
};
interface ResponseSummaryLanguageAggregate {
    readonly language: string;
    readonly submissionCount: number;
    readonly summary: ResponseSummaryInput;
}
interface ResponseSummarySkipReason {
    readonly reason: string;
    readonly count: number;
    readonly language?: string;
}
interface ResponseSummaryQuestion {
    readonly fieldId: string;
    readonly label: string;
    readonly kind: QuestionAggregate["kind"];
    readonly answeredCount: number;
    readonly unansweredCount: number;
    readonly definition?: unknown;
    readonly optionDefinitions?: Readonly<Record<string, unknown>>;
    readonly options?: readonly {
        readonly id: string;
        readonly label: string;
        readonly count: number;
        readonly percentage: number;
    }[];
    readonly statistics?: Readonly<Record<string, number | null>>;
}
interface ResponseSummaryData<TCustomData = unknown, TSkipReason = ResponseSummarySkipReason> {
    readonly formId: string;
    readonly version: number;
    readonly sourceLanguage: string;
    readonly title: string;
    readonly questions: readonly ResponseSummaryQuestion[];
    readonly languages?: readonly ResponseSummaryLanguageAggregate[];
    readonly skipReasons?: readonly TSkipReason[];
    readonly customData?: TCustomData;
}
interface ResponseSummaryLabels {
    readonly languages?: string;
    readonly answered?: string;
    readonly unanswered?: string;
    readonly skipReasons?: string;
    readonly options?: string;
    readonly statistics?: string;
    readonly average?: string;
    readonly minimum?: string;
    readonly maximum?: string;
    readonly total?: string;
    readonly checked?: string;
    readonly unchecked?: string;
    readonly percentage?: string;
}
declare function toResponseSummary(summary: ResponseSummaryInput, version: FormVersionRecord | FormSchema, sourceLanguage: string): ResponseSummaryData;

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

/** Runtime schema for the JSON metadata carried by a submission wire payload. */
declare const FormSubmissionMetadataSchema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
/** Runtime schema for the clean, alias-free submission wire format. */
declare const FormSubmissionWireSchema: z.ZodObject<{
    id: z.ZodString;
    formId: z.ZodString;
    formVersion: z.ZodNumber;
    values: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    locale: z.ZodOptional<z.ZodString>;
    metadata: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    submittedAt: z.ZodString;
    schemaRevision: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
/** Runtime schema for the locale-required submission wire contract. */
declare const StrictFormSubmissionWireSchema: z.ZodObject<{
    id: z.ZodString;
    formId: z.ZodString;
    formVersion: z.ZodNumber;
    values: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    metadata: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    submittedAt: z.ZodString;
    schemaRevision: z.ZodOptional<z.ZodNumber>;
    locale: z.ZodString;
}, z.core.$strip>;
/**
 * Creates a wire schema with an application-owned metadata schema.
 *
 * The returned schema keeps the exact metadata output type of the supplied
 * Zod schema, so applications do not need to repeat `FormSubmissionWireSchema`
 * with a local `.extend()` call.
 */
declare function createFormSubmissionSchema(): typeof FormSubmissionWireSchema;
declare function createFormSubmissionSchema<TMetadata extends z.ZodType>(options: {
    readonly metadata: TMetadata;
}): ReturnType<typeof FormSubmissionWireSchema.extend<{
    readonly metadata: TMetadata;
}>>;
type FormSubmissionWireSchemaType = z.infer<typeof FormSubmissionWireSchema>;
type StrictFormSubmissionWireSchemaType = z.infer<typeof StrictFormSubmissionWireSchema>;

interface CreateSubmissionOptions<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata> extends ExtensibleNode {
    readonly id?: string;
    readonly schemaValidation?: ValidateFormSchemaOptions;
    readonly idFormat?: SubmissionIdFormat;
    readonly locale: string;
    readonly submittedAt: string;
    readonly schemaRevision?: number;
    readonly metadata?: TMeta & Readonly<Record<string, JsonValue>>;
}
type SubmissionIdFormat = "uuid" | "ulid" | "custom";
/** Generates a submission identity shared by Core, Controller, and Renderer integrations. */
declare function createSubmissionId(format?: SubmissionIdFormat, factory?: () => string): string;
declare function isSubmissionUlid(value: string): boolean;
interface ToWireOptions {
    readonly requireLocale?: boolean;
}
declare function toFormSubmissionWire<TMeta extends BaseSubmissionMetadata>(submission: FormSubmission<TMeta>): FormSubmissionWire<TMeta>;
declare function toFormSubmissionWire(submission: FormSubmission): FormSubmissionWire;
declare function toFormSubmissionWire<TMeta extends BaseSubmissionMetadata>(submission: StrictFormSubmission<TMeta>, options: {
    readonly requireLocale: true;
}): StrictFormSubmissionWire<TMeta>;
declare function fromFormSubmissionWire<TMeta extends BaseSubmissionMetadata>(wire: FormSubmissionWire<TMeta>): FormSubmission<TMeta>;
declare function fromFormSubmissionWire(wire: FormSubmissionWireSchemaType): FormSubmission;
declare function fromFormSubmissionWire(wire: FormSubmissionWire): FormSubmission;
/** Creates a stable SHA-256 hash for idempotent submission persistence. */
declare function hashFormSubmissionPayload(submission: FormSubmission): Promise<string>;
declare function hashFormSubmissionPayload<TMeta extends BaseSubmissionMetadata | undefined = undefined>(submission: FormSubmission<TMeta>): Promise<string>;
/** Alias kept intentionally descriptive for storage integrations. */
declare const createSubmissionPayloadHash: typeof hashFormSubmissionPayload;
/** Re-validates a submission against the exact schema version used to create it. */
declare function assertValidFormSubmission(schema: FormSchema, submission: FormSubmission, validation?: ValidateFormSchemaOptions): void;
/** Validates a submission with a FormSchema, a Zod-compatible schema, or a callback. */
declare function assertValidFormSubmissionWith<TMeta extends BaseSubmissionMetadata | undefined = undefined>(source: FormSubmissionValidationSource<TMeta>, submission: FormSubmission<TMeta>): Promise<void>;
declare function createSubmission(schema: FormSchema, values: FormValues, options: CreateSubmissionOptions): FormSubmission;
declare function createSubmission<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata>(schema: FormSchema, values: FormValues, options: CreateSubmissionOptions<TMeta>): FormSubmission<TMeta>;
declare function createSubmission<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata>(input: CreateSubmissionInput<TMeta>): FormSubmission<TMeta>;

interface FormTemplate {
    readonly id: string;
    readonly mode: FormContentMode;
    readonly name: string;
    readonly description: string;
    readonly schema: FormSchema;
}
interface GetFormTemplatesOptions {
    readonly mode?: FormContentMode;
    readonly locale?: string;
}
interface CreateSchemaFromTemplateOptions {
    readonly template: FormTemplate;
    readonly id: string;
    readonly title: string;
}
declare function getFormTemplates(options?: GetFormTemplatesOptions): readonly FormTemplate[];
declare function createSchemaFromTemplate(options: CreateSchemaFromTemplateOptions): FormSchema;

declare function isRadioTextAnswer(value: unknown): value is RadioTextAnswer;
declare function isFormValue(value: unknown): value is FormValue;
declare function selectedOptionId(value: unknown): string | undefined;

declare function isDisplayConditionGroupSatisfied(group: DisplayConditionGroup, currentAnswers: Readonly<Record<string, unknown>>): boolean;
declare function isQuestionVisible(question: FormField, currentAnswers: Readonly<Record<string, unknown>>): boolean;
declare function isDisplayConditionSatisfied(condition: DisplayCondition | undefined, currentAnswers: Readonly<Record<string, unknown>>): boolean;
declare function calculatePageVisibility(schema: FormSchema, currentAnswers: Readonly<Record<string, unknown>>): Readonly<Record<string, boolean>>;
declare function calculateFieldVisibility(schema: FormSchema, currentAnswers: Readonly<Record<string, unknown>>): Readonly<Record<string, boolean>>;
declare function selectVisibleAnswers(schema: FormSchema, currentAnswers: FormValues): FormValues;
interface FormProgress {
    readonly visiblePages: number;
    readonly currentPage: number;
    readonly answeredVisibleQuestions: number;
    readonly totalVisibleQuestions: number;
    readonly remainingQuestions: number;
    readonly percent: number;
}
declare function calculateProgress(schema: FormSchema, currentAnswers: Readonly<Record<string, unknown>>, currentPageIndex?: number): FormProgress;

export { AUTHORING_SUGGESTION_JSON_SCHEMA, type AccumulatorReport, type AccumulatorResponse, type AccumulatorSkipReason, type AddFieldOperation, type AddOptionOperation, type AggregationReport, type AggregationSkipReason, type AnswerValidationResult, type AsyncTranslationAdapter, type AuthoringApplyError, type AuthoringApplyOptions, type AuthoringApplyResult, type AuthoringAssistantAdapter, type AuthoringContext, type AuthoringFieldInput, type AuthoringFieldPatch, type AuthoringIntent, type AuthoringOperation, type AuthoringOperationPreview, type AuthoringOptionInput, type AuthoringPreview, type AuthoringPreviewOptions, type AuthoringPreviewValue, type AuthoringRequest, type AuthoringSuggestion, AuthoringSuggestionSchema, type AuthoringTarget, type AuthoringValidationCode, type AuthoringValidationIssue, type AuthoringValidationResult, type BaseField, type BaseFieldConstraintRule, type BaseSubmissionMetadata, type BuildAuthoringContextOptions, type BuilderTranslationKey, CREATION_ASSISTANT_RESPONSE_JSON_SCHEMA, type CanonicalTranslationMetadata, type CheckboxField, type CheckboxQuestionAggregate, type ChoiceDistributionEntry, type ChoiceFieldConstraintRule, type ChoiceOption, type ChoiceQuestionAggregate, type CloneVersionOptions, type CollectedLocales, type CommitVersionTransitionOptions, type ConditionOperator, type ConditionValue, type ContentModeConstraintCode, type ContentModeConstraintIssue, type ContentModeDiagnostic, type ContentModeIssue, type ContentModeIssueCode, type ContentModeSettings, type ContentModeValidationResult, type ContentResultTranslationKey, type CountComparison, type CreateSchemaFromTemplateOptions, type CreateSubmissionInput, type CreateSubmissionOptions, type CreationAssistantAdapter, type CreationAssistantRequest, type CreationAssistantResponse, CreationAssistantResponseSchema, type CreationAuthoringRequestOptions, type CreationBriefField, type CreationBriefReadiness, type CreationClarificationResponse, type CreationDraftResult, type CreationMessage, type CreationQuickReply, type CreationReadyResponse, type CrossFormAnalytics, type CrossFormAnalyticsOptions, type CrossFormScoreSummary, type CrossFormSkipReason, type CrossTabulationResult, type CsvColumnContext, type CsvColumnDef, type CsvColumnDefinition, type CsvExportOptions, type CursorPagingOptions, type CustomFormMetadata, DEFAULT_FIELD_TYPE_DEFINITIONS, DEFAULT_OPTIMIZATION_MINIMUM_SAMPLES, DEFAULT_OPTIMIZATION_THRESHOLDS, type DateField, type DeleteDraftOptions, type DisplayCondition, type DisplayConditionGroup, type DisplayRule, type DurationComparison, EN_MESSAGES, type EmailField, type ExtensibleNode, type FieldCompletedEvent, type FieldConstraintRule, type FieldDisplayCondition, type FieldFocusedEvent, type FieldInteractionAnalytics, type FieldInteractionComparison, type FieldOption, type FieldPresentedEvent, type FieldType, type FieldTypeDefinition, type FormAcceptanceResult, type FormAcceptanceStatus, type FormAnalytics, type FormContentMode, type FormDeletionCounts, type FormDeletionInspection, type FormDeletionRequest, type FormDeletionResult, type FormDeletionScope, type FormEngineMessages, type FormEngineTranslationKey, type FormEngineTranslator, type FormEngineTranslatorOptions, type FormEvent, type FormEventType, type FormExitedEvent, type FormField, type FormInteractionAnalytics, type FormInteractionEvent, type FormInteractionEventBase, type FormInteractionEventType, type FormInteractionFunnel, type FormLifecycleAdapter, type FormLifecycleBackend, type FormLifecycleOptions, type FormOptimizationInsight, type FormOptimizationInsightType, type FormOptimizationMetric, type FormOptimizationReport, type FormPage, type FormPolicy, type FormProgress, type FormResource, type FormResourceKind, type FormResponse, type FormSchema, type FormStartedEvent, type FormStorageAdapter, type FormSubmission, FormSubmissionError, FormSubmissionMetadataSchema, type FormSubmissionSerializedError, type FormSubmissionSettings, type FormSubmissionValidationSource, type FormSubmissionValidator, type FormSubmissionValidatorResult, type FormSubmissionWire, FormSubmissionWireSchema, type FormSubmissionWireSchemaType, type FormSubmitAttemptedEvent, type FormSubmitFailedEvent, type FormSubmittedEvent, type FormTelemetryAdapter, type FormTelemetryContextValue, type FormTemplate, type FormValue, type FormValues, type FormVersionRecord, type FormVersionState, type FormVersionStatus, type FormVersionTransitionPlan, type FormViewedEvent, type FunnelInteractionComparison, type GetFormTemplatesOptions, type InteractionAnalyticsComparison, type InteractionAnalyticsOptions, JA_COMPARISON_MESSAGES, JA_MESSAGES, type JsonValue, type KnownBuilderTranslationKey, type LegacyTranslationMetadata, type LocaleOption, type LocalizedText, type MetadataCsvExportOptions, type MigrateSchemaTranslationMetadataOptions, type MultiSelectField, type NodeWritableStream, type NumberField, type NumberQuestionAggregate, type NumericSummary, type OptimizationInsightOptions, type OptimizationInsightThresholds, type OptionAggregate, type PageCompletedEvent, type PageInteractionAnalytics, type PageInteractionComparison, type PageViewedEvent, type PagedSubmissionStorageAdapter, type PaginatedResult, type PaginationIteratorOptions, type PollAccessContext, type PollMetadata, type PollRuntimeAdapter, type PopulateTranslationOptions, type PopulateTranslationsOptions, type PrivacyEngine, type PublishDraftOptions, type PublishDraftResult, type Question, type QuestionAggregate, type QuestionType, type QuizEvaluationResult, type QuizFieldMetadata, type QuizMetadata, type QuizQuestionEvaluation, type QuizQuestionResult, type QuizResult, type RadioTextAnswer, type RateComparison, type RateLimiter, type RatingField, type RatingFieldConstraintRule, type RendererTranslationKey, type ResponseAccumulator, type ResponseAccumulatorOptions, type ResponseSummaryData, type ResponseSummaryInput, type ResponseSummaryLabels, type ResponseSummaryLanguageAggregate, type ResponseSummaryQuestion, type ResponseSummarySkipReason, type Result, type SanitizeSchemaOptions, type SaveSubmissionOptions, type SchemaDomainCodec, type SchemaIssue, type SchemaStructureIssue, type SchemaStructureIssueType, type SchemaTranslations, type SchemaValidationResult, type SelectField, type SensitiveDataFinding, type StorageAdapter, type StorageCommitError, type StorageCursor, type StorageFilterCriteria, type StorageSubmissionExportOptions, type StreamCsvOptions, type StrictFormSubmission, type StrictFormSubmissionWire, StrictFormSubmissionWireSchema, type StrictFormSubmissionWireSchemaType, type SubmissionCodec, type SubmissionCodecFailure, type SubmissionCodecResult, type SubmissionCursorPayload, type SubmissionCursorValue, type SubmissionFilter, type SubmissionGuard, type SubmissionGuardContext, type SubmissionGuardResult, type SubmissionIdFormat, type SubmissionPage, type SubmissionPageQueryOptions, type SubmissionPipeline, type SubmissionPipelineOptions, type SubmissionPipelineResult, type SubmissionQueryOptions, type SubmissionSaveResult, type SubmissionSchema, type SubmissionValidationResult, type SurveyCreationBrief, SurveyCreationBriefSchema, type TelField, type TextAnswerCursorPayload, type TextAnswerCursorValue, type TextAnswerItem, type TextAnswerPage, type TextAnswerPageQueryOptions, type TextField, type TextFieldConstraintRule, type TextQuestionAggregate, type TimeField, type ToWireOptions, type TranslationAdapter, type TranslationComparisonTranslationKey, type TranslationFailure, type TranslationMetadataMigrator, type TranslationMigrationContext, type TranslationMissingKeyEvent, type TranslationProgress, type TranslationProviderError, type TranslationReport, type TranslationSlot, type TranslationStatus, type TranslationTargetKind, type TranslationWorkspaceCustomDictionary, type TranslationWorkspaceDetailedKey, type TranslationWorkspaceTranslationKey, type TrpcFormSubmissionErrorData, type TrpcProcedureType, type TrpcSubmissionErrorAdapter, type TrpcSubmissionErrorFormatter, type TrpcSubmissionErrorFormatterOptions, type TrpcSubmissionErrorIntegration, type TrpcSubmissionErrorShape, type TypedExtensibleNode, type TypedFieldOption, type TypedFormField, type TypedFormSchema, type TypedFormStorageAdapter, type TypedPagedSubmissionStorageAdapter, type TypedStorageAdapter, type TypedStreamCsvOptions, type TypedSubmissionPage, type TypedSubmissionPageQueryOptions, type TypedTextAnswerItem, type TypedTextAnswerPage, type UnifiedSubmissionStorageAdapter, type UpdateFieldOperation, type UpdateFormOperation, type UpdateOptionOperation, type UrlField, type ValidateFormSchemaOptions, type ValidationCode, type ValidationError, type ValidationFailedEvent, type ValidationIssue, type VersionTransitionContext, type VersionTransitionError, type VersionTransitionEvent, type VersionTransitionPlan, type VersionedFormStorageAdapter, type WebhookConfig, type WebhookDispatchResult, aggregateForms, aggregateInteractionEvents, aggregateResponses, analyzeInteractionAnalytics, applyAuthoringSuggestion, applyTransitionPlan, assertValidFormSchema, assertValidFormSubmission, assertValidFormSubmissionWith, assertVersionMutable, buildAuthoringContext, calculateChoiceDistribution, calculateCrossTabulation, calculateFieldVisibility, calculateNumericSummary, calculatePageVisibility, calculateProgress, canGenerateCreationDraft, canShowPollResults, cloneVersionToDraft, collectSchemaLocales, collectTranslationSlots, commitVersionTransition, compareInteractionAnalytics, computeAuthoringSchemaHash, computeSourceTextHash, contentMetadataToJson, createChallengeGuard, createCloneTransitionPlan, createDeleteDraftTransitionPlan, createFormEngineTranslator, createFormLifecycleAdapter, createFormSubmissionSchema, createHoneypotGuard, createInitialSchemaByMode, createMemoryRateLimiter, createPublishTransitionPlan, createRateLimitGuard, createResponseAccumulator, createSchemaDomainCodec, createSchemaFromTemplate, createSubmission, createSubmissionId, createSubmissionPayloadHash, createSubmissionPipeline, createTrpcSubmissionErrorAdapter, createTrpcSubmissionErrorFormatter, createTrpcSubmissionErrorIntegration, decodeStorageSubmissionCursor, decodeStorageTextAnswerCursor, decodeSubmissionCursor, decodeTextAnswerCursor, deleteDraft, deserializeSubmissionError, deserializeSubmissionErrorFromTrpc, dispatchWebhook, emptyFormDeletionCounts, encodeStorageSubmissionCursor, encodeStorageTextAnswerCursor, encodeSubmissionCursor, encodeTextAnswerCursor, escapeCsvCell, evaluateCreationBriefReadiness, evaluateQuiz, evaluateQuizLocally, exportResponsesToCsv, exportResponsesToCsvStream, fromFormSubmissionWire, getContentModeDiagnostics, getContentModePolicy, getFormAcceptanceStatus, getFormContentMode, getFormTemplates, getTranslationStatus, getTrpcSubmissionErrorData, hashFormSubmissionPayload, isDisplayConditionGroupSatisfied, isDisplayConditionSatisfied, isFormSubmissionSerializedError, isFormValue, isManualTranslationMetadata, isQuestionVisible, isRadioTextAnswer, isSubmissionUlid, iterateSubmissionPages, jsonValuesEqual, mapField, mapOption, mapPage, mapSchema, mapSchemaNode, matchesSubmissionFilter, matchesSubmissionPageFilters, mergeSurveyCreationBrief, migrateSchemaTranslationMetadata, normalizeLocale, normalizeSubmissionPageSize, normalizeTranslationMetadata, paginateWithFilter, parseAuthoringSuggestion, parseCreationAssistantResponse, parseSurveyCreationBrief, pipeResponsesToCsvStream, populateSchemaTranslations, previewAuthoringSuggestion, publishDraft, readPollMetadata, readQuizFieldMetadata, readQuizMetadata, removeLocaleFromSchema, resolveContentModeSettings, resolveFormTranslation, resolveLocalizedSchema, runSubmissionPipeline, sanitizeSchema, selectVisibleAnswers, selectedOptionId, serializeSubmissionError, serializeSubmissionErrorForTrpc, shuffleOptions, toFormSubmissionWire, toResponseSummary, transformFieldType, trpcSubmissionErrorAdapter, validateAnswers, validateAuthoringSuggestion, validateContentMode, validateContentModeConstraints, validateFieldValue, validateFormSchema, validatePageAnswers, validateSchemaStructure, validateSubmission };
