import { JsonValue, TranslationAdapter, FormSchema, TranslationReport, TextAnswerItem, FormResponse, FormField, FormAnalytics, QuestionAggregate, FormVersionRecord, FormVersionState, QuestionType, FormEngineTranslator } from '@form-engine-ts/core';
import { FormBuilderProps, useFormBuilder } from '@form-engine-ts/react';
import { SensitiveDataFinding } from '@form-engine-ts/privacy';
import { ReactNode } from 'react';

interface SurveyTranslationAdapter extends TranslationAdapter {
    readonly translateText?: (text: string, targetLocale: string, sourceLocale?: string, signal?: AbortSignal) => Promise<string>;
    readonly translateBatch?: (texts: readonly string[], targetLocale: string, sourceLocale?: string, signal?: AbortSignal) => Promise<readonly string[]>;
}
interface SurveyUiProviderProps {
    readonly locale?: string;
    readonly fallbackLocale?: string;
    readonly namespaces?: readonly string[];
    readonly commonNamespace?: string;
    readonly customSurveyNamespace?: string;
    /** Accepts an application i18next instance without requiring an i18next dependency. */
    readonly i18n?: SurveyI18n;
    readonly translationAdapter?: SurveyTranslationAdapter;
    readonly translator?: (key: string, params?: Record<string, unknown>) => string;
    readonly translation?: SurveyTranslationInput;
    readonly children: ReactNode;
}
interface SurveyProviderProps extends SurveyUiProviderProps {
}
interface SurveyTranslationScope {
    readonly locale: string;
    readonly common: (key: string, options?: Record<string, unknown>) => string;
    readonly customSurvey: (key: string, options?: Record<string, unknown>) => string;
}
/** Input form kept compatible with v7.4 scopes; providers fill locale from their active UI locale. */
type SurveyTranslationInput = Omit<SurveyTranslationScope, "locale"> & {
    readonly locale?: string;
};
/** Minimal i18next-compatible surface; the full i18next instance can be supplied structurally. */
interface SurveyI18n {
    readonly language?: string;
    t(key: string, params?: Readonly<Record<string, unknown>>): unknown;
}
/** Maps an application-owned survey record to the Form Engine schema used by headless UI primitives. */
interface SurveySchemaDomainAdapter<TDomain> {
    readonly toFormSchema: (domain: TDomain) => FormSchema;
}
interface SurveyEditorDomainAdapter<TDomain> extends SurveySchemaDomainAdapter<TDomain> {
    readonly fromFormSchema: (schema: FormSchema, previous: TDomain) => TDomain;
}
type EditorRenderProps = SurveyEditorRenderProps;
interface SurveyEditorDomainSlots {
    readonly cardAppearance?: (props: EditorRenderProps) => ReactNode;
    readonly submissionSettings?: (props: EditorRenderProps) => ReactNode;
    readonly translationSettings?: (props: EditorRenderProps) => ReactNode;
    readonly validationPolicy?: (props: EditorRenderProps) => ReactNode;
    readonly toolbar?: (props: EditorRenderProps) => ReactNode;
    readonly notifications?: (props: EditorRenderProps) => ReactNode;
}
interface SurveyEditorDomainAdapterOptions<TDomain> {
    readonly domain: TDomain;
    readonly domainAdapter: SurveyEditorDomainAdapter<TDomain>;
    readonly adapter: SurveyEditorDomainActionsAdapter<TDomain>;
    readonly onDomainChange?: (domain: TDomain) => void;
    readonly slots?: SurveyEditorDomainSlots;
    readonly domainMetadata?: unknown;
}
interface SurveyEditorTranslateRequest {
    readonly schema: FormSchema;
    readonly sourceLocale: string;
    readonly targetLocale: string;
    readonly signal: AbortSignal;
}
interface SurveyEditorAdapter {
    /** @deprecated Use SurveyEditorActionsAdapter. */
    readonly translate?: (request: SurveyEditorTranslateRequest) => Promise<FormSchema>;
    /** @deprecated Use SurveyEditorActionsAdapter. */
    readonly save?: (schema: FormSchema) => Promise<void>;
    /** Translates the survey preview and returns the updated schema. */
    readonly translateSurveyPreview?: (request: SurveyEditorTranslateRequest) => Promise<FormSchema>;
    /** Persists the current survey draft. */
    readonly updateSurveyDraft?: (schema: FormSchema) => Promise<void>;
}
interface SurveyEditorActionsAdapter {
    readonly translateSurveyPreview: (request: SurveyEditorTranslateRequest) => Promise<FormSchema>;
    readonly updateSurveyDraft: (schema: FormSchema) => Promise<void>;
}
interface SurveyEditorDomainActionsAdapter<TDomain> {
    readonly translateSurveyPreview: (request: SurveyEditorTranslateRequest & {
        readonly domain: TDomain;
    }) => Promise<TDomain>;
    readonly updateSurveyDraft: (domain: TDomain) => Promise<void>;
    readonly updateSurveyDraftResult?: (domain: TDomain) => Promise<TDomain>;
}
interface SurveyEditorQuestionRequest<TDomain> {
    readonly domain: TDomain;
    readonly schema: FormSchema;
    readonly signal: AbortSignal;
}
interface SurveyEditorQuestionAdapter<TDomain> {
    readonly addQuestion?: (request: SurveyEditorQuestionRequest<TDomain> & {
        readonly question: FormField;
        readonly index: number;
    }) => Promise<void> | Promise<TDomain>;
    readonly reorderQuestions?: (request: SurveyEditorQuestionRequest<TDomain> & {
        readonly fieldIds: readonly string[];
    }) => Promise<void> | Promise<TDomain>;
    readonly removeQuestion?: (request: SurveyEditorQuestionRequest<TDomain> & {
        readonly question: FormField;
        readonly index: number;
    }) => Promise<void> | Promise<TDomain>;
}
interface SurveyEditorConfigurationSlots {
    readonly cardSettings?: ReactNode;
    readonly responseSettings?: ReactNode;
    readonly validationPolicy?: ReactNode;
}
interface UseSurveyEditorDomainOptions<TDomain> extends Omit<UseSurveyEditorOptions, "schema" | "adapter" | "onChange"> {
    readonly domain: TDomain;
    readonly domainAdapter: SurveySchemaDomainAdapter<TDomain> & {
        readonly fromFormSchema: (schema: FormSchema, previous: TDomain) => TDomain;
    };
    readonly adapter: SurveyEditorDomainActionsAdapter<TDomain>;
    readonly questionAdapter?: SurveyEditorQuestionAdapter<TDomain>;
    readonly onDomainChange?: (domain: TDomain) => void;
    readonly slots?: SurveyEditorDomainSlots;
    readonly domainMetadata?: unknown;
}
type SurveyEditorAdapterInput = SurveyEditorAdapter | SurveyEditorActionsAdapter;
type SurveyEditorOperationStatus = "idle" | "loading" | "success" | "error";
interface SurveyEditorOperationState {
    readonly status: SurveyEditorOperationStatus;
    readonly error?: Error;
    readonly report?: TranslationReport;
}
interface SurveyEditorRenderProps {
    readonly schema: FormSchema;
    readonly sourceLocale: string;
    readonly targetLocale: string;
    readonly state: SurveyEditorOperationState;
    readonly save: () => Promise<boolean>;
    readonly translate: () => Promise<boolean>;
    readonly dirty?: boolean;
}
interface SurveyEditorSlots {
    readonly toolbar?: (props: SurveyEditorRenderProps) => ReactNode;
    readonly after?: (props: SurveyEditorRenderProps) => ReactNode;
    readonly status?: (props: SurveyEditorOperationState) => ReactNode;
    readonly notifications?: (props: SurveyEditorRenderProps) => ReactNode;
    readonly cardSettings?: (props: SurveyEditorRenderProps) => ReactNode;
    readonly cardAppearance?: (props: SurveyEditorRenderProps) => ReactNode;
    readonly responseSettings?: (props: SurveyEditorRenderProps) => ReactNode;
    readonly translationSettings?: (props: SurveyEditorRenderProps) => ReactNode;
    readonly submissionSettings?: (props: SurveyEditorRenderProps) => ReactNode;
    readonly validationPolicy?: (props: SurveyEditorRenderProps) => ReactNode;
}
interface SurveyEditorProps extends Omit<FormBuilderProps, "schema" | "onChange" | "locale" | "translationAdapter" | "translator" | "slots"> {
    readonly schema: FormSchema;
    readonly adapter: SurveyEditorAdapter;
    readonly onChange?: (schema: FormSchema) => void;
    readonly locale?: string;
    readonly sourceLocale?: string;
    readonly targetLocale?: string;
    readonly render?: (props: SurveyEditorRenderProps) => ReactNode;
    readonly slots?: SurveyEditorSlots;
    readonly saveLabel?: string;
    readonly translateLabel?: string;
}
interface UseSurveyEditorOptions extends Omit<SurveyEditorProps, "render" | "slots" | "saveLabel" | "translateLabel"> {
}
interface FreeTextAnswerItem {
    readonly id: string;
    readonly responseId: string;
    readonly fieldId: string;
    readonly text: string;
    readonly sourceLanguage: string;
    readonly metadata?: Readonly<Record<string, JsonValue>>;
    readonly findings?: readonly SensitiveDataFinding[];
}
type FreeTextAnswerSource = FreeTextAnswerItem | FormResponse;
type FreeTextAnswerInput = FreeTextAnswerItem | TextAnswerItem | FormResponse;
interface FreeTextAnswerDomainAdapter<TDomain> {
    readonly toFreeTextAnswerItem: (domain: TDomain) => FreeTextAnswerItem;
}
interface FreeTextTranslationRequest {
    readonly items: readonly FreeTextAnswerItem[];
    readonly targetLanguage: string;
    readonly sourceLanguage: string;
    readonly signal: AbortSignal;
}
interface FreeTextTranslationResult {
    readonly id: string;
    readonly text: string;
}
interface FreeTextTranslationAdapter {
    readonly translateBatch: (request: FreeTextTranslationRequest) => Promise<readonly FreeTextTranslationResult[]>;
}
interface TranslateFreeTextAnswersOptions {
    readonly targetLanguage: string;
    readonly sourceLanguage?: string;
    readonly batchSize?: number;
    readonly piiConfirmed?: boolean;
    readonly onPiiConfirmation?: (findings: readonly SensitiveDataFinding[]) => boolean | Promise<boolean>;
    readonly detectPii?: (item: FreeTextAnswerItem) => readonly SensitiveDataFinding[];
    readonly signal?: AbortSignal;
}
interface FreeTextTranslationOutcomeItem extends FreeTextAnswerItem {
    readonly status: "pending" | "success" | "error";
    readonly translatedText?: string;
    readonly error?: Error;
}
type FreeTextTranslationOutcomeStatus = "success" | "partial" | "error" | "cancelled" | "needs_confirmation";
interface FreeTextTranslationOutcome {
    readonly status: FreeTextTranslationOutcomeStatus;
    readonly items: readonly FreeTextTranslationOutcomeItem[];
    readonly findings: readonly SensitiveDataFinding[];
    readonly succeeded: number;
    readonly failed: number;
    readonly failures: readonly {
        readonly item: FreeTextAnswerItem;
        readonly cause: unknown;
    }[];
    readonly error?: Error;
}
type DirectFreeTextTranslationOptions = Omit<TranslateFreeTextAnswersOptions, "targetLanguage"> & {
    readonly targetLanguage?: string;
};
interface FreeTextTranslationController {
    readonly translate: (items: readonly FreeTextAnswerInput[], options?: DirectFreeTextTranslationOptions) => Promise<FreeTextTranslationOutcome>;
}
interface CreateFreeTextTranslationControllerOptions {
    readonly adapter: FreeTextTranslationAdapter;
    readonly targetLanguage: string;
    readonly sourceLanguage?: string;
    readonly batchSize?: number;
    readonly detectPii?: (item: FreeTextAnswerItem) => readonly SensitiveDataFinding[];
    readonly onPiiConfirmation?: TranslateFreeTextAnswersOptions["onPiiConfirmation"];
}
type FreeTextItemStatus = "idle" | "pending" | "translating" | "success" | "error";
interface FreeTextTranslationItemState extends FreeTextAnswerItem {
    readonly status: FreeTextItemStatus;
    readonly translatedText?: string;
    readonly error?: Error;
}
type FreeTextTranslationStatus = "idle" | "translating" | "success" | "error" | "needs_confirmation";
interface FreeTextTranslationState {
    readonly status: FreeTextTranslationStatus;
    readonly items: readonly FreeTextTranslationItemState[];
    readonly selectedIds: readonly string[];
    readonly targetLanguage: string;
    readonly sourceLanguage: string;
    readonly findings: readonly SensitiveDataFinding[];
    readonly error?: Error;
}
interface UseFreeTextAnswerTranslationOptions {
    readonly items: readonly FreeTextAnswerInput[];
    readonly adapter: FreeTextTranslationAdapter;
    readonly targetLanguage: string;
    readonly sourceLanguage?: string;
    readonly batchSize?: number;
    readonly detectPii?: (item: FreeTextAnswerItem) => readonly SensitiveDataFinding[];
    readonly onPiiConfirmation?: TranslateFreeTextAnswersOptions["onPiiConfirmation"];
}
interface UseFreeTextDomainAnswerTranslationOptions<TDomain> extends Omit<UseFreeTextAnswerTranslationOptions, "items"> {
    readonly items: readonly TDomain[];
    readonly domainAdapter: FreeTextAnswerDomainAdapter<TDomain>;
}
interface UseFreeTextDomainAnswerTranslationResult<TDomain> extends Omit<UseFreeTextAnswerTranslationResult, "translate"> {
    /** Translates application-owned answer records directly while preserving adapter-provided IDs. */
    readonly translate: (items: readonly TDomain[], options?: DirectFreeTextTranslationOptions) => Promise<FreeTextTranslationOutcome>;
}
interface UseFreeTextAnswerTranslationResult extends FreeTextTranslationState {
    readonly setSelected: (id: string, selected: boolean) => void;
    readonly selectAll: () => void;
    readonly clearSelection: () => void;
    readonly confirmPii: () => Promise<FreeTextTranslationState>;
    readonly cancelPii: () => void;
    readonly translateSelected: () => Promise<FreeTextTranslationState>;
    /** Translates any answer array without changing the current selection. */
    readonly translate: (items: readonly FreeTextAnswerInput[], options?: DirectFreeTextTranslationOptions) => Promise<FreeTextTranslationOutcome>;
    readonly reset: () => void;
}
interface FreeTextAnswerTranslationSlots {
    readonly renderItem?: (item: FreeTextTranslationItemState, selected: boolean) => ReactNode;
    readonly renderPiiConfirmation?: (findings: readonly SensitiveDataFinding[], confirm: () => void, cancel: () => void) => ReactNode;
}
interface FreeTextAnswerTranslationsProps extends UseFreeTextAnswerTranslationOptions {
    readonly slots?: FreeTextAnswerTranslationSlots;
    readonly title?: string;
    readonly translateLabel?: string;
}
type SurveyFreeTextTableProps = FreeTextAnswerTranslationsProps;
interface QualityIssue {
    readonly code: string;
    readonly message: string;
    readonly path?: string;
    readonly severity?: "warning" | "error";
    readonly metadata?: Readonly<Record<string, JsonValue>>;
}
type QualityCheckStatus = "idle" | "running" | "passed" | "failed" | "error" | "RUNNING" | "COMPLETED" | "FAILED" | "STALE";
interface QualityCheckResult<TResponse = unknown> {
    readonly issues: readonly QualityIssue[];
    readonly status?: QualityCheckStatus;
    readonly payload?: TResponse;
    /** The provider response is kept intact for domain-specific quality UIs and logging. */
    readonly response?: TResponse;
    readonly rawResponse?: TResponse;
    readonly metadata?: Readonly<Record<string, JsonValue>>;
    readonly runId?: string;
    readonly checkedRevision?: string | number;
}
type SurveyVersionQualityStatus = "RUNNING" | "COMPLETED" | "FAILED" | "STALE";
interface SurveyVersionQualityResult<TQualityPayload = unknown> {
    readonly status: SurveyVersionQualityStatus;
    readonly runId?: string;
    readonly checkedRevision?: number;
    readonly issues: readonly QualityIssue[];
    readonly payload?: TQualityPayload;
}
interface SurveyVersionActionResult<TData = void> {
    readonly succeeded: boolean;
    readonly data?: TData;
    readonly error?: Error;
    readonly requiresConfirmation?: boolean;
    readonly cause?: unknown;
    readonly response?: unknown;
    readonly metadata?: Readonly<Record<string, JsonValue>>;
}
type QualityIssueDecision = "accept" | "reject";
type SurveyVersionAdapterResponse<TData = void> = Promise<TData> | Promise<SurveyVersionActionResult<TData>>;
interface SurveyVersionOperationRequest {
    readonly version: FormVersionRecord | FormSchema;
    readonly state?: FormVersionState;
    readonly signal: AbortSignal;
}
interface SurveyVersionPublishRequest extends SurveyVersionOperationRequest {
    readonly allowWarnings: boolean;
}
interface SurveyVersionQualityIssueDecisionRequest extends SurveyVersionOperationRequest {
    readonly issue: QualityIssue;
    readonly decision: QualityIssueDecision;
}
/** Transport-neutral lifecycle operations used by survey clients. */
interface SurveyVersionActionsAdapter {
    readonly publish: (request: SurveyVersionPublishRequest) => Promise<void>;
    readonly publishResult?: (request: SurveyVersionPublishRequest) => Promise<SurveyVersionActionResult>;
    readonly runQualityCheck: (request: SurveyVersionOperationRequest) => Promise<QualityCheckResult>;
    readonly decideQualityIssue: (request: SurveyVersionQualityIssueDecisionRequest) => Promise<void>;
    readonly decideQualityIssueResult?: (request: SurveyVersionQualityIssueDecisionRequest) => Promise<SurveyVersionActionResult>;
    readonly cloneDraft: (request: SurveyVersionOperationRequest) => Promise<void>;
    readonly cloneDraftResult?: (request: SurveyVersionOperationRequest) => Promise<SurveyVersionActionResult>;
    readonly deleteDraft: (request: SurveyVersionOperationRequest) => Promise<void>;
    readonly deleteDraftResult?: (request: SurveyVersionOperationRequest) => Promise<SurveyVersionActionResult>;
    readonly setVisibility: (request: SurveyVersionOperationRequest & {
        readonly status: "draft" | "published" | "archived";
    }) => Promise<void>;
    readonly setVisibilityResult?: (request: SurveyVersionOperationRequest & {
        readonly status: "draft" | "published" | "archived";
    }) => Promise<SurveyVersionActionResult>;
}
interface SurveyVersionQualityActions<TVersion = FormVersionRecord | FormSchema, TState = FormVersionState> {
    readonly publish?: (request: DomainSurveyVersionPublishRequest<TVersion, TState>) => Promise<void>;
    readonly publishResult?: (request: DomainSurveyVersionPublishRequest<TVersion, TState>) => Promise<SurveyVersionActionResult>;
    readonly runQualityCheck?: (request: DomainSurveyVersionOperationRequest<TVersion, TState>) => Promise<QualityCheckResult>;
    readonly decideQualityIssue?: (request: DomainSurveyVersionQualityIssueDecisionRequest<TVersion, TState>) => Promise<void>;
    readonly decideQualityIssueResult?: (request: DomainSurveyVersionQualityIssueDecisionRequest<TVersion, TState>) => Promise<SurveyVersionActionResult>;
}
interface SurveyVersionDomainQualityActions<TVersion, TState = unknown, TQualityPayload = unknown> {
    readonly publish?: (request: DomainSurveyVersionPublishRequest<TVersion, TState>) => Promise<void>;
    readonly publishResult?: (request: DomainSurveyVersionPublishRequest<TVersion, TState>) => Promise<SurveyVersionActionResult>;
    readonly runQualityCheck?: (request: DomainSurveyVersionOperationRequest<TVersion, TState>) => Promise<QualityCheckResult<TQualityPayload>>;
    readonly decideQualityIssue?: (request: DomainSurveyVersionQualityIssueDecisionRequest<TVersion, TState>) => Promise<void>;
    readonly decideQualityIssueResult?: (request: DomainSurveyVersionQualityIssueDecisionRequest<TVersion, TState>) => Promise<SurveyVersionActionResult>;
}
interface SurveyVersionLifecycleActions<TVersion = FormVersionRecord | FormSchema, TState = FormVersionState> {
    readonly cloneDraft?: (request: DomainSurveyVersionOperationRequest<TVersion, TState>) => Promise<void>;
    readonly cloneDraftResult?: (request: DomainSurveyVersionOperationRequest<TVersion, TState>) => Promise<SurveyVersionActionResult>;
    readonly deleteDraft?: (request: DomainSurveyVersionOperationRequest<TVersion, TState>) => Promise<void>;
    readonly deleteDraftResult?: (request: DomainSurveyVersionOperationRequest<TVersion, TState>) => Promise<SurveyVersionActionResult>;
    readonly setVisibility?: (request: DomainSurveyVersionOperationRequest<TVersion, TState> & {
        readonly status: "draft" | "published" | "archived";
    }) => Promise<void>;
    readonly setVisibilityResult?: (request: DomainSurveyVersionOperationRequest<TVersion, TState> & {
        readonly status: "draft" | "published" | "archived";
    }) => Promise<SurveyVersionActionResult>;
}
/** @deprecated Use SurveyVersionActionsAdapter. Kept as a structural compatibility contract. */
interface SurveyVersionAdapter {
    readonly publish?: (request: SurveyVersionPublishRequest) => Promise<void>;
    readonly publishResult?: (request: SurveyVersionPublishRequest) => Promise<SurveyVersionActionResult>;
    readonly runQualityCheck?: (request: SurveyVersionOperationRequest) => Promise<QualityCheckResult>;
    readonly decideQualityIssue?: (request: SurveyVersionQualityIssueDecisionRequest) => Promise<void>;
    readonly decideQualityIssueResult?: (request: SurveyVersionQualityIssueDecisionRequest) => Promise<SurveyVersionActionResult>;
    readonly cloneDraft?: (request: SurveyVersionOperationRequest) => Promise<void>;
    readonly cloneDraftResult?: (request: SurveyVersionOperationRequest) => Promise<SurveyVersionActionResult>;
    readonly deleteDraft?: (request: SurveyVersionOperationRequest) => Promise<void>;
    readonly deleteDraftResult?: (request: SurveyVersionOperationRequest) => Promise<SurveyVersionActionResult>;
    readonly setVisibility?: (request: SurveyVersionOperationRequest & {
        readonly status: "draft" | "published" | "archived";
    }) => Promise<void>;
    readonly setVisibilityResult?: (request: SurveyVersionOperationRequest & {
        readonly status: "draft" | "published" | "archived";
    }) => Promise<SurveyVersionActionResult>;
    readonly qualityCheck?: (request: SurveyVersionOperationRequest) => Promise<QualityCheckResult>;
    readonly duplicate?: (request: SurveyVersionOperationRequest) => Promise<void>;
    readonly duplicateResult?: (request: SurveyVersionOperationRequest) => Promise<SurveyVersionActionResult>;
    readonly delete?: (request: SurveyVersionOperationRequest) => Promise<void>;
    readonly deleteResult?: (request: SurveyVersionOperationRequest) => Promise<SurveyVersionActionResult>;
    readonly setStatus?: (request: SurveyVersionOperationRequest & {
        readonly status: "draft" | "published" | "archived";
    }) => Promise<void>;
    readonly setStatusResult?: (request: SurveyVersionOperationRequest & {
        readonly status: "draft" | "published" | "archived";
    }) => Promise<SurveyVersionActionResult>;
    readonly invalidate?: () => void | Promise<void>;
    readonly notify?: (event: SurveyVersionActionEvent) => void;
}
interface SurveyVersionActionEvent {
    readonly operation: SurveyVersionOperationName;
    readonly result: SurveyVersionActionResult;
}
interface DomainSurveyVersionOperationRequest<TVersion, TState = unknown> {
    readonly version: TVersion;
    readonly state?: TState;
    readonly signal: AbortSignal;
}
interface DomainSurveyVersionPublishRequest<TVersion, TState = unknown> extends DomainSurveyVersionOperationRequest<TVersion, TState> {
    readonly allowWarnings: boolean;
}
interface DomainSurveyVersionQualityIssueDecisionRequest<TVersion, TState = unknown> extends DomainSurveyVersionOperationRequest<TVersion, TState> {
    readonly issue: QualityIssue;
    readonly decision: QualityIssueDecision;
}
/** Optional action units for applications that only implement part of the lifecycle. */
type SurveyVersionActionAdapter<TVersion = FormVersionRecord | FormSchema, TState = FormVersionState> = SurveyVersionQualityActions<TVersion, TState> & SurveyVersionLifecycleActions<TVersion, TState> & {
    readonly invalidate?: () => void | Promise<void>;
    readonly notify?: (event: SurveyVersionActionEvent) => void;
    readonly qualityCheck?: (request: DomainSurveyVersionOperationRequest<TVersion, TState>) => Promise<QualityCheckResult>;
    readonly duplicate?: (request: DomainSurveyVersionOperationRequest<TVersion, TState>) => Promise<void>;
    readonly duplicateResult?: (request: DomainSurveyVersionOperationRequest<TVersion, TState>) => Promise<SurveyVersionActionResult>;
    readonly delete?: (request: DomainSurveyVersionOperationRequest<TVersion, TState>) => Promise<void>;
    readonly deleteResult?: (request: DomainSurveyVersionOperationRequest<TVersion, TState>) => Promise<SurveyVersionActionResult>;
    readonly setStatus?: (request: DomainSurveyVersionOperationRequest<TVersion, TState> & {
        readonly status: "draft" | "published" | "archived";
    }) => Promise<void>;
    readonly setStatusResult?: (request: DomainSurveyVersionOperationRequest<TVersion, TState> & {
        readonly status: "draft" | "published" | "archived";
    }) => Promise<SurveyVersionActionResult>;
};
type SurveyVersionDomainActionAdapter<TVersion, TState = unknown, TQualityPayload = unknown> = SurveyVersionDomainQualityActions<TVersion, TState, TQualityPayload> & SurveyVersionLifecycleActions<TVersion, TState> & {
    readonly invalidate?: () => void | Promise<void>;
    readonly notify?: (event: SurveyVersionActionEvent) => void;
    readonly qualityCheck?: (request: DomainSurveyVersionOperationRequest<TVersion, TState>) => Promise<QualityCheckResult<TQualityPayload>>;
    readonly duplicate?: (request: DomainSurveyVersionOperationRequest<TVersion, TState>) => Promise<void>;
    readonly duplicateResult?: (request: DomainSurveyVersionOperationRequest<TVersion, TState>) => Promise<SurveyVersionActionResult>;
    readonly delete?: (request: DomainSurveyVersionOperationRequest<TVersion, TState>) => Promise<void>;
    readonly deleteResult?: (request: DomainSurveyVersionOperationRequest<TVersion, TState>) => Promise<SurveyVersionActionResult>;
    readonly setStatus?: (request: DomainSurveyVersionOperationRequest<TVersion, TState> & {
        readonly status: "draft" | "published" | "archived";
    }) => Promise<void>;
    readonly setStatusResult?: (request: DomainSurveyVersionOperationRequest<TVersion, TState> & {
        readonly status: "draft" | "published" | "archived";
    }) => Promise<SurveyVersionActionResult>;
};
type SurveyVersionOperationName = "runQualityCheck" | "publish" | "decideQualityIssue" | "cloneDraft" | "deleteDraft" | "setVisibility" | "qualityCheck" | "duplicate" | "delete" | "setStatus";
type SurveyVersionOperationStatus = "idle" | "loading" | "success" | "error" | "needs_confirmation";
interface SurveyVersionOperationState {
    readonly status: SurveyVersionOperationStatus;
    readonly error?: Error;
    readonly result?: SurveyVersionActionResult;
}
interface SurveyVersionQualityState<TQualityPayload = unknown> {
    readonly status: SurveyVersionOperationStatus;
    readonly checkStatus?: QualityCheckStatus;
    readonly error?: Error;
    readonly cause?: unknown;
    readonly result?: QualityCheckResult<TQualityPayload>;
    readonly issues?: readonly QualityIssue[];
    readonly runId?: string;
    readonly checkedRevision?: string | number;
}
interface UseSurveyVersionOperationsOptions {
    readonly version: FormVersionRecord | FormSchema;
    readonly state?: FormVersionState;
    readonly adapter: SurveyVersionAdapter;
}
interface UseSurveyVersionOperationsResult {
    readonly quality: SurveyVersionQualityState;
    readonly qualityDecisions: Readonly<Record<string, QualityIssueDecision>>;
    readonly operations: Readonly<Record<SurveyVersionOperationName, SurveyVersionOperationState>>;
    readonly runQualityCheck: () => Promise<QualityCheckResult | undefined>;
    readonly decideQualityIssue: (issue: QualityIssue, decision: QualityIssueDecision) => Promise<boolean>;
    readonly decideQualityIssueResult: (issue: QualityIssue, decision: QualityIssueDecision) => Promise<SurveyVersionActionResult>;
    readonly publish: (options?: {
        readonly allowWarnings?: boolean;
    }) => Promise<boolean>;
    readonly publishResult: (options?: {
        readonly allowWarnings?: boolean;
    }) => Promise<SurveyVersionActionResult>;
    readonly cloneDraft: () => Promise<boolean>;
    readonly cloneDraftResult: () => Promise<SurveyVersionActionResult>;
    readonly deleteDraft: () => Promise<boolean>;
    readonly deleteDraftResult: () => Promise<SurveyVersionActionResult>;
    readonly setVisibility: (status: "draft" | "published" | "archived") => Promise<boolean>;
    readonly setVisibilityResult: (status: "draft" | "published" | "archived") => Promise<SurveyVersionActionResult>;
    readonly runQualityCheckResult: () => Promise<SurveyVersionActionResult<QualityCheckResult>>;
    /** @deprecated Use cloneDraft. */
    readonly duplicate: () => Promise<boolean>;
    /** @deprecated Use deleteDraft. */
    readonly delete: () => Promise<boolean>;
    /** @deprecated Use setVisibility. */
    readonly setStatus: (status: "draft" | "published" | "archived") => Promise<boolean>;
}
interface SurveyVersionDomainActionsResult<TQualityPayload = unknown> extends Omit<SurveyVersionDomainOperationsResult<TQualityPayload>, "quality" | "runQualityCheckResult"> {
    readonly quality: {
        readonly status: SurveyVersionOperationStatus;
        readonly result?: SurveyVersionQualityResult<TQualityPayload>;
        readonly error?: Error;
    };
    readonly runQualityCheckResult: () => Promise<SurveyVersionActionResult<SurveyVersionQualityResult<TQualityPayload>>>;
    readonly publishResult: (options?: {
        readonly allowWarnings?: boolean;
    }) => Promise<SurveyVersionActionResult>;
    readonly decideQualityIssueResult: (issue: QualityIssue, decision: QualityIssueDecision) => Promise<SurveyVersionActionResult>;
}
interface SurveyVersionDomainOperationsResult<TQualityPayload = unknown> extends Omit<UseSurveyVersionOperationsResult, "quality" | "runQualityCheck" | "runQualityCheckResult"> {
    readonly quality: SurveyVersionQualityState<TQualityPayload>;
    readonly runQualityCheck: () => Promise<QualityCheckResult<TQualityPayload> | undefined>;
    readonly runQualityCheckResult: () => Promise<SurveyVersionActionResult<QualityCheckResult<TQualityPayload>>>;
}
type UseSurveyVersionActionsOptions = UseSurveyVersionOperationsOptions;
interface UseSurveyVersionDomainActionsOptions<TVersion, TState = unknown> {
    readonly version: TVersion;
    readonly state?: TState;
    readonly adapter: SurveyVersionActionAdapter<TVersion, TState>;
}
interface UseSurveyVersionDomainQualityActionsOptions<TVersion, TState = unknown, TQualityPayload = unknown> {
    readonly version: TVersion;
    readonly state?: TState;
    readonly adapter: SurveyVersionDomainActionAdapter<TVersion, TState, TQualityPayload>;
}
type UseSurveyVersionActionsResult = UseSurveyVersionOperationsResult;
type SurveySummaryInput = FormAnalytics | {
    readonly questions: readonly QuestionAggregate[];
    readonly formId?: string;
    readonly formVersion?: number;
};
interface SurveyResponseSummaryLanguageAggregate {
    readonly language: string;
    readonly submissionCount: number;
    readonly summary: SurveySummaryInput;
}
interface SurveyResponseSummarySkipReason {
    readonly reason: string;
    readonly count: number;
    readonly language?: string;
}
interface SurveyResponseSummaryDomainAdapter<TSummary, TVersion> {
    readonly toSummaryInput: (summary: TSummary) => SurveySummaryInput;
    readonly toFormSchema: (version: TVersion) => FormSchema;
    readonly sourceLanguage: (version: TVersion) => string;
    readonly resolveLabel?: (request: {
        readonly domain: TVersion;
        readonly fieldId: string;
        readonly sourceLanguage: string;
    }) => string | undefined;
    readonly mapLanguages?: (request: {
        readonly domain: TVersion;
        readonly summary: TSummary;
    }) => readonly SurveyResponseSummaryLanguageAggregate[] | undefined;
    readonly mapSkipReasons?: (request: {
        readonly domain: TVersion;
        readonly summary: TSummary;
    }) => readonly unknown[] | undefined;
    readonly getQuestionDefinition?: (request: {
        readonly domain: TVersion;
        readonly fieldId: string;
    }) => unknown;
    readonly getOptionDefinition?: (request: {
        readonly domain: TVersion;
        readonly fieldId: string;
        readonly optionId: string;
    }) => unknown;
}
interface SurveyResponseSummaryMapperAdapter<TDomain, TDomainSummary = SurveySummaryInput> {
    readonly toFormSchema: (domain: TDomain) => FormSchema;
    readonly toSurveySummary?: (request: {
        readonly domain: TDomain;
        readonly summary: TDomainSummary;
        readonly sourceLanguage: string;
    }) => SurveySummaryInput;
    readonly resolveLabel?: (request: {
        readonly domain: TDomain;
        readonly fieldId: string;
        readonly sourceLanguage: string;
    }) => string | undefined;
    readonly mapLanguages?: (request: {
        readonly domain: TDomain;
        readonly summary: TDomainSummary;
    }) => readonly SurveyResponseSummaryLanguageAggregate[] | undefined;
    readonly mapSkipReasons?: (request: {
        readonly domain: TDomain;
        readonly summary: TDomainSummary;
    }) => readonly SurveyResponseSummarySkipReason[] | undefined;
    readonly getQuestionDefinition?: (request: {
        readonly domain: TDomain;
        readonly fieldId: string;
    }) => unknown;
    readonly getOptionDefinition?: (request: {
        readonly domain: TDomain;
        readonly fieldId: string;
        readonly optionId: string;
    }) => unknown;
}
interface SurveyResponseSummaryQuestion {
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
interface SurveyResponseSummaryData<TCustomData = unknown, TSkipReason = SurveyResponseSummarySkipReason> {
    readonly formId: string;
    readonly version: number;
    readonly sourceLanguage: string;
    readonly title: string;
    readonly questions: readonly SurveyResponseSummaryQuestion[];
    readonly languages?: readonly SurveyResponseSummaryLanguageAggregate[];
    readonly skipReasons?: readonly TSkipReason[];
    readonly customData?: TCustomData;
}
interface SurveyResponseSummaryProps {
    readonly summary: SurveySummaryInput;
    readonly version: FormVersionRecord | FormSchema;
    readonly sourceLanguage: string;
    readonly onSourceLanguageChange?: (language: string) => void;
    readonly renderQuestion?: (question: SurveyResponseSummaryQuestion) => ReactNode;
    readonly className?: string;
}
interface SurveyResponseSummaryDomainProps<TDomain> extends Omit<SurveyResponseSummaryProps, "version"> {
    readonly version: TDomain;
    readonly domainAdapter: SurveySchemaDomainAdapter<TDomain>;
    readonly labels?: SurveyResponseSummaryDomainLabels;
    readonly languageLabel?: (language: string) => ReactNode;
}
interface SurveyResponseSummaryDomainLabels {
    readonly languages?: string;
    readonly answered?: string;
    readonly unanswered?: string;
}
interface SurveyResponseSummaryDomainInputProps<TSummary, TVersion> {
    readonly summary: TSummary;
    readonly version: TVersion;
    readonly domainAdapter: SurveyResponseSummaryDomainAdapter<TSummary, TVersion>;
    readonly languageOptions?: readonly {
        readonly language: string;
        readonly count: number;
    }[];
    readonly selectedLanguage?: string | null;
    readonly onLanguageChange?: (language: string | null) => void;
    readonly slots?: SurveyResponseSummaryDomainSlots;
    readonly labels?: SurveyResponseSummaryDomainLabels;
    readonly languageLabel?: (language: string) => ReactNode;
    readonly className?: string;
}
type SurveyResponseSummaryCustomDomainProps<TDomain, TDomainSummary> = SurveyResponseSummaryDomainInputProps<TDomainSummary, TDomain>;
type SurveyResponseSummaryLegacyDomainProps<TDomain> = SurveyResponseSummaryDomainProps<TDomain>;
interface SurveyResponseSummaryLegacyCustomDomainProps<TDomain, TDomainSummary> extends Omit<SurveyResponseSummaryProps, "summary" | "version"> {
    readonly summary: TDomainSummary;
    readonly version: TDomain;
    readonly domainAdapter: SurveyResponseSummaryMapperAdapter<TDomain, TDomainSummary>;
}
interface SurveyResponseSummarySlots<TSkipReason = SurveyResponseSummarySkipReason> {
    readonly renderQuestion?: (question: SurveyResponseSummaryQuestion) => ReactNode;
    readonly renderHeader?: (data: SurveyResponseSummaryData<unknown, TSkipReason>) => ReactNode;
    readonly renderLanguageTabs?: (props: SurveyResponseSummaryLanguageTabsProps) => ReactNode;
    readonly languageTabs?: (props: SurveyResponseSummaryLanguageTabsProps) => ReactNode;
    readonly header?: (data: SurveyResponseSummaryData<unknown, TSkipReason>) => ReactNode;
    readonly question?: (question: SurveyResponseSummaryQuestion) => ReactNode;
    readonly skipReasons?: (reasons: readonly TSkipReason[]) => ReactNode;
}
interface SurveyResponseSummaryDomainSlots extends SurveyResponseSummarySlots<unknown> {
    readonly languageTabs?: (props: SurveyResponseSummaryLanguageTabsProps) => ReactNode;
}
interface SurveyResponseSummaryLanguageTabsProps {
    readonly languages: readonly SurveyResponseSummaryLanguageAggregate[];
    readonly activeLanguage: string;
    readonly onChange: (language: string) => void;
}
interface SurveyResponseSummaryComponentProps extends SurveyResponseSummaryProps {
    readonly slots?: SurveyResponseSummarySlots;
}
type SurveyResponseSummaryDomainComponentProps<TDomain> = SurveyResponseSummaryDomainProps<TDomain> & {
    readonly slots?: SurveyResponseSummarySlots;
};
type SurveyResponseSummaryCustomDomainComponentProps<TDomain, TDomainSummary> = SurveyResponseSummaryLegacyCustomDomainProps<TDomain, TDomainSummary> & {
    readonly slots?: SurveyResponseSummarySlots;
};
interface UseSurveyResponseSummaryDomainOptions<TSummary, TVersion> extends SurveyResponseSummaryDomainInputProps<TSummary, TVersion> {
}
interface UseSurveyResponseSummaryDomainResult<TSummary, TVersion> {
    readonly data: SurveyResponseSummaryData<TSummary, unknown>;
    readonly summary: TSummary;
    readonly version: TVersion;
    readonly selectedLanguage: string | null;
    readonly languageOptions: readonly {
        readonly language: string;
        readonly count: number;
    }[];
    readonly setLanguage: (language: string | null) => void;
}
type SurveyClientAsyncState = {
    readonly status: "idle" | "loading" | "success" | "error";
    readonly error?: Error;
};

interface UseSurveyEditorResult extends SurveyEditorRenderProps {
    readonly builder: ReturnType<typeof useFormBuilder>;
    readonly onChange: (schema: FormSchema) => void;
    readonly addQuestion: (type: QuestionType, pageId?: string) => Promise<boolean>;
    readonly removeQuestion: (fieldId: string) => Promise<boolean>;
    readonly reorderQuestions: (fieldId: string, targetIndex: number) => Promise<boolean>;
}
interface UseSurveyEditorDomainResult<TDomain> extends UseSurveyEditorResult {
    readonly domain: TDomain;
    readonly slots?: SurveyEditorDomainSlots;
    readonly domainMetadata?: unknown;
}
/** Combines the existing headless builder state with save and schema translation operations. */
declare function useSurveyEditor({ schema, adapter, onChange, locale: _locale, sourceLocale, targetLocale, ...builderOptions }: UseSurveyEditorOptions): UseSurveyEditorResult;
/** Preferred explicit controller name; useSurveyEditor remains as a compatibility alias. */
declare const useSurveyEditorController: typeof useSurveyEditor;
/** A ready-to-use survey editor with injectable persistence and translation operations. */
declare function SurveyEditor(props: SurveyEditorProps): React.JSX.Element;

declare function createSurveySchemaDomainAdapter<TDomain>(toFormSchema: SurveySchemaDomainAdapter<TDomain>["toFormSchema"]): SurveySchemaDomainAdapter<TDomain>;
declare function toFreeTextAnswerItemsFromDomain<TDomain>(items: readonly TDomain[], adapter: FreeTextAnswerDomainAdapter<TDomain>): readonly FreeTextAnswerItem[];
declare function useFreeTextDomainAnswerTranslation<TDomain>(options: UseFreeTextDomainAnswerTranslationOptions<TDomain>): UseFreeTextDomainAnswerTranslationResult<TDomain>;
/** Keeps the application domain record as the source of truth while the builder edits a mapped schema. */
declare function useSurveyEditorDomain<TDomain>(options: UseSurveyEditorDomainOptions<TDomain>): UseSurveyEditorResult & {
    readonly domain: TDomain;
};
declare function useSurveyEditorDomain<TDomain>(options: UseSurveyEditorDomainOptions<TDomain>): UseSurveyEditorDomainResult<TDomain>;

/** Normalizes Core text-answer pages for translation workflows. */
declare function toFreeTextAnswerItems(items: readonly FreeTextAnswerInput[]): readonly FreeTextAnswerItem[];

/** Manages selection, PII confirmation, batching, and per-answer translation state. */
declare function useFreeTextAnswerTranslation({ items: inputItems, adapter, targetLanguage, sourceLanguage, batchSize, detectPii, onPiiConfirmation: onPiiConfirmationFromHook }: UseFreeTextAnswerTranslationOptions): UseFreeTextAnswerTranslationResult;
/** Creates a selection-free translation controller for arbitrary answer arrays. */
declare function useFreeTextAnswerTranslationController(options: CreateFreeTextTranslationControllerOptions): FreeTextTranslationController;
declare function FreeTextAnswerTranslations({ items, adapter, targetLanguage, sourceLanguage, batchSize, detectPii, onPiiConfirmation, slots, title, translateLabel }: FreeTextAnswerTranslationsProps): React.JSX.Element;
/** Survey-specific name for the free-text translation container. */
declare function SurveyFreeTextTable(props: FreeTextAnswerTranslationsProps): React.JSX.Element;

declare function getFreeTextAnswerFindings(items: readonly FreeTextAnswerInput[], detectPii?: TranslateFreeTextAnswersOptions["detectPii"]): readonly SensitiveDataFinding[];
declare function hasPiiCandidate(items: readonly FreeTextAnswerInput[], detectPii?: TranslateFreeTextAnswersOptions["detectPii"]): boolean;
/** Translates arbitrary free-text answers without using selection state. */
declare function translateFreeTextAnswers(inputItems: readonly FreeTextAnswerInput[], adapter: FreeTextTranslationAdapter, options: TranslateFreeTextAnswersOptions): Promise<FreeTextTranslationOutcome>;
declare function createFreeTextTranslationController(defaults: CreateFreeTextTranslationControllerOptions): FreeTextTranslationController;

interface SurveyMappingEntry {
    readonly id: string;
    readonly sourceFieldId: string;
    readonly targetFieldId: string;
    readonly label?: ReactNode;
}
interface SurveyMappingSaveRequest<TDomain> {
    readonly domain: TDomain;
    readonly mappings: readonly SurveyMappingEntry[];
    readonly selection?: SurveyMappingSelection;
    readonly signal: AbortSignal;
}
interface SurveyMappingAddRequest<TDomain> {
    readonly domain: TDomain;
    readonly mapping: SurveyMappingEntry;
    readonly selection: SurveyMappingSelection;
    readonly signal: AbortSignal;
}
interface SurveyMappingRemoveRequest<TDomain> {
    readonly domain: TDomain;
    readonly mappingId: string;
    readonly selection: SurveyMappingSelection;
    readonly signal: AbortSignal;
}
interface SurveyMappingReorderRequest<TDomain> {
    readonly domain: TDomain;
    readonly mappings: readonly SurveyMappingEntry[];
    readonly selection: SurveyMappingSelection;
    readonly signal: AbortSignal;
}
interface SurveyMappingListRequest<TDomain> {
    readonly domain: TDomain;
    readonly selection: SurveyMappingSelection;
    readonly signal: AbortSignal;
}
interface SurveyMappingAdapter<TDomain> {
    readonly listMappings?: (request: SurveyMappingListRequest<TDomain>) => Promise<readonly SurveyMappingEntry[]>;
    readonly addMapping?: (request: SurveyMappingAddRequest<TDomain>) => Promise<TDomain | undefined>;
    readonly removeMapping?: (request: SurveyMappingRemoveRequest<TDomain>) => Promise<TDomain | undefined>;
    readonly reorderMappings?: (request: SurveyMappingReorderRequest<TDomain>) => Promise<TDomain | undefined>;
    readonly saveMappings?: (request: SurveyMappingSaveRequest<TDomain>) => Promise<TDomain | undefined>;
}
type SurveyMappingStatus = "idle" | "saving" | "saved" | "error";
interface SurveyMappingState {
    readonly status: SurveyMappingStatus;
    readonly operation?: "list" | "add" | "remove" | "reorder" | "save";
    readonly error?: Error;
}
interface SurveyMappingSelection {
    readonly deckId?: string;
    readonly groupId?: string;
}
interface UseSurveyMappingOptions<TDomain> {
    readonly domain: TDomain;
    readonly mappings: readonly SurveyMappingEntry[];
    readonly adapter: SurveyMappingAdapter<TDomain>;
    readonly selection?: SurveyMappingSelection;
    readonly onSelectionChange?: (selection: SurveyMappingSelection) => void;
    readonly onDomainChange?: (domain: TDomain) => void;
}
interface UseSurveyMappingResult<TDomain> {
    readonly domain: TDomain;
    readonly mappings: readonly SurveyMappingEntry[];
    readonly state: SurveyMappingState;
    readonly isLoading: boolean;
    readonly setMappings: (mappings: readonly SurveyMappingEntry[]) => void;
    readonly selection: SurveyMappingSelection;
    readonly setSelection: (selection: SurveyMappingSelection) => void;
    readonly refresh: () => Promise<boolean>;
    readonly add: (mapping: SurveyMappingEntry) => Promise<boolean>;
    readonly remove: (mappingId: string) => Promise<boolean>;
    readonly reorder: (mappings: readonly SurveyMappingEntry[]) => Promise<boolean>;
    readonly save: () => Promise<boolean>;
}
interface SurveyMappingPanelSlots {
    readonly mapping?: (mapping: SurveyMappingEntry, index: number) => ReactNode;
    readonly notifications?: (state: SurveyMappingState) => ReactNode;
    readonly selection?: (selection: SurveyMappingSelection) => ReactNode;
}
interface SurveyMappingPanelProps<TDomain> extends UseSurveyMappingOptions<TDomain> {
    readonly render?: (result: UseSurveyMappingResult<TDomain>) => ReactNode;
    readonly slots?: SurveyMappingPanelSlots;
    readonly title?: string;
}
declare function useSurveyMapping<TDomain>({ domain, mappings: inputMappings, adapter, selection: inputSelection, onSelectionChange, onDomainChange }: UseSurveyMappingOptions<TDomain>): UseSurveyMappingResult<TDomain>;
/** Generic mapping editor surface with application-owned mapping persistence. */
declare function SurveyMappingPanel<TDomain>({ render, slots, title, ...options }: SurveyMappingPanelProps<TDomain>): React.JSX.Element;

interface SurveyMappingCrudAdapter<TDomain, TMapping, TSelection> {
    readonly create: (request: {
        readonly domain: TDomain;
        readonly selection: TSelection;
        readonly signal: AbortSignal;
    }) => Promise<TMapping>;
    readonly remove: (request: {
        readonly domain: TDomain;
        readonly mapping: TMapping;
        readonly signal: AbortSignal;
    }) => Promise<void>;
    readonly reorder?: (request: {
        readonly domain: TDomain;
        readonly mapping: TMapping;
        readonly displayOrder: number;
        readonly signal: AbortSignal;
    }) => Promise<void>;
    /** Persists the complete order in one request. */
    readonly reorderMany?: (request: {
        readonly domain: TDomain;
        readonly mappings: readonly TMapping[];
        readonly signal: AbortSignal;
    }) => Promise<void>;
    /** Alias for reorderMany for hosts that use "all" terminology. */
    readonly reorderAll?: (request: {
        readonly domain: TDomain;
        readonly mappings: readonly TMapping[];
        readonly signal: AbortSignal;
    }) => Promise<void>;
    /** Compatibility alias for adapters that name the bulk operation after the resource. */
    readonly reorderMappings?: (request: {
        readonly domain: TDomain;
        readonly mappings: readonly TMapping[];
        readonly signal: AbortSignal;
    }) => Promise<void>;
    readonly list?: (request: {
        readonly domain: TDomain;
        readonly signal: AbortSignal;
    }) => Promise<readonly TMapping[]>;
    readonly invalidate?: () => void | Promise<void>;
}
type SurveyMappingCrudOperation = "idle" | "creating" | "removing" | "reordering" | "error";
interface UseSurveyMappingCrudResult<TMapping> {
    readonly mappings: readonly TMapping[];
    readonly state: {
        readonly operation: SurveyMappingCrudOperation;
        readonly error?: Error;
    };
    readonly create: (selection: unknown) => Promise<boolean>;
    readonly remove: (mapping: TMapping) => Promise<boolean>;
    readonly reorder: (mapping: TMapping, displayOrder: number) => Promise<boolean>;
    readonly reorderMany: (mappings: readonly TMapping[]) => Promise<boolean>;
    readonly reorderAll: (mappings: readonly TMapping[]) => Promise<boolean>;
    readonly reorderMappings: (mappings: readonly TMapping[]) => Promise<boolean>;
    readonly refresh: () => Promise<boolean>;
}
interface UseSurveyMappingCrudOptions<TDomain, TMapping, TSelection> {
    readonly domain: TDomain;
    readonly mappings: readonly TMapping[];
    readonly adapter: SurveyMappingCrudAdapter<TDomain, TMapping, TSelection>;
    readonly onMappingsChange?: (mappings: readonly TMapping[]) => void;
    readonly onDomainChange?: (domain: TDomain) => void;
}
declare function useSurveyMappingCrud<TDomain, TMapping, TSelection = unknown>(options: UseSurveyMappingCrudOptions<TDomain, TMapping, TSelection>): UseSurveyMappingCrudResult<TMapping>;

interface CreateSurveyTranslationAdapterOptions {
    readonly translate: SurveyTranslationAdapter["translate"];
    readonly translateText?: SurveyTranslationAdapter["translateText"];
    readonly translateBatch?: SurveyTranslationAdapter["translateBatch"];
}
/** Creates the package adapter shape without requiring an application-specific type assertion. */
declare function createSurveyTranslationAdapter(options: CreateSurveyTranslationAdapterOptions): SurveyTranslationAdapter;
/** Adapts an application's typed translation function to the Form Engine translator contract. */
declare function createSurveyTranslator(adapter: NonNullable<SurveyUiProviderProps["translationAdapter"]>, locale: string): FormEngineTranslator;
/** Provides one shared translation scope for all custom survey client components. */
declare function SurveyUiProvider(props: SurveyUiProviderProps): ReactNode;
/** Shared translation contract for headless hooks and ready-to-use survey components. */
declare function useSurveyTranslation(): SurveyTranslationScope;
/** Short alias for applications that use Survey as their only Form Engine surface. */
declare const SurveyProvider: typeof SurveyUiProvider;

interface SurveyQualityCheckAdapter<TVersion, TState = unknown, TResponse = unknown> {
    readonly run: (request: DomainSurveyVersionOperationRequest<TVersion, TState>) => Promise<QualityCheckResult<TResponse>>;
    readonly decide?: (request: DomainSurveyVersionOperationRequest<TVersion, TState> & {
        readonly issue: QualityIssue;
        readonly decision: QualityIssueDecision;
        readonly result: QualityCheckResult<TResponse>;
    }) => SurveyVersionAdapterResponse;
    readonly invalidate?: () => void | Promise<void>;
    readonly notify?: (event: SurveyQualityEvent<TResponse>) => void;
}
type SurveyQualityEvent<TResponse = unknown> = {
    readonly type: "checked";
    readonly result: QualityCheckResult<TResponse>;
} | {
    readonly type: "decided";
    readonly issue: QualityIssue;
    readonly decision: QualityIssueDecision;
} | {
    readonly type: "error";
    readonly error: Error;
    readonly cause: unknown;
};
interface SurveyQualityState<TResponse = unknown> {
    readonly status: "idle" | "loading" | "success" | "error";
    readonly issues: readonly QualityIssue[];
    readonly checkStatus?: "idle" | "running" | "passed" | "failed" | "error";
    readonly result?: QualityCheckResult<TResponse>;
    readonly error?: Error;
    readonly cause?: unknown;
    readonly runId?: string;
    readonly checkedRevision?: string | number;
}
interface UseSurveyQualityControllerOptions<TVersion, TState = unknown, TResponse = unknown> {
    readonly version: TVersion;
    readonly state?: TState;
    readonly adapter: SurveyQualityCheckAdapter<TVersion, TState, TResponse>;
}
interface UseSurveyQualityControllerResult<TResponse = unknown> {
    readonly quality: SurveyQualityState<TResponse>;
    readonly decisions: Readonly<Record<string, QualityIssueDecision>>;
    readonly run: () => Promise<QualityCheckResult<TResponse> | undefined>;
    readonly decide: (issue: QualityIssue, decision: QualityIssueDecision) => Promise<SurveyVersionActionResult>;
    readonly accept: (issue: QualityIssue) => Promise<SurveyVersionActionResult>;
    readonly reject: (issue: QualityIssue) => Promise<SurveyVersionActionResult>;
}

/** Runs quality checks and decisions as one replaceable, transport-neutral controller. */
declare function useSurveyQualityController<TVersion, TState = unknown, TResponse = unknown>({ version, state: versionState, adapter }: UseSurveyQualityControllerOptions<TVersion, TState, TResponse>): UseSurveyQualityControllerResult<TResponse>;

interface SurveyQualityIssueRecord {
    readonly issueId: string;
    readonly message: string;
    readonly path?: string;
    readonly severity?: string;
    readonly category?: string;
    readonly language?: string;
    readonly metadata?: Readonly<Record<string, JsonValue>>;
}
/** Converts a domain quality DTO into the package QualityIssue contract. */
declare function mapSurveyQualityIssue(issue: SurveyQualityIssueRecord): QualityIssue;
declare function mapSurveyQualityIssues(issues: readonly SurveyQualityIssueRecord[]): readonly QualityIssue[];
/** Readable alias for callers that use "to" naming for domain mappers. */
declare const toSurveyQualityIssue: typeof mapSurveyQualityIssue;

interface SurveyResponseSummaryMappingRequest<TDomain, TDomainSummary = SurveySummaryInput> {
    readonly domain: TDomain;
    readonly summary: TDomainSummary;
    readonly sourceLanguage: string;
}
declare function isSurveySummaryInput(value: unknown): value is SurveySummaryInput;
/** Maps an application-owned summary once, while retaining the original domain aggregate in customData. */
declare function mapSurveyResponseSummary<TDomain, TDomainSummary = SurveySummaryInput>(request: SurveyResponseSummaryMappingRequest<TDomain, TDomainSummary>, adapter: SurveyResponseSummaryMapperAdapter<TDomain, TDomainSummary>): SurveyResponseSummaryData<TDomainSummary>;
/** Backward-compatible mapper for the v7.3 domain summary contract. */
declare function toSurveyResponseSummaryFromDomain<TDomain>(summary: SurveySummaryInput, version: TDomain, adapter: SurveySchemaDomainAdapter<TDomain>, sourceLanguage: string): SurveyResponseSummaryData;

/** Converts analytics/domain data into a stable, localized shape for survey UI clients. */
declare function toSurveyResponseSummary(summary: SurveySummaryInput, version: FormVersionRecord | FormSchema, sourceLanguage: string): SurveyResponseSummaryData;
declare function SurveyResponseSummary({ summary, version, sourceLanguage, onSourceLanguageChange, renderQuestion, slots, className }: SurveyResponseSummaryComponentProps): React.JSX.Element;
declare function useSurveyResponseSummaryDomain<TSummary, TVersion>(options: UseSurveyResponseSummaryDomainOptions<TSummary, TVersion>): UseSurveyResponseSummaryDomainResult<TSummary, TVersion>;
declare function SurveyResponseSummaryDomain<TSummary, TVersion>(props: SurveyResponseSummaryDomainInputProps<TSummary, TVersion>): React.JSX.Element;
declare function SurveyResponseSummaryDomain<TDomain>(props: SurveyResponseSummaryDomainComponentProps<TDomain>): React.JSX.Element;
/** Domain summary variant for application-owned aggregates and render metadata. */
declare function SurveyResponseSummaryCustomDomain<TDomain, TDomainSummary>(props: SurveyResponseSummaryCustomDomainComponentProps<TDomain, TDomainSummary>): React.JSX.Element;

interface SurveyQualityPanelProps {
    readonly result?: QualityCheckResult;
    readonly decisions?: Readonly<Record<string, QualityIssueDecision>>;
    readonly onDecide?: (issue: QualityIssue, decision: QualityIssueDecision) => void;
    readonly render?: (result: QualityCheckResult | undefined) => ReactNode;
    readonly slots?: SurveyQualityPanelSlots;
}
interface SurveyQualityPanelSlots {
    readonly empty?: () => ReactNode;
    readonly issue?: (props: {
        readonly issue: QualityIssue;
        readonly decision?: QualityIssueDecision;
        readonly accept: () => void;
        readonly reject: () => void;
    }) => ReactNode;
}
declare function surveyQualityIssueKey(issue: QualityIssue): string;
/** UI-library-neutral quality result and issue-decision surface. */
declare function SurveyQualityPanel({ result, decisions, onDecide, render, slots }: SurveyQualityPanelProps): React.JSX.Element;

interface SurveyVersionHistoryProps<TVersion> {
    readonly versions: readonly TVersion[];
    readonly getVersionKey?: (version: TVersion, index: number) => string | number;
    readonly getVersionLabel?: (version: TVersion, index: number) => ReactNode;
    readonly render?: (versions: readonly TVersion[]) => ReactNode;
    readonly slots?: SurveyVersionHistorySlots<TVersion>;
    readonly title?: string;
}
interface SurveyVersionHistorySlots<TVersion> {
    readonly item?: (props: {
        readonly version: TVersion;
        readonly index: number;
    }) => ReactNode;
    readonly empty?: () => ReactNode;
}
/** Renders version history without imposing a persistence model or UI library. */
declare function SurveyVersionHistory<TVersion>({ versions, getVersionKey, getVersionLabel, render, slots, title }: SurveyVersionHistoryProps<TVersion>): React.JSX.Element;

interface SurveyVersionPanelRenderProps<TVersion = unknown> {
    readonly version: TVersion;
    readonly actions: UseSurveyVersionOperationsResult;
    readonly qualityIssues: readonly QualityIssue[];
    readonly publish: () => Promise<boolean | {
        readonly succeeded: boolean;
        readonly error?: Error;
    }>;
}
interface SurveyVersionPanelSlots<TVersion = unknown> {
    readonly qualityWarningDialog?: (props: {
        readonly issues: readonly QualityIssue[];
        readonly confirm: () => void;
        readonly cancel: () => void;
    }) => ReactNode;
    readonly visibilityDialog?: (props: {
        readonly status: "draft" | "published" | "archived";
        readonly confirm: () => void;
        readonly cancel: () => void;
    }) => ReactNode;
    readonly quality?: (result: QualityCheckResult | undefined) => ReactNode;
    readonly history?: (versions: readonly TVersion[]) => ReactNode;
    readonly notifications?: (actions: UseSurveyVersionOperationsResult) => ReactNode;
}
interface SurveyVersionPanelProps<TVersion = unknown> {
    readonly version: TVersion;
    readonly actions: UseSurveyVersionOperationsResult;
    readonly slots?: SurveyVersionPanelSlots<TVersion>;
    readonly render?: (props: SurveyVersionPanelRenderProps<TVersion>) => ReactNode;
    readonly history?: readonly TVersion[];
    readonly getVersionKey?: (version: TVersion, index: number) => string | number;
    readonly getVersionLabel?: (version: TVersion, index: number) => ReactNode;
    readonly title?: string;
}
/** A transport- and UI-library-neutral version/quality surface with replaceable application slots. */
declare function SurveyVersionPanel<TVersion>({ version, actions, slots, render, history, getVersionKey, getVersionLabel, title }: SurveyVersionPanelProps<TVersion>): React.JSX.Element;

/** Common status values shared by all custom survey controllers. */
type SurveyControllerStatus = "idle" | "loading" | "success" | "error";
/** A transport-neutral result that keeps the original failure available to the host app. */
interface SurveyActionResult<TData = void> {
    readonly succeeded: boolean;
    readonly data?: TData;
    readonly error?: Error;
    readonly cause?: unknown;
    readonly response?: unknown;
}
/** Reusable slot contract for UI surfaces that can be replaced by a host application. */
type SurveySlot<TProps> = (props: TProps) => ReactNode;
/** Generic state shape for an async adapter operation. */
interface SurveyAsyncState<TData = unknown> {
    readonly status: SurveyControllerStatus;
    readonly data?: TData;
    readonly error?: Error;
    readonly cause?: unknown;
}
/** A controlled value paired with the callback used to update it. */
interface SurveyControlledValue<TValue> {
    readonly value: TValue;
    readonly onChange: (value: TValue) => void;
}

interface TranslateSurveySchemaOptions {
    readonly schema: FormSchema;
    readonly sourceLocale: string;
    readonly targetLocale: string;
    readonly signal?: AbortSignal;
    readonly translationAdapter: SurveyTranslationAdapter;
    /** Keeps manual translations intact and retains per-slot translation metadata. */
    readonly preserveMetadata?: boolean;
}
interface TranslateSurveySchemaResult {
    readonly schema: FormSchema;
    readonly report: TranslationReport;
}
/** Translates form, question, choice, page, and translation metadata in one package operation. */
declare function translateSurveySchema(options: TranslateSurveySchemaOptions): Promise<TranslateSurveySchemaResult>;

/** Combines independently implemented version action adapters into one optional adapter. */
declare function composeSurveyVersionActions<TVersion, TState>(...adapters: readonly SurveyVersionActionAdapter<TVersion, TState>[]): SurveyVersionActionAdapter<TVersion, TState>;
declare function composeSurveyVersionDomainActions<TVersion, TState, TQualityPayload = unknown>(...adapters: readonly SurveyVersionDomainActionAdapter<TVersion, TState, TQualityPayload>[]): SurveyVersionDomainActionAdapter<TVersion, TState, TQualityPayload>;
/** Backward-compatible controller for Form Engine schemas and version records. */
declare function useSurveyVersionOperations(options: UseSurveyVersionOperationsOptions): UseSurveyVersionOperationsResult;
/** Generic controller for application-owned version records and state. */
declare function useSurveyVersionDomainActions<TVersion, TState = unknown, TQualityPayload = unknown>(options: UseSurveyVersionDomainQualityActionsOptions<TVersion, TState, TQualityPayload>): SurveyVersionDomainActionsResult<TQualityPayload>;
declare function useSurveyVersionDomainActions<TVersion, TState = unknown>(options: UseSurveyVersionDomainActionsOptions<TVersion, TState>): UseSurveyVersionOperationsResult;
/** Preferred action-oriented name for the version controller. */
declare const useSurveyVersionActions: typeof useSurveyVersionOperations;
/** Explicit controller alias for applications that standardize on controller naming. */
declare const useSurveyVersionActionsController: typeof useSurveyVersionOperations;

interface SurveyWorkflowTransition<TTransitionId = string> {
    readonly id: TTransitionId;
    readonly label: ReactNode;
}
interface SurveyWorkflowTransitionRequest<TDomain, TTransitionId> {
    readonly domain: TDomain;
    readonly transition: TTransitionId;
    readonly workflowState?: SurveyWorkflowState<TTransitionId>;
    readonly signal: AbortSignal;
}
interface SurveyWorkflowAdapter<TDomain, TTransitionId = string> {
    readonly transition: (request: SurveyWorkflowTransitionRequest<TDomain, TTransitionId>) => Promise<TDomain | undefined>;
}
type SurveyWorkflowStatus = "idle" | "loading" | "success" | "error";
interface SurveyWorkflowState<TTransitionId = string> {
    readonly status: SurveyWorkflowStatus;
    readonly transition?: TTransitionId;
    readonly error?: Error;
    readonly completed?: boolean;
    readonly progressValue?: number;
    readonly tabIndex?: number;
    readonly expanded?: boolean;
}
interface UseSurveyWorkflowOptions<TDomain, TTransitionId = string> {
    readonly domain: TDomain;
    readonly transitions: readonly SurveyWorkflowTransition<TTransitionId>[];
    readonly adapter: SurveyWorkflowAdapter<TDomain, TTransitionId>;
    /** A calculated state supplied by the host application. */
    readonly controlledState?: SurveyWorkflowState<TTransitionId>;
    /** Alias for controlledState, convenient when the host already calls this value state. */
    readonly state?: SurveyWorkflowState<TTransitionId>;
    readonly expanded?: boolean;
    readonly onToggle?: (expanded: boolean) => void;
    readonly progressValue?: number;
    readonly tabIndex?: number;
    readonly onTabChange?: (tabIndex: number) => void;
    readonly onStateChange?: (state: SurveyWorkflowState<TTransitionId>) => void;
    readonly onDomainChange?: (domain: TDomain) => void;
}
interface UseSurveyWorkflowResult<TDomain, TTransitionId = string> {
    readonly domain: TDomain;
    readonly state: SurveyWorkflowState<TTransitionId>;
    readonly expanded: boolean;
    readonly progressValue?: number;
    readonly tabIndex?: number;
    readonly transition: (transition: TTransitionId) => Promise<boolean>;
    readonly toggle: () => void;
    readonly setTab: (tabIndex: number) => void;
}
interface SurveyWorkflowPanelSlots<TDomain, TTransitionId = string> {
    readonly transition?: (props: {
        readonly transition: SurveyWorkflowTransition<TTransitionId>;
        readonly state: SurveyWorkflowState<TTransitionId>;
        readonly run: () => void;
    }) => ReactNode;
    readonly notifications?: (state: SurveyWorkflowState<TTransitionId>) => ReactNode;
    readonly status?: (state: SurveyWorkflowState<TTransitionId>) => ReactNode;
    readonly after?: (domain: TDomain) => ReactNode;
}
interface SurveyWorkflowPanelProps<TDomain, TTransitionId = string> extends UseSurveyWorkflowOptions<TDomain, TTransitionId> {
    readonly render?: (result: UseSurveyWorkflowResult<TDomain, TTransitionId>) => ReactNode;
    readonly slots?: SurveyWorkflowPanelSlots<TDomain, TTransitionId>;
    readonly title?: string;
}
interface SurveyWorkflowControlledProps<TState> {
    readonly state: TState;
    readonly expanded: boolean;
    readonly onToggle: () => void;
    readonly showToggle?: boolean;
    readonly progress?: {
        readonly value: number;
        readonly label?: ReactNode;
    };
    readonly onNavigate?: (tab: number) => void;
    readonly steps?: readonly unknown[];
    readonly renderStep?: (step: unknown, state: TState) => ReactNode;
    readonly slots?: {
        readonly header?: (state: TState) => ReactNode;
        readonly toggle?: (props: {
            readonly expanded: boolean;
            readonly onToggle: () => void;
        }) => ReactNode;
        readonly step?: (step: unknown, context: {
            readonly index: number;
            readonly total: number;
            readonly state: TState;
        }) => ReactNode;
        readonly notifications?: (state: TState) => ReactNode;
    };
}
interface UseSurveyWorkflowControlledResult<TState> {
    readonly state: TState;
    readonly expanded: boolean;
    readonly toggle: () => void;
    readonly navigate: (tab: number) => void;
}
declare function useSurveyWorkflowControlled<TState>(props: SurveyWorkflowControlledProps<TState>): UseSurveyWorkflowControlledResult<TState>;
declare function SurveyWorkflowControlled<TState>(props: SurveyWorkflowControlledProps<TState>): React.JSX.Element;
declare function useSurveyWorkflow<TDomain, TTransitionId = string>({ domain, transitions, adapter, controlledState, state: inputState, expanded: controlledExpanded, onToggle, progressValue: controlledProgressValue, tabIndex: controlledTabIndex, onTabChange, onStateChange, onDomainChange }: UseSurveyWorkflowOptions<TDomain, TTransitionId>): UseSurveyWorkflowResult<TDomain, TTransitionId>;
/** Generic workflow controls with application-owned transition labels and transport. */
declare function SurveyWorkflowPanel<TDomain, TTransitionId = string>({ render, slots, title, ...options }: SurveyWorkflowPanelProps<TDomain, TTransitionId>): React.JSX.Element;

export { type CreateFreeTextTranslationControllerOptions, type CreateSurveyTranslationAdapterOptions, type DirectFreeTextTranslationOptions, type DomainSurveyVersionOperationRequest, type DomainSurveyVersionPublishRequest, type DomainSurveyVersionQualityIssueDecisionRequest, type EditorRenderProps, type FreeTextAnswerDomainAdapter, type FreeTextAnswerInput, type FreeTextAnswerItem, type FreeTextAnswerSource, type FreeTextAnswerTranslationSlots, FreeTextAnswerTranslations, type FreeTextAnswerTranslationsProps, type FreeTextItemStatus, type FreeTextTranslationAdapter, type FreeTextTranslationController, type FreeTextTranslationItemState, type FreeTextTranslationOutcome, type FreeTextTranslationOutcomeItem, type FreeTextTranslationOutcomeStatus, type FreeTextTranslationRequest, type FreeTextTranslationResult, type FreeTextTranslationState, type FreeTextTranslationStatus, type QualityCheckResult, type QualityCheckStatus, type QualityIssue, type QualityIssueDecision, type SurveyActionResult, type SurveyAsyncState, type SurveyClientAsyncState, type SurveyControlledValue, type SurveyControllerStatus, SurveyEditor, type SurveyEditorActionsAdapter, type SurveyEditorAdapter, type SurveyEditorAdapterInput, type SurveyEditorConfigurationSlots, type SurveyEditorDomainActionsAdapter, type SurveyEditorDomainAdapter, type SurveyEditorDomainAdapterOptions, type SurveyEditorDomainSlots, type SurveyEditorOperationState, type SurveyEditorOperationStatus, type SurveyEditorProps, type SurveyEditorQuestionAdapter, type SurveyEditorQuestionRequest, type SurveyEditorRenderProps, type SurveyEditorSlots, type SurveyEditorTranslateRequest, SurveyFreeTextTable, type SurveyFreeTextTableProps, type SurveyI18n, type SurveyMappingAdapter, type SurveyMappingAddRequest, type SurveyMappingCrudAdapter, type SurveyMappingCrudOperation, type SurveyMappingEntry, type SurveyMappingListRequest, SurveyMappingPanel, type SurveyMappingPanelProps, type SurveyMappingPanelSlots, type SurveyMappingRemoveRequest, type SurveyMappingReorderRequest, type SurveyMappingSaveRequest, type SurveyMappingSelection, type SurveyMappingState, type SurveyMappingStatus, SurveyProvider, type SurveyProviderProps, type SurveyQualityCheckAdapter, type SurveyQualityEvent, type SurveyQualityIssueRecord, SurveyQualityPanel, type SurveyQualityPanelProps, type SurveyQualityPanelSlots, type SurveyQualityState, SurveyResponseSummary, type SurveyResponseSummaryComponentProps, SurveyResponseSummaryCustomDomain, type SurveyResponseSummaryCustomDomainComponentProps, type SurveyResponseSummaryCustomDomainProps, type SurveyResponseSummaryData, SurveyResponseSummaryDomain, type SurveyResponseSummaryDomainAdapter, type SurveyResponseSummaryDomainComponentProps, type SurveyResponseSummaryDomainInputProps, type SurveyResponseSummaryDomainLabels, type SurveyResponseSummaryDomainProps, type SurveyResponseSummaryDomainSlots, type SurveyResponseSummaryLanguageAggregate, type SurveyResponseSummaryLanguageTabsProps, type SurveyResponseSummaryLegacyCustomDomainProps, type SurveyResponseSummaryLegacyDomainProps, type SurveyResponseSummaryMapperAdapter, type SurveyResponseSummaryMappingRequest, type SurveyResponseSummaryProps, type SurveyResponseSummaryQuestion, type SurveyResponseSummarySkipReason, type SurveyResponseSummarySlots, type SurveySchemaDomainAdapter, type SurveySlot, type SurveySummaryInput, type SurveyTranslationAdapter, type SurveyTranslationInput, type SurveyTranslationScope, SurveyUiProvider, type SurveyUiProviderProps, type SurveyVersionActionAdapter, type SurveyVersionActionEvent, type SurveyVersionActionResult, type SurveyVersionActionsAdapter, type SurveyVersionAdapter, type SurveyVersionAdapterResponse, type SurveyVersionDomainActionAdapter, type SurveyVersionDomainActionsResult, type SurveyVersionDomainOperationsResult, type SurveyVersionDomainQualityActions, SurveyVersionHistory, type SurveyVersionHistoryProps, type SurveyVersionHistorySlots, type SurveyVersionLifecycleActions, type SurveyVersionOperationName, type SurveyVersionOperationRequest, type SurveyVersionOperationState, type SurveyVersionOperationStatus, SurveyVersionPanel, type SurveyVersionPanelProps, type SurveyVersionPanelRenderProps, type SurveyVersionPanelSlots, type SurveyVersionPublishRequest, type SurveyVersionQualityActions, type SurveyVersionQualityIssueDecisionRequest, type SurveyVersionQualityResult, type SurveyVersionQualityState, type SurveyVersionQualityStatus, type SurveyWorkflowAdapter, SurveyWorkflowControlled, type SurveyWorkflowControlledProps, SurveyWorkflowPanel, type SurveyWorkflowPanelProps, type SurveyWorkflowPanelSlots, type SurveyWorkflowState, type SurveyWorkflowStatus, type SurveyWorkflowTransition, type SurveyWorkflowTransitionRequest, type TranslateFreeTextAnswersOptions, type TranslateSurveySchemaOptions, type TranslateSurveySchemaResult, type UseFreeTextAnswerTranslationOptions, type UseFreeTextAnswerTranslationResult, type UseFreeTextDomainAnswerTranslationOptions, type UseFreeTextDomainAnswerTranslationResult, type UseSurveyEditorDomainOptions, type UseSurveyEditorDomainResult, type UseSurveyEditorOptions, type UseSurveyEditorResult, type UseSurveyMappingCrudOptions, type UseSurveyMappingCrudResult, type UseSurveyMappingOptions, type UseSurveyMappingResult, type UseSurveyQualityControllerOptions, type UseSurveyQualityControllerResult, type UseSurveyResponseSummaryDomainOptions, type UseSurveyResponseSummaryDomainResult, type UseSurveyVersionActionsOptions, type UseSurveyVersionActionsResult, type UseSurveyVersionDomainActionsOptions, type UseSurveyVersionDomainQualityActionsOptions, type UseSurveyVersionOperationsOptions, type UseSurveyVersionOperationsResult, type UseSurveyWorkflowControlledResult, type UseSurveyWorkflowOptions, type UseSurveyWorkflowResult, composeSurveyVersionActions, composeSurveyVersionDomainActions, createFreeTextTranslationController, createSurveySchemaDomainAdapter, createSurveyTranslationAdapter, createSurveyTranslator, getFreeTextAnswerFindings, hasPiiCandidate, isSurveySummaryInput, mapSurveyQualityIssue, mapSurveyQualityIssues, mapSurveyResponseSummary, surveyQualityIssueKey, toFreeTextAnswerItems, toFreeTextAnswerItemsFromDomain, toSurveyQualityIssue, toSurveyResponseSummary, toSurveyResponseSummaryFromDomain, translateFreeTextAnswers, translateSurveySchema, useFreeTextAnswerTranslation, useFreeTextAnswerTranslationController, useFreeTextDomainAnswerTranslation, useSurveyEditor, useSurveyEditorController, useSurveyEditorDomain, useSurveyMapping, useSurveyMappingCrud, useSurveyQualityController, useSurveyResponseSummaryDomain, useSurveyTranslation, useSurveyVersionActions, useSurveyVersionActionsController, useSurveyVersionDomainActions, useSurveyVersionOperations, useSurveyWorkflow, useSurveyWorkflowControlled };
