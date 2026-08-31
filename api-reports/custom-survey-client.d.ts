import { JsonValue, TranslationAdapter, TextAnswerItem, FormResponse, FormSchema, TranslationReport, FormAnalytics, QuestionAggregate, FormVersionRecord, FormVersionState, FormEngineTranslator } from '@form-engine-ts/core';
import { SensitiveDataFinding } from '@form-engine-ts/privacy';
import { FormBuilderProps, useFormBuilder } from '@form-engine-ts/react';
import { ReactNode } from 'react';

interface SurveyTranslationAdapter extends TranslationAdapter {
    readonly translateText?: (text: string, targetLocale: string, sourceLocale?: string, signal?: AbortSignal) => Promise<string>;
    readonly translateBatch?: (texts: readonly string[], targetLocale: string, sourceLocale?: string, signal?: AbortSignal) => Promise<readonly string[]>;
}
interface SurveyUiProviderProps {
    readonly locale?: string;
    readonly fallbackLocale?: string;
    readonly translationAdapter?: SurveyTranslationAdapter;
    readonly translator?: (key: string, params?: Record<string, unknown>) => string;
    readonly children: ReactNode;
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
}
interface SurveyEditorSlots {
    readonly toolbar?: (props: SurveyEditorRenderProps) => ReactNode;
    readonly after?: (props: SurveyEditorRenderProps) => ReactNode;
    readonly status?: (props: SurveyEditorOperationState) => ReactNode;
    readonly notifications?: (props: SurveyEditorRenderProps) => ReactNode;
    readonly cardSettings?: (props: SurveyEditorRenderProps) => ReactNode;
    readonly submissionSettings?: (props: SurveyEditorRenderProps) => ReactNode;
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
}
type FreeTextItemStatus = "idle" | "translating" | "success" | "error";
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
interface QualityCheckResult {
    readonly issues: readonly QualityIssue[];
}
type QualityIssueDecision = "accept" | "reject";
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
    readonly runQualityCheck: (request: SurveyVersionOperationRequest) => Promise<QualityCheckResult>;
    readonly decideQualityIssue: (request: SurveyVersionQualityIssueDecisionRequest) => Promise<void>;
    readonly cloneDraft: (request: SurveyVersionOperationRequest) => Promise<void>;
    readonly deleteDraft: (request: SurveyVersionOperationRequest) => Promise<void>;
    readonly setVisibility: (request: SurveyVersionOperationRequest & {
        readonly status: "draft" | "published" | "archived";
    }) => Promise<void>;
}
interface SurveyVersionQualityActions<TVersion = FormVersionRecord | FormSchema, TState = FormVersionState> {
    readonly publish?: (request: DomainSurveyVersionPublishRequest<TVersion, TState>) => Promise<void>;
    readonly runQualityCheck?: (request: DomainSurveyVersionOperationRequest<TVersion, TState>) => Promise<QualityCheckResult>;
    readonly decideQualityIssue?: (request: DomainSurveyVersionQualityIssueDecisionRequest<TVersion, TState>) => Promise<void>;
}
interface SurveyVersionLifecycleActions<TVersion = FormVersionRecord | FormSchema, TState = FormVersionState> {
    readonly cloneDraft?: (request: DomainSurveyVersionOperationRequest<TVersion, TState>) => Promise<void>;
    readonly deleteDraft?: (request: DomainSurveyVersionOperationRequest<TVersion, TState>) => Promise<void>;
    readonly setVisibility?: (request: DomainSurveyVersionOperationRequest<TVersion, TState> & {
        readonly status: "draft" | "published" | "archived";
    }) => Promise<void>;
}
/** @deprecated Use SurveyVersionActionsAdapter. Kept as a structural compatibility contract. */
interface SurveyVersionAdapter {
    readonly publish?: (request: SurveyVersionPublishRequest) => Promise<void>;
    readonly runQualityCheck?: (request: SurveyVersionOperationRequest) => Promise<QualityCheckResult>;
    readonly decideQualityIssue?: (request: SurveyVersionQualityIssueDecisionRequest) => Promise<void>;
    readonly cloneDraft?: (request: SurveyVersionOperationRequest) => Promise<void>;
    readonly deleteDraft?: (request: SurveyVersionOperationRequest) => Promise<void>;
    readonly setVisibility?: (request: SurveyVersionOperationRequest & {
        readonly status: "draft" | "published" | "archived";
    }) => Promise<void>;
    readonly qualityCheck?: (request: SurveyVersionOperationRequest) => Promise<QualityCheckResult>;
    readonly duplicate?: (request: SurveyVersionOperationRequest) => Promise<void>;
    readonly delete?: (request: SurveyVersionOperationRequest) => Promise<void>;
    readonly setStatus?: (request: SurveyVersionOperationRequest & {
        readonly status: "draft" | "published" | "archived";
    }) => Promise<void>;
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
    readonly qualityCheck?: (request: DomainSurveyVersionOperationRequest<TVersion, TState>) => Promise<QualityCheckResult>;
    readonly duplicate?: (request: DomainSurveyVersionOperationRequest<TVersion, TState>) => Promise<void>;
    readonly delete?: (request: DomainSurveyVersionOperationRequest<TVersion, TState>) => Promise<void>;
    readonly setStatus?: (request: DomainSurveyVersionOperationRequest<TVersion, TState> & {
        readonly status: "draft" | "published" | "archived";
    }) => Promise<void>;
};
type SurveyVersionOperationName = "runQualityCheck" | "publish" | "decideQualityIssue" | "cloneDraft" | "deleteDraft" | "setVisibility" | "qualityCheck" | "duplicate" | "delete" | "setStatus";
type SurveyVersionOperationStatus = "idle" | "loading" | "success" | "error" | "needs_confirmation";
interface SurveyVersionOperationState {
    readonly status: SurveyVersionOperationStatus;
    readonly error?: Error;
}
interface UseSurveyVersionOperationsOptions {
    readonly version: FormVersionRecord | FormSchema;
    readonly state?: FormVersionState;
    readonly adapter: SurveyVersionAdapter;
}
interface UseSurveyVersionOperationsResult {
    readonly quality: SurveyVersionOperationState & {
        readonly result?: QualityCheckResult;
    };
    readonly qualityDecisions: Readonly<Record<string, QualityIssueDecision>>;
    readonly operations: Readonly<Record<SurveyVersionOperationName, SurveyVersionOperationState>>;
    readonly runQualityCheck: () => Promise<QualityCheckResult | undefined>;
    readonly decideQualityIssue: (issue: QualityIssue, decision: QualityIssueDecision) => Promise<boolean>;
    readonly publish: (options?: {
        readonly allowWarnings?: boolean;
    }) => Promise<boolean>;
    readonly cloneDraft: () => Promise<boolean>;
    readonly deleteDraft: () => Promise<boolean>;
    readonly setVisibility: (status: "draft" | "published" | "archived") => Promise<boolean>;
    /** @deprecated Use cloneDraft. */
    readonly duplicate: () => Promise<boolean>;
    /** @deprecated Use deleteDraft. */
    readonly delete: () => Promise<boolean>;
    /** @deprecated Use setVisibility. */
    readonly setStatus: (status: "draft" | "published" | "archived") => Promise<boolean>;
}
type UseSurveyVersionActionsOptions = UseSurveyVersionOperationsOptions;
interface UseSurveyVersionDomainActionsOptions<TVersion, TState = unknown> {
    readonly version: TVersion;
    readonly state?: TState;
    readonly adapter: SurveyVersionActionAdapter<TVersion, TState>;
}
type UseSurveyVersionActionsResult = UseSurveyVersionOperationsResult;
type SurveySummaryInput = FormAnalytics | {
    readonly questions: readonly QuestionAggregate[];
    readonly formId?: string;
    readonly formVersion?: number;
};
interface SurveyResponseSummaryQuestion {
    readonly fieldId: string;
    readonly label: string;
    readonly kind: QuestionAggregate["kind"];
    readonly answeredCount: number;
    readonly unansweredCount: number;
    readonly options?: readonly {
        readonly id: string;
        readonly label: string;
        readonly count: number;
        readonly percentage: number;
    }[];
    readonly statistics?: Readonly<Record<string, number | null>>;
}
interface SurveyResponseSummaryData {
    readonly formId: string;
    readonly version: number;
    readonly sourceLanguage: string;
    readonly title: string;
    readonly questions: readonly SurveyResponseSummaryQuestion[];
}
interface SurveyResponseSummaryProps {
    readonly summary: SurveySummaryInput;
    readonly version: FormVersionRecord | FormSchema;
    readonly sourceLanguage: string;
    readonly renderQuestion?: (question: SurveyResponseSummaryQuestion) => ReactNode;
    readonly className?: string;
}
interface SurveyResponseSummarySlots {
    readonly renderQuestion?: (question: SurveyResponseSummaryQuestion) => ReactNode;
    readonly renderHeader?: (data: SurveyResponseSummaryData) => ReactNode;
}
interface SurveyResponseSummaryComponentProps extends SurveyResponseSummaryProps {
    readonly slots?: SurveyResponseSummarySlots;
}
type SurveyClientAsyncState = {
    readonly status: "idle" | "loading" | "success" | "error";
    readonly error?: Error;
};

/** Normalizes Core text-answer pages for translation workflows. */
declare function toFreeTextAnswerItems(items: readonly FreeTextAnswerInput[]): readonly FreeTextAnswerItem[];

/** Manages selection, PII confirmation, batching, and per-answer translation state. */
declare function useFreeTextAnswerTranslation({ items: inputItems, adapter, targetLanguage, sourceLanguage, batchSize, detectPii }: UseFreeTextAnswerTranslationOptions): UseFreeTextAnswerTranslationResult;
/** Creates a selection-free translation controller for arbitrary answer arrays. */
declare function useFreeTextAnswerTranslationController(options: CreateFreeTextTranslationControllerOptions): FreeTextTranslationController;
declare function FreeTextAnswerTranslations({ items, adapter, targetLanguage, sourceLanguage, batchSize, detectPii, slots, title, translateLabel }: FreeTextAnswerTranslationsProps): React.JSX.Element;
/** Survey-specific name for the free-text translation container. */
declare function SurveyFreeTextTable(props: FreeTextAnswerTranslationsProps): React.JSX.Element;

declare function getFreeTextAnswerFindings(items: readonly FreeTextAnswerInput[], detectPii?: TranslateFreeTextAnswersOptions["detectPii"]): readonly SensitiveDataFinding[];
declare function hasPiiCandidate(items: readonly FreeTextAnswerInput[], detectPii?: TranslateFreeTextAnswersOptions["detectPii"]): boolean;
/** Translates arbitrary free-text answers without using selection state. */
declare function translateFreeTextAnswers(inputItems: readonly FreeTextAnswerInput[], adapter: FreeTextTranslationAdapter, options: TranslateFreeTextAnswersOptions): Promise<FreeTextTranslationOutcome>;
declare function createFreeTextTranslationController(defaults: CreateFreeTextTranslationControllerOptions): FreeTextTranslationController;

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
declare function SurveyUiProvider({ locale, fallbackLocale, translationAdapter, translator: explicitTranslator, children }: SurveyUiProviderProps): ReactNode;
/** Short alias for applications that use Survey as their only Form Engine surface. */
declare const SurveyProvider: typeof SurveyUiProvider;

/** Converts analytics/domain data into a stable, localized shape for survey UI clients. */
declare function toSurveyResponseSummary(summary: SurveySummaryInput, version: FormVersionRecord | FormSchema, sourceLanguage: string): SurveyResponseSummaryData;
declare function SurveyResponseSummary({ summary, version, sourceLanguage, renderQuestion, slots, className }: SurveyResponseSummaryComponentProps): React.JSX.Element;

interface UseSurveyEditorOptions extends Omit<SurveyEditorProps, "render" | "slots" | "saveLabel" | "translateLabel"> {
}
interface UseSurveyEditorResult extends SurveyEditorRenderProps {
    readonly builder: ReturnType<typeof useFormBuilder>;
    readonly onChange: (schema: FormSchema) => void;
}
/** Combines the existing headless builder state with save and schema translation operations. */
declare function useSurveyEditor({ schema, adapter, onChange, locale: _locale, sourceLocale, targetLocale, ...builderOptions }: UseSurveyEditorOptions): UseSurveyEditorResult;
/** Preferred explicit controller name; useSurveyEditor remains as a compatibility alias. */
declare const useSurveyEditorController: typeof useSurveyEditor;
/** A ready-to-use survey editor with injectable persistence and translation operations. */
declare function SurveyEditor(props: SurveyEditorProps): React.JSX.Element;

/** Combines independently implemented version action adapters into one optional adapter. */
declare function composeSurveyVersionActions<TVersion, TState>(...adapters: readonly SurveyVersionActionAdapter<TVersion, TState>[]): SurveyVersionActionAdapter<TVersion, TState>;
/** Backward-compatible controller for Form Engine schemas and version records. */
declare function useSurveyVersionOperations(options: UseSurveyVersionOperationsOptions): UseSurveyVersionOperationsResult;
/** Generic controller for application-owned version records and state. */
declare function useSurveyVersionDomainActions<TVersion, TState = unknown>(options: UseSurveyVersionDomainActionsOptions<TVersion, TState>): UseSurveyVersionOperationsResult;
/** Preferred action-oriented name for the version controller. */
declare const useSurveyVersionActions: typeof useSurveyVersionOperations;
/** Explicit controller alias for applications that standardize on controller naming. */
declare const useSurveyVersionActionsController: typeof useSurveyVersionOperations;

export { type CreateFreeTextTranslationControllerOptions, type CreateSurveyTranslationAdapterOptions, type DirectFreeTextTranslationOptions, type DomainSurveyVersionOperationRequest, type DomainSurveyVersionPublishRequest, type DomainSurveyVersionQualityIssueDecisionRequest, type FreeTextAnswerInput, type FreeTextAnswerItem, type FreeTextAnswerSource, type FreeTextAnswerTranslationSlots, FreeTextAnswerTranslations, type FreeTextAnswerTranslationsProps, type FreeTextItemStatus, type FreeTextTranslationAdapter, type FreeTextTranslationController, type FreeTextTranslationItemState, type FreeTextTranslationOutcome, type FreeTextTranslationOutcomeItem, type FreeTextTranslationOutcomeStatus, type FreeTextTranslationRequest, type FreeTextTranslationResult, type FreeTextTranslationState, type FreeTextTranslationStatus, type QualityCheckResult, type QualityIssue, type QualityIssueDecision, type SurveyClientAsyncState, SurveyEditor, type SurveyEditorActionsAdapter, type SurveyEditorAdapter, type SurveyEditorAdapterInput, type SurveyEditorOperationState, type SurveyEditorOperationStatus, type SurveyEditorProps, type SurveyEditorRenderProps, type SurveyEditorSlots, type SurveyEditorTranslateRequest, SurveyFreeTextTable, type SurveyFreeTextTableProps, SurveyProvider, SurveyResponseSummary, type SurveyResponseSummaryComponentProps, type SurveyResponseSummaryData, type SurveyResponseSummaryProps, type SurveyResponseSummaryQuestion, type SurveyResponseSummarySlots, type SurveySummaryInput, type SurveyTranslationAdapter, SurveyUiProvider, type SurveyUiProviderProps, type SurveyVersionActionAdapter, type SurveyVersionActionsAdapter, type SurveyVersionAdapter, type SurveyVersionLifecycleActions, type SurveyVersionOperationName, type SurveyVersionOperationRequest, type SurveyVersionOperationState, type SurveyVersionOperationStatus, type SurveyVersionPublishRequest, type SurveyVersionQualityActions, type SurveyVersionQualityIssueDecisionRequest, type TranslateFreeTextAnswersOptions, type UseFreeTextAnswerTranslationOptions, type UseFreeTextAnswerTranslationResult, type UseSurveyEditorOptions, type UseSurveyEditorResult, type UseSurveyVersionActionsOptions, type UseSurveyVersionActionsResult, type UseSurveyVersionDomainActionsOptions, type UseSurveyVersionOperationsOptions, type UseSurveyVersionOperationsResult, composeSurveyVersionActions, createFreeTextTranslationController, createSurveyTranslationAdapter, createSurveyTranslator, getFreeTextAnswerFindings, hasPiiCandidate, toFreeTextAnswerItems, toSurveyResponseSummary, translateFreeTextAnswers, useFreeTextAnswerTranslation, useFreeTextAnswerTranslationController, useSurveyEditor, useSurveyEditorController, useSurveyVersionActions, useSurveyVersionActionsController, useSurveyVersionDomainActions, useSurveyVersionOperations };
