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
  readonly namespaces?: readonly string[];
  /** Accepts an application i18next instance without requiring an i18next dependency. */
  readonly i18n?: SurveyI18n;
  readonly translationAdapter?: SurveyTranslationAdapter;
  readonly translator?: (key: string, params?: Record<string, unknown>) => string;
  readonly children: ReactNode;
}

/** Minimal i18next-compatible surface; the full i18next instance can be supplied structurally. */
export interface SurveyI18n {
  readonly language?: string;
  t(key: string, params?: Readonly<Record<string, unknown>>): unknown;
}

/** Maps an application-owned survey record to the Form Engine schema used by headless UI primitives. */
export interface SurveySchemaDomainAdapter<TDomain> {
  readonly toFormSchema: (domain: TDomain) => FormSchema;
}

export interface SurveyEditorTranslateRequest {
  readonly schema: FormSchema;
  readonly sourceLocale: string;
  readonly targetLocale: string;
  readonly signal: AbortSignal;
}

export interface SurveyEditorAdapter {
  /** @deprecated Use SurveyEditorActionsAdapter. */
  readonly translate?: (request: SurveyEditorTranslateRequest) => Promise<FormSchema>;
  /** @deprecated Use SurveyEditorActionsAdapter. */
  readonly save?: (schema: FormSchema) => Promise<void>;
  /** Translates the survey preview and returns the updated schema. */
  readonly translateSurveyPreview?: (request: SurveyEditorTranslateRequest) => Promise<FormSchema>;
  /** Persists the current survey draft. */
  readonly updateSurveyDraft?: (schema: FormSchema) => Promise<void>;
}

export interface SurveyEditorActionsAdapter {
  readonly translateSurveyPreview: (request: SurveyEditorTranslateRequest) => Promise<FormSchema>;
  readonly updateSurveyDraft: (schema: FormSchema) => Promise<void>;
}

export interface SurveyEditorDomainActionsAdapter<TDomain> {
  readonly translateSurveyPreview: (
    request: SurveyEditorTranslateRequest & { readonly domain: TDomain }
  ) => Promise<TDomain>;
  readonly updateSurveyDraft: (domain: TDomain) => Promise<void>;
}

export interface UseSurveyEditorDomainOptions<TDomain>
  extends Omit<UseSurveyEditorOptions, "schema" | "adapter" | "onChange"> {
  readonly domain: TDomain;
  readonly domainAdapter: SurveySchemaDomainAdapter<TDomain> & {
    readonly fromFormSchema: (schema: FormSchema, previous: TDomain) => TDomain;
  };
  readonly adapter: SurveyEditorDomainActionsAdapter<TDomain>;
  readonly onDomainChange?: (domain: TDomain) => void;
}

export type SurveyEditorAdapterInput = SurveyEditorAdapter | SurveyEditorActionsAdapter;

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
  readonly notifications?: (props: SurveyEditorRenderProps) => ReactNode;
  readonly cardSettings?: (props: SurveyEditorRenderProps) => ReactNode;
  readonly submissionSettings?: (props: SurveyEditorRenderProps) => ReactNode;
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

export interface UseSurveyEditorOptions
  extends Omit<SurveyEditorProps, "render" | "slots" | "saveLabel" | "translateLabel"> {}

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
export type FreeTextAnswerInput = FreeTextAnswerItem | TextAnswerItem | FormResponse;

export interface FreeTextAnswerDomainAdapter<TDomain> {
  readonly toFreeTextAnswerItem: (domain: TDomain) => FreeTextAnswerItem;
}

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

export interface TranslateFreeTextAnswersOptions {
  readonly targetLanguage: string;
  readonly sourceLanguage?: string;
  readonly batchSize?: number;
  readonly piiConfirmed?: boolean;
  readonly onPiiConfirmation?: (findings: readonly SensitiveDataFinding[]) => boolean | Promise<boolean>;
  readonly detectPii?: (item: FreeTextAnswerItem) => readonly SensitiveDataFinding[];
  readonly signal?: AbortSignal;
}

export interface FreeTextTranslationOutcomeItem extends FreeTextAnswerItem {
  readonly status: "pending" | "success" | "error";
  readonly translatedText?: string;
  readonly error?: Error;
}

export type FreeTextTranslationOutcomeStatus = "success" | "partial" | "error" | "cancelled" | "needs_confirmation";

export interface FreeTextTranslationOutcome {
  readonly status: FreeTextTranslationOutcomeStatus;
  readonly items: readonly FreeTextTranslationOutcomeItem[];
  readonly findings: readonly SensitiveDataFinding[];
  readonly succeeded: number;
  readonly failed: number;
  readonly failures: readonly { readonly item: FreeTextAnswerItem; readonly cause: unknown }[];
  readonly error?: Error;
}

export type DirectFreeTextTranslationOptions = Omit<TranslateFreeTextAnswersOptions, "targetLanguage"> & {
  readonly targetLanguage?: string;
};

export interface FreeTextTranslationController {
  readonly translate: (
    items: readonly FreeTextAnswerInput[],
    options?: DirectFreeTextTranslationOptions
  ) => Promise<FreeTextTranslationOutcome>;
}

export interface CreateFreeTextTranslationControllerOptions {
  readonly adapter: FreeTextTranslationAdapter;
  readonly targetLanguage: string;
  readonly sourceLanguage?: string;
  readonly batchSize?: number;
  readonly detectPii?: (item: FreeTextAnswerItem) => readonly SensitiveDataFinding[];
  readonly onPiiConfirmation?: TranslateFreeTextAnswersOptions["onPiiConfirmation"];
}

export type FreeTextItemStatus = "idle" | "pending" | "translating" | "success" | "error";

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
  readonly onPiiConfirmation?: TranslateFreeTextAnswersOptions["onPiiConfirmation"];
}

export interface UseFreeTextDomainAnswerTranslationOptions<TDomain>
  extends Omit<UseFreeTextAnswerTranslationOptions, "items"> {
  readonly items: readonly TDomain[];
  readonly domainAdapter: FreeTextAnswerDomainAdapter<TDomain>;
}

export interface UseFreeTextDomainAnswerTranslationResult<TDomain>
  extends Omit<UseFreeTextAnswerTranslationResult, "translate"> {
  /** Translates application-owned answer records directly while preserving adapter-provided IDs. */
  readonly translate: (
    items: readonly TDomain[],
    options?: DirectFreeTextTranslationOptions
  ) => Promise<FreeTextTranslationOutcome>;
}

export interface UseFreeTextAnswerTranslationResult extends FreeTextTranslationState {
  readonly setSelected: (id: string, selected: boolean) => void;
  readonly selectAll: () => void;
  readonly clearSelection: () => void;
  readonly confirmPii: () => Promise<FreeTextTranslationState>;
  readonly cancelPii: () => void;
  readonly translateSelected: () => Promise<FreeTextTranslationState>;
  /** Translates any answer array without changing the current selection. */
  readonly translate: (
    items: readonly FreeTextAnswerInput[],
    options?: DirectFreeTextTranslationOptions
  ) => Promise<FreeTextTranslationOutcome>;
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

export type SurveyFreeTextTableProps = FreeTextAnswerTranslationsProps;

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

export interface SurveyVersionActionResult<TData = void> {
  readonly succeeded: boolean;
  readonly data?: TData;
  readonly error?: Error;
  readonly requiresConfirmation?: boolean;
}

export type QualityIssueDecision = "accept" | "reject";

export interface SurveyVersionOperationRequest {
  readonly version: FormVersionRecord | FormSchema;
  readonly state?: FormVersionState;
  readonly signal: AbortSignal;
}

export interface SurveyVersionPublishRequest extends SurveyVersionOperationRequest {
  readonly allowWarnings: boolean;
}

export interface SurveyVersionQualityIssueDecisionRequest extends SurveyVersionOperationRequest {
  readonly issue: QualityIssue;
  readonly decision: QualityIssueDecision;
}

/** Transport-neutral lifecycle operations used by survey clients. */
export interface SurveyVersionActionsAdapter {
  readonly publish: (request: SurveyVersionPublishRequest) => Promise<void>;
  readonly runQualityCheck: (request: SurveyVersionOperationRequest) => Promise<QualityCheckResult>;
  readonly decideQualityIssue: (request: SurveyVersionQualityIssueDecisionRequest) => Promise<void>;
  readonly cloneDraft: (request: SurveyVersionOperationRequest) => Promise<void>;
  readonly deleteDraft: (request: SurveyVersionOperationRequest) => Promise<void>;
  readonly setVisibility: (
    request: SurveyVersionOperationRequest & { readonly status: "draft" | "published" | "archived" }
  ) => Promise<void>;
}

export interface SurveyVersionQualityActions<TVersion = FormVersionRecord | FormSchema, TState = FormVersionState> {
  readonly publish?: (request: DomainSurveyVersionPublishRequest<TVersion, TState>) => Promise<void>;
  readonly runQualityCheck?: (
    request: DomainSurveyVersionOperationRequest<TVersion, TState>
  ) => Promise<QualityCheckResult>;
  readonly decideQualityIssue?: (
    request: DomainSurveyVersionQualityIssueDecisionRequest<TVersion, TState>
  ) => Promise<void>;
}

export interface SurveyVersionLifecycleActions<TVersion = FormVersionRecord | FormSchema, TState = FormVersionState> {
  readonly cloneDraft?: (request: DomainSurveyVersionOperationRequest<TVersion, TState>) => Promise<void>;
  readonly deleteDraft?: (request: DomainSurveyVersionOperationRequest<TVersion, TState>) => Promise<void>;
  readonly setVisibility?: (
    request: DomainSurveyVersionOperationRequest<TVersion, TState> & {
      readonly status: "draft" | "published" | "archived";
    }
  ) => Promise<void>;
}

/** @deprecated Use SurveyVersionActionsAdapter. Kept as a structural compatibility contract. */
export interface SurveyVersionAdapter {
  readonly publish?: (request: SurveyVersionPublishRequest) => Promise<void>;
  readonly runQualityCheck?: (request: SurveyVersionOperationRequest) => Promise<QualityCheckResult>;
  readonly decideQualityIssue?: (request: SurveyVersionQualityIssueDecisionRequest) => Promise<void>;
  readonly cloneDraft?: (request: SurveyVersionOperationRequest) => Promise<void>;
  readonly deleteDraft?: (request: SurveyVersionOperationRequest) => Promise<void>;
  readonly setVisibility?: (
    request: SurveyVersionOperationRequest & { readonly status: "draft" | "published" | "archived" }
  ) => Promise<void>;
  readonly qualityCheck?: (request: SurveyVersionOperationRequest) => Promise<QualityCheckResult>;
  readonly duplicate?: (request: SurveyVersionOperationRequest) => Promise<void>;
  readonly delete?: (request: SurveyVersionOperationRequest) => Promise<void>;
  readonly setStatus?: (
    request: SurveyVersionOperationRequest & { readonly status: "draft" | "published" | "archived" }
  ) => Promise<void>;
}

export interface DomainSurveyVersionOperationRequest<TVersion, TState = unknown> {
  readonly version: TVersion;
  readonly state?: TState;
  readonly signal: AbortSignal;
}

export interface DomainSurveyVersionPublishRequest<TVersion, TState = unknown>
  extends DomainSurveyVersionOperationRequest<TVersion, TState> {
  readonly allowWarnings: boolean;
}

export interface DomainSurveyVersionQualityIssueDecisionRequest<TVersion, TState = unknown>
  extends DomainSurveyVersionOperationRequest<TVersion, TState> {
  readonly issue: QualityIssue;
  readonly decision: QualityIssueDecision;
}

/** Optional action units for applications that only implement part of the lifecycle. */
export type SurveyVersionActionAdapter<
  TVersion = FormVersionRecord | FormSchema,
  TState = FormVersionState
> = SurveyVersionQualityActions<TVersion, TState> &
  SurveyVersionLifecycleActions<TVersion, TState> & {
    readonly qualityCheck?: (
      request: DomainSurveyVersionOperationRequest<TVersion, TState>
    ) => Promise<QualityCheckResult>;
    readonly duplicate?: (request: DomainSurveyVersionOperationRequest<TVersion, TState>) => Promise<void>;
    readonly delete?: (request: DomainSurveyVersionOperationRequest<TVersion, TState>) => Promise<void>;
    readonly setStatus?: (
      request: DomainSurveyVersionOperationRequest<TVersion, TState> & {
        readonly status: "draft" | "published" | "archived";
      }
    ) => Promise<void>;
  };

export type SurveyVersionOperationName =
  | "runQualityCheck"
  | "publish"
  | "decideQualityIssue"
  | "cloneDraft"
  | "deleteDraft"
  | "setVisibility"
  | "qualityCheck"
  | "duplicate"
  | "delete"
  | "setStatus";
export type SurveyVersionOperationStatus = "idle" | "loading" | "success" | "error" | "needs_confirmation";

export interface SurveyVersionOperationState {
  readonly status: SurveyVersionOperationStatus;
  readonly error?: Error;
  readonly result?: SurveyVersionActionResult;
}

export interface SurveyVersionQualityState {
  readonly status: SurveyVersionOperationStatus;
  readonly error?: Error;
  readonly result?: QualityCheckResult;
}

export interface UseSurveyVersionOperationsOptions {
  readonly version: FormVersionRecord | FormSchema;
  readonly state?: FormVersionState;
  readonly adapter: SurveyVersionAdapter;
}

export interface UseSurveyVersionOperationsResult {
  readonly quality: SurveyVersionQualityState;
  readonly qualityDecisions: Readonly<Record<string, QualityIssueDecision>>;
  readonly operations: Readonly<Record<SurveyVersionOperationName, SurveyVersionOperationState>>;
  readonly runQualityCheck: () => Promise<QualityCheckResult | undefined>;
  readonly decideQualityIssue: (issue: QualityIssue, decision: QualityIssueDecision) => Promise<boolean>;
  readonly decideQualityIssueResult: (
    issue: QualityIssue,
    decision: QualityIssueDecision
  ) => Promise<SurveyVersionActionResult>;
  readonly publish: (options?: { readonly allowWarnings?: boolean }) => Promise<boolean>;
  readonly publishResult: (options?: { readonly allowWarnings?: boolean }) => Promise<SurveyVersionActionResult>;
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

export type UseSurveyVersionActionsOptions = UseSurveyVersionOperationsOptions;
export interface UseSurveyVersionDomainActionsOptions<TVersion, TState = unknown> {
  readonly version: TVersion;
  readonly state?: TState;
  readonly adapter: SurveyVersionActionAdapter<TVersion, TState>;
}
export type UseSurveyVersionActionsResult = UseSurveyVersionOperationsResult;

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

export interface SurveyResponseSummaryDomainProps<TDomain> extends Omit<SurveyResponseSummaryProps, "version"> {
  readonly version: TDomain;
  readonly domainAdapter: SurveySchemaDomainAdapter<TDomain>;
}

export interface SurveyResponseSummarySlots {
  readonly renderQuestion?: (question: SurveyResponseSummaryQuestion) => ReactNode;
  readonly renderHeader?: (data: SurveyResponseSummaryData) => ReactNode;
}

export interface SurveyResponseSummaryComponentProps extends SurveyResponseSummaryProps {
  readonly slots?: SurveyResponseSummarySlots;
}

export type SurveyResponseSummaryDomainComponentProps<TDomain> = SurveyResponseSummaryDomainProps<TDomain> & {
  readonly slots?: SurveyResponseSummarySlots;
};

export type SurveyClientAsyncState = {
  readonly status: "idle" | "loading" | "success" | "error";
  readonly error?: Error;
};
