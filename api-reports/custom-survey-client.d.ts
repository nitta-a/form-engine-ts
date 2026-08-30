import { JsonValue, TextAnswerItem, FormResponse, FormSchema, TranslationReport, FormAnalytics, QuestionAggregate, FormVersionRecord, TranslationAdapter, FormVersionState } from '@form-engine-ts/core';
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
    readonly translate: (request: SurveyEditorTranslateRequest) => Promise<FormSchema>;
    readonly save: (schema: FormSchema) => Promise<void>;
}
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
type FreeTextAnswerInput = FreeTextAnswerItem | TextAnswerItem;
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
    readonly translateSelected: () => Promise<FreeTextTranslationState>;
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
interface SurveyVersionOperationRequest {
    readonly version: FormVersionRecord | FormSchema;
    readonly state?: FormVersionState;
    readonly signal: AbortSignal;
}
interface SurveyVersionPublishRequest extends SurveyVersionOperationRequest {
    readonly allowWarnings: boolean;
}
interface SurveyVersionAdapter {
    readonly qualityCheck: (request: SurveyVersionOperationRequest) => Promise<QualityCheckResult>;
    readonly publish: (request: SurveyVersionPublishRequest) => Promise<void>;
    readonly duplicate: (request: SurveyVersionOperationRequest) => Promise<void>;
    readonly delete: (request: SurveyVersionOperationRequest) => Promise<void>;
    readonly setStatus: (request: SurveyVersionOperationRequest & {
        readonly status: "draft" | "published" | "archived";
    }) => Promise<void>;
}
type SurveyVersionOperationName = "qualityCheck" | "publish" | "duplicate" | "delete" | "setStatus";
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
    readonly operations: Readonly<Record<SurveyVersionOperationName, SurveyVersionOperationState>>;
    readonly runQualityCheck: () => Promise<QualityCheckResult | undefined>;
    readonly publish: (options?: {
        readonly allowWarnings?: boolean;
    }) => Promise<boolean>;
    readonly duplicate: () => Promise<boolean>;
    readonly delete: () => Promise<boolean>;
    readonly setStatus: (status: "draft" | "published" | "archived") => Promise<boolean>;
}
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

/** Normalizes Core text-answer pages for the translation workflow. */
declare function toFreeTextAnswerItems(items: readonly FreeTextAnswerInput[]): readonly FreeTextAnswerItem[];
/** Manages selection, PII confirmation, batching, and per-answer translation state. */
declare function useFreeTextAnswerTranslation({ items: inputItems, adapter, targetLanguage, sourceLanguage, batchSize, detectPii }: UseFreeTextAnswerTranslationOptions): UseFreeTextAnswerTranslationResult;
declare function FreeTextAnswerTranslations({ items, adapter, targetLanguage, sourceLanguage, batchSize, detectPii, slots, title, translateLabel }: FreeTextAnswerTranslationsProps): React.JSX.Element;

/** Provides one shared translation scope for all custom survey client components. */
declare function SurveyUiProvider({ locale, fallbackLocale, translationAdapter, translator: explicitTranslator, children }: SurveyUiProviderProps): ReactNode;

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
/** A ready-to-use survey editor with injectable persistence and translation operations. */
declare function SurveyEditor(props: SurveyEditorProps): React.JSX.Element;

/** Manages quality checks and version lifecycle actions without choosing a transport or cache library. */
declare function useSurveyVersionOperations({ version, state: versionState, adapter }: UseSurveyVersionOperationsOptions): UseSurveyVersionOperationsResult;

export { type FreeTextAnswerInput, type FreeTextAnswerItem, type FreeTextAnswerSource, type FreeTextAnswerTranslationSlots, FreeTextAnswerTranslations, type FreeTextAnswerTranslationsProps, type FreeTextItemStatus, type FreeTextTranslationAdapter, type FreeTextTranslationItemState, type FreeTextTranslationRequest, type FreeTextTranslationResult, type FreeTextTranslationState, type FreeTextTranslationStatus, type QualityCheckResult, type QualityIssue, type SurveyClientAsyncState, SurveyEditor, type SurveyEditorAdapter, type SurveyEditorOperationState, type SurveyEditorOperationStatus, type SurveyEditorProps, type SurveyEditorRenderProps, type SurveyEditorSlots, type SurveyEditorTranslateRequest, SurveyResponseSummary, type SurveyResponseSummaryComponentProps, type SurveyResponseSummaryData, type SurveyResponseSummaryProps, type SurveyResponseSummaryQuestion, type SurveyResponseSummarySlots, type SurveySummaryInput, type SurveyTranslationAdapter, SurveyUiProvider, type SurveyUiProviderProps, type SurveyVersionAdapter, type SurveyVersionOperationName, type SurveyVersionOperationRequest, type SurveyVersionOperationState, type SurveyVersionOperationStatus, type SurveyVersionPublishRequest, type UseFreeTextAnswerTranslationOptions, type UseFreeTextAnswerTranslationResult, type UseSurveyEditorOptions, type UseSurveyEditorResult, type UseSurveyVersionOperationsOptions, type UseSurveyVersionOperationsResult, toFreeTextAnswerItems, toSurveyResponseSummary, useFreeTextAnswerTranslation, useSurveyEditor, useSurveyVersionOperations };
