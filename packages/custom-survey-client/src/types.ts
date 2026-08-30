import type {
  FormAnalytics,
  FormResponse,
  FormSchema,
  FormVersionRecord,
  FormVersionState,
  JsonValue,
  QuestionAggregate,
  TextAnswerItem,
  TranslationAdapter,
  TranslationReport
} from "@form-engine-ts/core";
import type { SensitiveDataFinding } from "@form-engine-ts/privacy";
import type { FormBuilderProps } from "@form-engine-ts/react";
import type { ReactNode } from "react";

export interface SurveyTranslationAdapter extends TranslationAdapter {
  readonly translateText?: (
    text: string,
    targetLocale: string,
    sourceLocale?: string,
    signal?: AbortSignal
  ) => Promise<string>;
  readonly translateBatch?: (
    texts: readonly string[],
    targetLocale: string,
    sourceLocale?: string,
    signal?: AbortSignal
  ) => Promise<readonly string[]>;
}

export interface SurveyUiProviderProps {
  readonly locale?: string;
  readonly fallbackLocale?: string;
  readonly translationAdapter?: SurveyTranslationAdapter;
  readonly translator?: (key: string, params?: Record<string, unknown>) => string;
  readonly children: ReactNode;
}

export interface SurveyEditorTranslateRequest {
  readonly schema: FormSchema;
  readonly sourceLocale: string;
  readonly targetLocale: string;
  readonly signal: AbortSignal;
}

export interface SurveyEditorAdapter {
  readonly translate: (request: SurveyEditorTranslateRequest) => Promise<FormSchema>;
  readonly save: (schema: FormSchema) => Promise<void>;
}

export type SurveyEditorOperationStatus = "idle" | "loading" | "success" | "error";

export interface SurveyEditorOperationState {
  readonly status: SurveyEditorOperationStatus;
  readonly error?: Error;
  readonly report?: TranslationReport;
}

export interface SurveyEditorRenderProps {
  readonly schema: FormSchema;
  readonly sourceLocale: string;
  readonly targetLocale: string;
  readonly state: SurveyEditorOperationState;
  readonly save: () => Promise<boolean>;
  readonly translate: () => Promise<boolean>;
}

export interface SurveyEditorSlots {
  readonly toolbar?: (props: SurveyEditorRenderProps) => ReactNode;
  readonly after?: (props: SurveyEditorRenderProps) => ReactNode;
  readonly status?: (props: SurveyEditorOperationState) => ReactNode;
}

export interface SurveyEditorProps
  extends Omit<FormBuilderProps, "schema" | "onChange" | "locale" | "translationAdapter" | "translator" | "slots"> {
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

export interface FreeTextAnswerItem {
  readonly id: string;
  readonly responseId: string;
  readonly fieldId: string;
  readonly text: string;
  readonly sourceLanguage: string;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
  readonly findings?: readonly SensitiveDataFinding[];
}

export type FreeTextAnswerSource = FreeTextAnswerItem | FormResponse;
export type FreeTextAnswerInput = FreeTextAnswerItem | TextAnswerItem;

export interface FreeTextTranslationRequest {
  readonly items: readonly FreeTextAnswerItem[];
  readonly targetLanguage: string;
  readonly sourceLanguage: string;
  readonly signal: AbortSignal;
}

export interface FreeTextTranslationResult {
  readonly id: string;
  readonly text: string;
}

export interface FreeTextTranslationAdapter {
  readonly translateBatch: (request: FreeTextTranslationRequest) => Promise<readonly FreeTextTranslationResult[]>;
}

export type FreeTextItemStatus = "idle" | "translating" | "success" | "error";

export interface FreeTextTranslationItemState extends FreeTextAnswerItem {
  readonly status: FreeTextItemStatus;
  readonly translatedText?: string;
  readonly error?: Error;
}

export type FreeTextTranslationStatus = "idle" | "translating" | "success" | "error" | "needs_confirmation";

export interface FreeTextTranslationState {
  readonly status: FreeTextTranslationStatus;
  readonly items: readonly FreeTextTranslationItemState[];
  readonly selectedIds: readonly string[];
  readonly targetLanguage: string;
  readonly sourceLanguage: string;
  readonly findings: readonly SensitiveDataFinding[];
  readonly error?: Error;
}

export interface UseFreeTextAnswerTranslationOptions {
  readonly items: readonly FreeTextAnswerInput[];
  readonly adapter: FreeTextTranslationAdapter;
  readonly targetLanguage: string;
  readonly sourceLanguage?: string;
  readonly batchSize?: number;
  readonly detectPii?: (item: FreeTextAnswerItem) => readonly SensitiveDataFinding[];
}

export interface UseFreeTextAnswerTranslationResult extends FreeTextTranslationState {
  readonly setSelected: (id: string, selected: boolean) => void;
  readonly selectAll: () => void;
  readonly clearSelection: () => void;
  readonly confirmPii: () => Promise<FreeTextTranslationState>;
  readonly translateSelected: () => Promise<FreeTextTranslationState>;
  readonly reset: () => void;
}

export interface FreeTextAnswerTranslationSlots {
  readonly renderItem?: (item: FreeTextTranslationItemState, selected: boolean) => ReactNode;
  readonly renderPiiConfirmation?: (
    findings: readonly SensitiveDataFinding[],
    confirm: () => void,
    cancel: () => void
  ) => ReactNode;
}

export interface FreeTextAnswerTranslationsProps extends UseFreeTextAnswerTranslationOptions {
  readonly slots?: FreeTextAnswerTranslationSlots;
  readonly title?: string;
  readonly translateLabel?: string;
}

export interface QualityIssue {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
  readonly severity?: "warning" | "error";
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export interface QualityCheckResult {
  readonly issues: readonly QualityIssue[];
}

export interface SurveyVersionOperationRequest {
  readonly version: FormVersionRecord | FormSchema;
  readonly state?: FormVersionState;
  readonly signal: AbortSignal;
}

export interface SurveyVersionPublishRequest extends SurveyVersionOperationRequest {
  readonly allowWarnings: boolean;
}

export interface SurveyVersionAdapter {
  readonly qualityCheck: (request: SurveyVersionOperationRequest) => Promise<QualityCheckResult>;
  readonly publish: (request: SurveyVersionPublishRequest) => Promise<void>;
  readonly duplicate: (request: SurveyVersionOperationRequest) => Promise<void>;
  readonly delete: (request: SurveyVersionOperationRequest) => Promise<void>;
  readonly setStatus: (
    request: SurveyVersionOperationRequest & { readonly status: "draft" | "published" | "archived" }
  ) => Promise<void>;
}

export type SurveyVersionOperationName = "qualityCheck" | "publish" | "duplicate" | "delete" | "setStatus";
export type SurveyVersionOperationStatus = "idle" | "loading" | "success" | "error" | "needs_confirmation";

export interface SurveyVersionOperationState {
  readonly status: SurveyVersionOperationStatus;
  readonly error?: Error;
}

export interface UseSurveyVersionOperationsOptions {
  readonly version: FormVersionRecord | FormSchema;
  readonly state?: FormVersionState;
  readonly adapter: SurveyVersionAdapter;
}

export interface UseSurveyVersionOperationsResult {
  readonly quality: SurveyVersionOperationState & { readonly result?: QualityCheckResult };
  readonly operations: Readonly<Record<SurveyVersionOperationName, SurveyVersionOperationState>>;
  readonly runQualityCheck: () => Promise<QualityCheckResult | undefined>;
  readonly publish: (options?: { readonly allowWarnings?: boolean }) => Promise<boolean>;
  readonly duplicate: () => Promise<boolean>;
  readonly delete: () => Promise<boolean>;
  readonly setStatus: (status: "draft" | "published" | "archived") => Promise<boolean>;
}

export type SurveySummaryInput =
  | FormAnalytics
  | { readonly questions: readonly QuestionAggregate[]; readonly formId?: string; readonly formVersion?: number };

export interface SurveyResponseSummaryQuestion {
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

export interface SurveyResponseSummaryData {
  readonly formId: string;
  readonly version: number;
  readonly sourceLanguage: string;
  readonly title: string;
  readonly questions: readonly SurveyResponseSummaryQuestion[];
}

export interface SurveyResponseSummaryProps {
  readonly summary: SurveySummaryInput;
  readonly version: FormVersionRecord | FormSchema;
  readonly sourceLanguage: string;
  readonly renderQuestion?: (question: SurveyResponseSummaryQuestion) => ReactNode;
  readonly className?: string;
}

export interface SurveyResponseSummarySlots {
  readonly renderQuestion?: (question: SurveyResponseSummaryQuestion) => ReactNode;
  readonly renderHeader?: (data: SurveyResponseSummaryData) => ReactNode;
}

export interface SurveyResponseSummaryComponentProps extends SurveyResponseSummaryProps {
  readonly slots?: SurveyResponseSummarySlots;
}

export type SurveyClientAsyncState = {
  readonly status: "idle" | "loading" | "success" | "error";
  readonly error?: Error;
};
