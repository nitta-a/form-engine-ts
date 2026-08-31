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
    readonly namespaces?: readonly string[];
    /** Accepts an application i18next instance without requiring an i18next dependency. */
    readonly i18n?: SurveyI18n;
    readonly translationAdapter?: SurveyTranslationAdapter;
    readonly translator?: (key: string, params?: Record<string, unknown>) => string;
    readonly children: ReactNode;
}
/** Minimal i18next-compatible surface; the full i18next instance can be supplied structurally. */
interface SurveyI18n {
    readonly language?: string;
    t(key: string, params?: Readonly<Record<string, unknown>>): unknown;
}
/** Maps an application-owned survey record to the Form Engine schema used by headless UI primitives. */
interface SurveySchemaDomainAdapter<TDomain> {
    readonly toFormSchema: (domain: TDomain) => FormSchema;
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
}
interface UseSurveyEditorDomainOptions<TDomain> extends Omit<UseSurveyEditorOptions, "schema" | "adapter" | "onChange"> {
    readonly domain: TDomain;
    readonly domainAdapter: SurveySchemaDomainAdapter<TDomain> & {
        readonly fromFormSchema: (schema: FormSchema, previous: TDomain) => TDomain;
    };
    readonly adapter: SurveyEditorDomainActionsAdapter<TDomain>;
    readonly onDomainChange?: (domain: TDomain) => void;
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
interface QualityCheckResult {
    readonly issues: readonly QualityIssue[];
}
interface SurveyVersionActionResult<TData = void> {
    readonly succeeded: boolean;
    readonly data?: TData;
    readonly error?: Error;
    readonly requiresConfirmation?: boolean;
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
    readonly result?: SurveyVersionActionResult;
}
interface SurveyVersionQualityState {
    readonly status: SurveyVersionOperationStatus;
    readonly error?: Error;
    readonly result?: QualityCheckResult;
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
interface SurveyResponseSummaryDomainProps<TDomain> extends Omit<SurveyResponseSummaryProps, "version"> {
    readonly version: TDomain;
    readonly domainAdapter: SurveySchemaDomainAdapter<TDomain>;
}
interface SurveyResponseSummarySlots {
    readonly renderQuestion?: (question: SurveyResponseSummaryQuestion) => ReactNode;
    readonly renderHeader?: (data: SurveyResponseSummaryData) => ReactNode;
}
interface SurveyResponseSummaryComponentProps extends SurveyResponseSummaryProps {
    readonly slots?: SurveyResponseSummarySlots;
}
type SurveyResponseSummaryDomainComponentProps<TDomain> = SurveyResponseSummaryDomainProps<TDomain> & {
    readonly slots?: SurveyResponseSummarySlots;
};
type SurveyClientAsyncState = {
    readonly status: "idle" | "loading" | "success" | "error";
    readonly error?: Error;
};

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

declare function createSurveySchemaDomainAdapter<TDomain>(toFormSchema: SurveySchemaDomainAdapter<TDomain>["toFormSchema"]): SurveySchemaDomainAdapter<TDomain>;
declare function toFreeTextAnswerItemsFromDomain<TDomain>(items: readonly TDomain[], adapter: FreeTextAnswerDomainAdapter<TDomain>): readonly FreeTextAnswerItem[];
declare function useFreeTextDomainAnswerTranslation<TDomain>(options: UseFreeTextDomainAnswerTranslationOptions<TDomain>): UseFreeTextDomainAnswerTranslationResult<TDomain>;
declare function toSurveyResponseSummaryFromDomain<TDomain>(summary: SurveySummaryInput, version: TDomain, adapter: SurveySchemaDomainAdapter<TDomain>, sourceLanguage: string): SurveyResponseSummaryData;
/** Keeps the application domain record as the source of truth while the builder edits a mapped schema. */
declare function useSurveyEditorDomain<TDomain>(options: UseSurveyEditorDomainOptions<TDomain>): UseSurveyEditorResult & {
    readonly domain: TDomain;
};

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
declare function SurveyUiProvider({ locale, fallbackLocale, namespaces, i18n, translationAdapter, translator: explicitTranslator, children }: SurveyUiProviderProps): ReactNode;
/** Short alias for applications that use Survey as their only Form Engine surface. */
declare const SurveyProvider: typeof SurveyUiProvider;

/** Converts analytics/domain data into a stable, localized shape for survey UI clients. */
declare function toSurveyResponseSummary(summary: SurveySummaryInput, version: FormVersionRecord | FormSchema, sourceLanguage: string): SurveyResponseSummaryData;
declare function SurveyResponseSummary({ summary, version, sourceLanguage, renderQuestion, slots, className }: SurveyResponseSummaryComponentProps): React.JSX.Element;
/** Domain-record variant that applies the mapper supplied by the application once. */
declare function SurveyResponseSummaryDomain<TDomain>(props: SurveyResponseSummaryDomainComponentProps<TDomain>): React.JSX.Element;

interface SurveyMappingEntry {
    readonly id: string;
    readonly sourceFieldId: string;
    readonly targetFieldId: string;
    readonly label?: ReactNode;
}
interface SurveyMappingSaveRequest<TDomain> {
    readonly domain: TDomain;
    readonly mappings: readonly SurveyMappingEntry[];
    readonly signal: AbortSignal;
}
interface SurveyMappingAdapter<TDomain> {
    readonly saveMappings: (request: SurveyMappingSaveRequest<TDomain>) => Promise<TDomain | undefined>;
}
type SurveyMappingStatus = "idle" | "saving" | "saved" | "error";
interface SurveyMappingState {
    readonly status: SurveyMappingStatus;
    readonly error?: Error;
}
interface UseSurveyMappingOptions<TDomain> {
    readonly domain: TDomain;
    readonly mappings: readonly SurveyMappingEntry[];
    readonly adapter: SurveyMappingAdapter<TDomain>;
    readonly onDomainChange?: (domain: TDomain) => void;
}
interface UseSurveyMappingResult<TDomain> {
    readonly domain: TDomain;
    readonly mappings: readonly SurveyMappingEntry[];
    readonly state: SurveyMappingState;
    readonly setMappings: (mappings: readonly SurveyMappingEntry[]) => void;
    readonly save: () => Promise<boolean>;
}
interface SurveyMappingPanelSlots {
    readonly mapping?: (mapping: SurveyMappingEntry, index: number) => ReactNode;
    readonly notifications?: (state: SurveyMappingState) => ReactNode;
}
interface SurveyMappingPanelProps<TDomain> extends UseSurveyMappingOptions<TDomain> {
    readonly render?: (result: UseSurveyMappingResult<TDomain>) => ReactNode;
    readonly slots?: SurveyMappingPanelSlots;
    readonly title?: string;
}
declare function useSurveyMapping<TDomain>({ domain, mappings: inputMappings, adapter, onDomainChange }: UseSurveyMappingOptions<TDomain>): UseSurveyMappingResult<TDomain>;
/** Generic mapping editor surface with application-owned mapping persistence. */
declare function SurveyMappingPanel<TDomain>({ render, slots, title, ...options }: SurveyMappingPanelProps<TDomain>): React.JSX.Element;

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

interface SurveyWorkflowTransition<TTransitionId = string> {
    readonly id: TTransitionId;
    readonly label: ReactNode;
}
interface SurveyWorkflowTransitionRequest<TDomain, TTransitionId> {
    readonly domain: TDomain;
    readonly transition: TTransitionId;
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
}
interface UseSurveyWorkflowOptions<TDomain, TTransitionId = string> {
    readonly domain: TDomain;
    readonly transitions: readonly SurveyWorkflowTransition<TTransitionId>[];
    readonly adapter: SurveyWorkflowAdapter<TDomain, TTransitionId>;
    readonly onDomainChange?: (domain: TDomain) => void;
}
interface UseSurveyWorkflowResult<TDomain, TTransitionId = string> {
    readonly domain: TDomain;
    readonly state: SurveyWorkflowState<TTransitionId>;
    readonly transition: (transition: TTransitionId) => Promise<boolean>;
}
interface SurveyWorkflowPanelSlots<TDomain, TTransitionId = string> {
    readonly transition?: (props: {
        readonly transition: SurveyWorkflowTransition<TTransitionId>;
        readonly state: SurveyWorkflowState<TTransitionId>;
        readonly run: () => void;
    }) => ReactNode;
    readonly notifications?: (state: SurveyWorkflowState<TTransitionId>) => ReactNode;
    readonly after?: (domain: TDomain) => ReactNode;
}
interface SurveyWorkflowPanelProps<TDomain, TTransitionId = string> extends UseSurveyWorkflowOptions<TDomain, TTransitionId> {
    readonly render?: (result: UseSurveyWorkflowResult<TDomain, TTransitionId>) => ReactNode;
    readonly slots?: SurveyWorkflowPanelSlots<TDomain, TTransitionId>;
    readonly title?: string;
}
declare function useSurveyWorkflow<TDomain, TTransitionId = string>({ domain, transitions, adapter, onDomainChange }: UseSurveyWorkflowOptions<TDomain, TTransitionId>): UseSurveyWorkflowResult<TDomain, TTransitionId>;
/** Generic workflow controls with application-owned transition labels and transport. */
declare function SurveyWorkflowPanel<TDomain, TTransitionId = string>({ render, slots, title, ...options }: SurveyWorkflowPanelProps<TDomain, TTransitionId>): React.JSX.Element;

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

export { type CreateFreeTextTranslationControllerOptions, type CreateSurveyTranslationAdapterOptions, type DirectFreeTextTranslationOptions, type DomainSurveyVersionOperationRequest, type DomainSurveyVersionPublishRequest, type DomainSurveyVersionQualityIssueDecisionRequest, type FreeTextAnswerDomainAdapter, type FreeTextAnswerInput, type FreeTextAnswerItem, type FreeTextAnswerSource, type FreeTextAnswerTranslationSlots, FreeTextAnswerTranslations, type FreeTextAnswerTranslationsProps, type FreeTextItemStatus, type FreeTextTranslationAdapter, type FreeTextTranslationController, type FreeTextTranslationItemState, type FreeTextTranslationOutcome, type FreeTextTranslationOutcomeItem, type FreeTextTranslationOutcomeStatus, type FreeTextTranslationRequest, type FreeTextTranslationResult, type FreeTextTranslationState, type FreeTextTranslationStatus, type QualityCheckResult, type QualityIssue, type QualityIssueDecision, type SurveyClientAsyncState, SurveyEditor, type SurveyEditorActionsAdapter, type SurveyEditorAdapter, type SurveyEditorAdapterInput, type SurveyEditorDomainActionsAdapter, type SurveyEditorOperationState, type SurveyEditorOperationStatus, type SurveyEditorProps, type SurveyEditorRenderProps, type SurveyEditorSlots, type SurveyEditorTranslateRequest, SurveyFreeTextTable, type SurveyFreeTextTableProps, type SurveyI18n, type SurveyMappingAdapter, type SurveyMappingEntry, SurveyMappingPanel, type SurveyMappingPanelProps, type SurveyMappingPanelSlots, type SurveyMappingSaveRequest, type SurveyMappingState, type SurveyMappingStatus, SurveyProvider, SurveyQualityPanel, type SurveyQualityPanelProps, type SurveyQualityPanelSlots, SurveyResponseSummary, type SurveyResponseSummaryComponentProps, type SurveyResponseSummaryData, SurveyResponseSummaryDomain, type SurveyResponseSummaryDomainComponentProps, type SurveyResponseSummaryDomainProps, type SurveyResponseSummaryProps, type SurveyResponseSummaryQuestion, type SurveyResponseSummarySlots, type SurveySchemaDomainAdapter, type SurveySummaryInput, type SurveyTranslationAdapter, SurveyUiProvider, type SurveyUiProviderProps, type SurveyVersionActionAdapter, type SurveyVersionActionResult, type SurveyVersionActionsAdapter, type SurveyVersionAdapter, SurveyVersionHistory, type SurveyVersionHistoryProps, type SurveyVersionHistorySlots, type SurveyVersionLifecycleActions, type SurveyVersionOperationName, type SurveyVersionOperationRequest, type SurveyVersionOperationState, type SurveyVersionOperationStatus, SurveyVersionPanel, type SurveyVersionPanelProps, type SurveyVersionPanelRenderProps, type SurveyVersionPanelSlots, type SurveyVersionPublishRequest, type SurveyVersionQualityActions, type SurveyVersionQualityIssueDecisionRequest, type SurveyVersionQualityState, type SurveyWorkflowAdapter, SurveyWorkflowPanel, type SurveyWorkflowPanelProps, type SurveyWorkflowPanelSlots, type SurveyWorkflowState, type SurveyWorkflowStatus, type SurveyWorkflowTransition, type SurveyWorkflowTransitionRequest, type TranslateFreeTextAnswersOptions, type UseFreeTextAnswerTranslationOptions, type UseFreeTextAnswerTranslationResult, type UseFreeTextDomainAnswerTranslationOptions, type UseFreeTextDomainAnswerTranslationResult, type UseSurveyEditorDomainOptions, type UseSurveyEditorOptions, type UseSurveyEditorResult, type UseSurveyMappingOptions, type UseSurveyMappingResult, type UseSurveyVersionActionsOptions, type UseSurveyVersionActionsResult, type UseSurveyVersionDomainActionsOptions, type UseSurveyVersionOperationsOptions, type UseSurveyVersionOperationsResult, type UseSurveyWorkflowOptions, type UseSurveyWorkflowResult, composeSurveyVersionActions, createFreeTextTranslationController, createSurveySchemaDomainAdapter, createSurveyTranslationAdapter, createSurveyTranslator, getFreeTextAnswerFindings, hasPiiCandidate, surveyQualityIssueKey, toFreeTextAnswerItems, toFreeTextAnswerItemsFromDomain, toSurveyResponseSummary, toSurveyResponseSummaryFromDomain, translateFreeTextAnswers, useFreeTextAnswerTranslation, useFreeTextAnswerTranslationController, useFreeTextDomainAnswerTranslation, useSurveyEditor, useSurveyEditorController, useSurveyEditorDomain, useSurveyMapping, useSurveyVersionActions, useSurveyVersionActionsController, useSurveyVersionDomainActions, useSurveyVersionOperations, useSurveyWorkflow };
