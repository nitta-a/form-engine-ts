import type {
  CanonicalTranslationMetadata,
  FormAnalytics,
  FormField,
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

/** Translation service contract for schema operations; unlike SurveyTranslationAdapter it has no sync fallback. */
export interface AsyncTranslationAdapter {
  readonly translateText: (
    text: string,
    targetLocale: string,
    sourceLocale?: string,
    signal?: AbortSignal
  ) => Promise<string>;
  readonly translateBatch: (
    texts: readonly string[],
    targetLocale: string,
    sourceLocale?: string,
    signal?: AbortSignal
  ) => Promise<readonly string[]>;
}

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
  readonly commonNamespace?: string;
  readonly customSurveyNamespace?: string;
  /** Accepts an application i18next instance without requiring an i18next dependency. */
  readonly i18n?: SurveyI18n;
  readonly translationAdapter?: SurveyTranslationAdapter;
  readonly translator?: (key: string, params?: Record<string, unknown>) => string;
  readonly translation?: SurveyTranslationInput;
  readonly children: ReactNode;
}

export interface SurveyProviderProps extends SurveyUiProviderProps {}

export interface SurveyTranslationScope {
  readonly locale: string;
  readonly common: (key: string, options?: Record<string, unknown>) => string;
  readonly customSurvey: (key: string, options?: Record<string, unknown>) => string;
}

/** Input form kept compatible with v7.4 scopes; providers fill locale from their active UI locale. */
export type SurveyTranslationInput = Omit<SurveyTranslationScope, "locale"> & { readonly locale?: string };

/** Minimal i18next-compatible surface; the full i18next instance can be supplied structurally. */
export interface SurveyI18n {
  readonly language?: string;
  t(key: string, params?: Readonly<Record<string, unknown>>): unknown;
}

/** Maps an application-owned survey record to the Form Engine schema used by headless UI primitives. */
export interface SurveySchemaDomainAdapter<TDomain> {
  readonly toFormSchema: (domain: TDomain) => FormSchema;
}

export type SurveyEngineTextMetadata = Partial<CanonicalTranslationMetadata> & {
  readonly isManuallyEdited?: boolean;
  readonly isManual?: boolean;
  readonly sourceText?: string;
};

export interface SurveySchemaTextMetadataCodec<TTextMetadata> {
  readonly toEngine: (request: {
    readonly value: string;
    readonly metadata?: TTextMetadata;
    readonly sourceText: string;
    readonly sourceLocale?: string;
  }) => {
    readonly value: string;
    readonly metadata?: Readonly<Record<string, JsonValue>>;
  };
  readonly fromEngine: (request: {
    readonly value: string;
    readonly metadata: SurveyEngineTextMetadata;
    readonly sourceText: string;
  }) => TTextMetadata;
}

export interface SurveyTextMetadata {
  readonly sourceText?: string;
  readonly sourceTextHash?: string;
  readonly sourceLocale?: string;
  readonly translationSource?: "automatic" | "manual";
  readonly isManuallyEdited?: boolean;
  readonly isManual?: boolean;
  readonly translatedAt?: string;
  readonly editedAt?: string;
  readonly [key: string]: JsonValue | undefined;
}

export interface SurveyTextMetadataInput {
  readonly value: string;
  readonly metadata?: SurveyTextMetadata;
  readonly sourceText: string;
  readonly sourceLocale?: string;
}

export interface SurveyEngineText {
  readonly value: string;
  readonly sourceText: string;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface SurveyTextMetadataCodec {
  readonly toEngine: (input: SurveyTextMetadataInput) => SurveyEngineText;
  readonly fromEngine: (
    input: SurveyEngineText & { readonly metadata: SurveyEngineTextMetadata }
  ) => SurveyTextMetadata;
}

export interface CreateSurveyTextMetadataCodecOptions {
  /** Retains non-canonical JSON metadata keys during both encode and decode. */
  readonly preserveUnknown?: boolean;
  /** Generates a hash from the supplied source text, or preserves an existing hash. */
  readonly sourceTextHash?: "auto" | "preserve";
}

export interface SurveySchemaDomainAdapterOptions<TDomain, TTextMetadata = unknown> {
  readonly toFormSchema: (domain: TDomain) => FormSchema;
  readonly fromFormSchema?: (schema: FormSchema, previous: TDomain) => TDomain;
  readonly textMetadata?: SurveySchemaTextMetadataCodec<TTextMetadata>;
}

export interface SurveySchemaDomainAdapterWithTextMetadata<TDomain, TTextMetadata = unknown>
  extends SurveySchemaDomainAdapter<TDomain> {
  readonly fromFormSchema?: (schema: FormSchema, previous: TDomain) => TDomain;
  readonly textMetadata?: SurveySchemaTextMetadataCodec<TTextMetadata>;
}

export interface SurveyEditorDomainAdapter<TDomain> extends SurveySchemaDomainAdapter<TDomain> {
  readonly fromFormSchema: (schema: FormSchema, previous: TDomain) => TDomain;
}

export type EditorRenderProps = SurveyEditorRenderProps;

export interface SurveyEditorDomainSlots {
  readonly cardAppearance?: (props: EditorRenderProps) => ReactNode;
  readonly submissionSettings?: (props: EditorRenderProps) => ReactNode;
  readonly translationSettings?: (props: EditorRenderProps) => ReactNode;
  readonly validationPolicy?: (props: EditorRenderProps) => ReactNode;
  readonly toolbar?: (props: EditorRenderProps) => ReactNode;
  readonly notifications?: (props: EditorRenderProps) => ReactNode;
}

export interface SurveyEditorDomainAdapterOptions<TDomain> {
  readonly domain: TDomain;
  readonly domainAdapter: SurveyEditorDomainAdapter<TDomain>;
  readonly adapter: SurveyEditorDomainActionsAdapter<TDomain>;
  readonly onDomainChange?: (domain: TDomain) => void;
  readonly slots?: SurveyEditorDomainSlots;
  readonly domainMetadata?: unknown;
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
  readonly updateSurveyDraftResult?: (domain: TDomain) => Promise<TDomain>;
}

export interface SurveyEditorQuestionRequest<TDomain> {
  readonly domain: TDomain;
  readonly schema: FormSchema;
  readonly signal: AbortSignal;
}

export interface SurveyEditorQuestionAdapter<TDomain> {
  readonly addQuestion?: (
    request: SurveyEditorQuestionRequest<TDomain> & { readonly question: FormField; readonly index: number }
  ) => Promise<void> | Promise<TDomain>;
  readonly reorderQuestions?: (
    request: SurveyEditorQuestionRequest<TDomain> & { readonly fieldIds: readonly string[] }
  ) => Promise<void> | Promise<TDomain>;
  readonly removeQuestion?: (
    request: SurveyEditorQuestionRequest<TDomain> & { readonly question: FormField; readonly index: number }
  ) => Promise<void> | Promise<TDomain>;
}

export interface SurveyEditorConfigurationSlots {
  readonly cardSettings?: ReactNode;
  readonly responseSettings?: ReactNode;
  readonly validationPolicy?: ReactNode;
}

export interface UseSurveyEditorDomainOptions<TDomain>
  extends Omit<UseSurveyEditorOptions, "schema" | "adapter" | "onChange"> {
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
  readonly dirty?: boolean;
}

export interface SurveyEditorSlots {
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

export type QualityCheckStatus =
  | "idle"
  | "running"
  | "passed"
  | "failed"
  | "error"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "STALE";

export interface QualityCheckResult<TResponse = unknown> {
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

export type SurveyVersionQualityStatus = "RUNNING" | "COMPLETED" | "FAILED" | "STALE";

export interface SurveyVersionQualityResult<TQualityPayload = unknown> {
  readonly status: SurveyVersionQualityStatus;
  readonly runId?: string;
  readonly checkedRevision?: number;
  readonly issues: readonly QualityIssue[];
  readonly payload?: TQualityPayload;
}

export interface SurveyVersionActionResult<TData = void> {
  readonly succeeded: boolean;
  readonly data?: TData;
  readonly error?: Error;
  readonly requiresConfirmation?: boolean;
  readonly cause?: unknown;
  readonly response?: unknown;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export type QualityIssueDecision = "accept" | "reject";

export type SurveyVersionAdapterResponse<TData = void> = Promise<TData> | Promise<SurveyVersionActionResult<TData>>;

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
  readonly publishResult?: (request: SurveyVersionPublishRequest) => Promise<SurveyVersionActionResult>;
  readonly runQualityCheck: (request: SurveyVersionOperationRequest) => Promise<QualityCheckResult>;
  readonly decideQualityIssue: (request: SurveyVersionQualityIssueDecisionRequest) => Promise<void>;
  readonly decideQualityIssueResult?: (
    request: SurveyVersionQualityIssueDecisionRequest
  ) => Promise<SurveyVersionActionResult>;
  readonly cloneDraft: (request: SurveyVersionOperationRequest) => Promise<void>;
  readonly cloneDraftResult?: (request: SurveyVersionOperationRequest) => Promise<SurveyVersionActionResult>;
  readonly deleteDraft: (request: SurveyVersionOperationRequest) => Promise<void>;
  readonly deleteDraftResult?: (request: SurveyVersionOperationRequest) => Promise<SurveyVersionActionResult>;
  readonly setVisibility: (
    request: SurveyVersionOperationRequest & { readonly status: "draft" | "published" | "archived" }
  ) => Promise<void>;
  readonly setVisibilityResult?: (
    request: SurveyVersionOperationRequest & { readonly status: "draft" | "published" | "archived" }
  ) => Promise<SurveyVersionActionResult>;
}

export interface SurveyVersionQualityActions<TVersion = FormVersionRecord | FormSchema, TState = FormVersionState> {
  readonly publish?: (request: DomainSurveyVersionPublishRequest<TVersion, TState>) => Promise<void>;
  readonly publishResult?: (
    request: DomainSurveyVersionPublishRequest<TVersion, TState>
  ) => Promise<SurveyVersionActionResult>;
  readonly runQualityCheck?: (
    request: DomainSurveyVersionOperationRequest<TVersion, TState>
  ) => Promise<QualityCheckResult>;
  readonly decideQualityIssue?: (
    request: DomainSurveyVersionQualityIssueDecisionRequest<TVersion, TState>
  ) => Promise<void>;
  readonly decideQualityIssueResult?: (
    request: DomainSurveyVersionQualityIssueDecisionRequest<TVersion, TState>
  ) => Promise<SurveyVersionActionResult>;
}

export interface SurveyVersionDomainQualityActions<TVersion, TState = unknown, TQualityPayload = unknown> {
  readonly publish?: (request: DomainSurveyVersionPublishRequest<TVersion, TState>) => Promise<void>;
  readonly publishResult?: (
    request: DomainSurveyVersionPublishRequest<TVersion, TState>
  ) => Promise<SurveyVersionActionResult>;
  readonly runQualityCheck?: (
    request: DomainSurveyVersionOperationRequest<TVersion, TState>
  ) => Promise<QualityCheckResult<TQualityPayload>>;
  readonly decideQualityIssue?: (
    request: DomainSurveyVersionQualityIssueDecisionRequest<TVersion, TState>
  ) => Promise<void>;
  readonly decideQualityIssueResult?: (
    request: DomainSurveyVersionQualityIssueDecisionRequest<TVersion, TState>
  ) => Promise<SurveyVersionActionResult>;
}

export interface SurveyVersionLifecycleActions<TVersion = FormVersionRecord | FormSchema, TState = FormVersionState> {
  readonly cloneDraft?: (request: DomainSurveyVersionOperationRequest<TVersion, TState>) => Promise<void>;
  readonly cloneDraftResult?: (
    request: DomainSurveyVersionOperationRequest<TVersion, TState>
  ) => Promise<SurveyVersionActionResult>;
  readonly deleteDraft?: (request: DomainSurveyVersionOperationRequest<TVersion, TState>) => Promise<void>;
  readonly deleteDraftResult?: (
    request: DomainSurveyVersionOperationRequest<TVersion, TState>
  ) => Promise<SurveyVersionActionResult>;
  readonly setVisibility?: (
    request: DomainSurveyVersionOperationRequest<TVersion, TState> & {
      readonly status: "draft" | "published" | "archived";
    }
  ) => Promise<void>;
  readonly setVisibilityResult?: (
    request: DomainSurveyVersionOperationRequest<TVersion, TState> & {
      readonly status: "draft" | "published" | "archived";
    }
  ) => Promise<SurveyVersionActionResult>;
}

/** @deprecated Use SurveyVersionActionsAdapter. Kept as a structural compatibility contract. */
export interface SurveyVersionAdapter {
  readonly publish?: (request: SurveyVersionPublishRequest) => Promise<void>;
  readonly publishResult?: (request: SurveyVersionPublishRequest) => Promise<SurveyVersionActionResult>;
  readonly runQualityCheck?: (request: SurveyVersionOperationRequest) => Promise<QualityCheckResult>;
  readonly decideQualityIssue?: (request: SurveyVersionQualityIssueDecisionRequest) => Promise<void>;
  readonly decideQualityIssueResult?: (
    request: SurveyVersionQualityIssueDecisionRequest
  ) => Promise<SurveyVersionActionResult>;
  readonly cloneDraft?: (request: SurveyVersionOperationRequest) => Promise<void>;
  readonly cloneDraftResult?: (request: SurveyVersionOperationRequest) => Promise<SurveyVersionActionResult>;
  readonly deleteDraft?: (request: SurveyVersionOperationRequest) => Promise<void>;
  readonly deleteDraftResult?: (request: SurveyVersionOperationRequest) => Promise<SurveyVersionActionResult>;
  readonly setVisibility?: (
    request: SurveyVersionOperationRequest & { readonly status: "draft" | "published" | "archived" }
  ) => Promise<void>;
  readonly setVisibilityResult?: (
    request: SurveyVersionOperationRequest & { readonly status: "draft" | "published" | "archived" }
  ) => Promise<SurveyVersionActionResult>;
  readonly qualityCheck?: (request: SurveyVersionOperationRequest) => Promise<QualityCheckResult>;
  readonly duplicate?: (request: SurveyVersionOperationRequest) => Promise<void>;
  readonly duplicateResult?: (request: SurveyVersionOperationRequest) => Promise<SurveyVersionActionResult>;
  readonly delete?: (request: SurveyVersionOperationRequest) => Promise<void>;
  readonly deleteResult?: (request: SurveyVersionOperationRequest) => Promise<SurveyVersionActionResult>;
  readonly setStatus?: (
    request: SurveyVersionOperationRequest & { readonly status: "draft" | "published" | "archived" }
  ) => Promise<void>;
  readonly setStatusResult?: (
    request: SurveyVersionOperationRequest & { readonly status: "draft" | "published" | "archived" }
  ) => Promise<SurveyVersionActionResult>;
  readonly invalidate?: () => void | Promise<void>;
  readonly notify?: (event: SurveyVersionActionEvent) => void;
}

export interface SurveyVersionActionEvent {
  readonly operation: SurveyVersionOperationName;
  readonly result: SurveyVersionActionResult;
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
    readonly invalidate?: () => void | Promise<void>;
    readonly notify?: (event: SurveyVersionActionEvent) => void;
    readonly qualityCheck?: (
      request: DomainSurveyVersionOperationRequest<TVersion, TState>
    ) => Promise<QualityCheckResult>;
    readonly duplicate?: (request: DomainSurveyVersionOperationRequest<TVersion, TState>) => Promise<void>;
    readonly duplicateResult?: (
      request: DomainSurveyVersionOperationRequest<TVersion, TState>
    ) => Promise<SurveyVersionActionResult>;
    readonly delete?: (request: DomainSurveyVersionOperationRequest<TVersion, TState>) => Promise<void>;
    readonly deleteResult?: (
      request: DomainSurveyVersionOperationRequest<TVersion, TState>
    ) => Promise<SurveyVersionActionResult>;
    readonly setStatus?: (
      request: DomainSurveyVersionOperationRequest<TVersion, TState> & {
        readonly status: "draft" | "published" | "archived";
      }
    ) => Promise<void>;
    readonly setStatusResult?: (
      request: DomainSurveyVersionOperationRequest<TVersion, TState> & {
        readonly status: "draft" | "published" | "archived";
      }
    ) => Promise<SurveyVersionActionResult>;
  };

export type SurveyVersionDomainActionAdapter<
  TVersion,
  TState = unknown,
  TQualityPayload = unknown
> = SurveyVersionDomainQualityActions<TVersion, TState, TQualityPayload> &
  SurveyVersionLifecycleActions<TVersion, TState> & {
    readonly invalidate?: () => void | Promise<void>;
    readonly notify?: (event: SurveyVersionActionEvent) => void;
    readonly qualityCheck?: (
      request: DomainSurveyVersionOperationRequest<TVersion, TState>
    ) => Promise<QualityCheckResult<TQualityPayload>>;
    readonly duplicate?: (request: DomainSurveyVersionOperationRequest<TVersion, TState>) => Promise<void>;
    readonly duplicateResult?: (
      request: DomainSurveyVersionOperationRequest<TVersion, TState>
    ) => Promise<SurveyVersionActionResult>;
    readonly delete?: (request: DomainSurveyVersionOperationRequest<TVersion, TState>) => Promise<void>;
    readonly deleteResult?: (
      request: DomainSurveyVersionOperationRequest<TVersion, TState>
    ) => Promise<SurveyVersionActionResult>;
    readonly setStatus?: (
      request: DomainSurveyVersionOperationRequest<TVersion, TState> & {
        readonly status: "draft" | "published" | "archived";
      }
    ) => Promise<void>;
    readonly setStatusResult?: (
      request: DomainSurveyVersionOperationRequest<TVersion, TState> & {
        readonly status: "draft" | "published" | "archived";
      }
    ) => Promise<SurveyVersionActionResult>;
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

export interface SurveyVersionQualityState<TQualityPayload = unknown> {
  readonly status: SurveyVersionOperationStatus;
  readonly checkStatus?: QualityCheckStatus;
  readonly error?: Error;
  readonly cause?: unknown;
  readonly result?: QualityCheckResult<TQualityPayload>;
  readonly issues?: readonly QualityIssue[];
  readonly runId?: string;
  readonly checkedRevision?: string | number;
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

export interface SurveyVersionDomainActionsResult<TQualityPayload = unknown>
  extends Omit<SurveyVersionDomainOperationsResult<TQualityPayload>, "quality" | "runQualityCheckResult"> {
  readonly quality: {
    readonly status: SurveyVersionOperationStatus;
    readonly result?: SurveyVersionQualityResult<TQualityPayload>;
    readonly error?: Error;
  };
  readonly runQualityCheckResult: () => Promise<SurveyVersionActionResult<SurveyVersionQualityResult<TQualityPayload>>>;
  readonly publishResult: (options?: { readonly allowWarnings?: boolean }) => Promise<SurveyVersionActionResult>;
  readonly decideQualityIssueResult: (
    issue: QualityIssue,
    decision: QualityIssueDecision
  ) => Promise<SurveyVersionActionResult>;
}

export interface SurveyVersionDomainOperationsResult<TQualityPayload = unknown>
  extends Omit<UseSurveyVersionOperationsResult, "quality" | "runQualityCheck" | "runQualityCheckResult"> {
  readonly quality: SurveyVersionQualityState<TQualityPayload>;
  readonly runQualityCheck: () => Promise<QualityCheckResult<TQualityPayload> | undefined>;
  readonly runQualityCheckResult: () => Promise<SurveyVersionActionResult<QualityCheckResult<TQualityPayload>>>;
}

export type UseSurveyVersionActionsOptions = UseSurveyVersionOperationsOptions;
export interface UseSurveyVersionDomainActionsOptions<TVersion, TState = unknown> {
  readonly version: TVersion;
  readonly state?: TState;
  readonly adapter: SurveyVersionActionAdapter<TVersion, TState>;
}

export interface UseSurveyVersionDomainQualityActionsOptions<TVersion, TState = unknown, TQualityPayload = unknown> {
  readonly version: TVersion;
  readonly state?: TState;
  readonly adapter: SurveyVersionDomainActionAdapter<TVersion, TState, TQualityPayload>;
}
export type UseSurveyVersionActionsResult = UseSurveyVersionOperationsResult;

export type SurveySummaryInput =
  | FormAnalytics
  | { readonly questions: readonly QuestionAggregate[]; readonly formId?: string; readonly formVersion?: number };

export interface SurveySummaryLoader<TSummary> {
  readonly load: (request: { readonly language: string; readonly signal: AbortSignal }) => Promise<TSummary>;
}

export interface SurveyResponseSummaryLanguageAggregate {
  readonly language: string;
  readonly submissionCount: number;
  readonly summary: SurveySummaryInput;
}

export interface SurveyResponseSummarySkipReason {
  readonly reason: string;
  readonly count: number;
  readonly language?: string;
}

export interface SurveyResponseSummaryDomainAdapter<TSummary, TVersion> {
  readonly toSummaryInput: (summary: TSummary) => SurveySummaryInput;
  readonly toFormSchema: (version: TVersion) => FormSchema;
  readonly sourceLanguage: (version: TVersion) => string;
  /** Converts an application-owned language aggregate when it is not already a Form Engine summary. */
  readonly toLanguageSummaryInput?: (request: {
    readonly domain: TVersion;
    readonly summary: TSummary;
    readonly language: string;
  }) => SurveySummaryInput | undefined;
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
  readonly getQuestionDefinition?: (request: { readonly domain: TVersion; readonly fieldId: string }) => unknown;
  readonly getOptionDefinition?: (request: {
    readonly domain: TVersion;
    readonly fieldId: string;
    readonly optionId: string;
  }) => unknown;
}

export interface SurveyResponseSummaryMapperAdapter<TDomain, TDomainSummary = SurveySummaryInput> {
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
  readonly getQuestionDefinition?: (request: { readonly domain: TDomain; readonly fieldId: string }) => unknown;
  readonly getOptionDefinition?: (request: {
    readonly domain: TDomain;
    readonly fieldId: string;
    readonly optionId: string;
  }) => unknown;
}

export interface SurveyResponseSummaryQuestion {
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

export type SurveyResponseSummaryVariant = "default" | "rich";

export interface SurveyResponseSummaryData<TCustomData = unknown, TSkipReason = SurveyResponseSummarySkipReason> {
  readonly formId: string;
  readonly version: number;
  readonly sourceLanguage: string;
  readonly title: string;
  readonly questions: readonly SurveyResponseSummaryQuestion[];
  readonly languages?: readonly SurveyResponseSummaryLanguageAggregate[];
  readonly skipReasons?: readonly TSkipReason[];
  readonly customData?: TCustomData;
}

export interface SurveyResponseSummaryLanguageOption {
  readonly language: string;
  readonly count: number;
  /** Optional package-resolved label for a default or custom language tab. */
  readonly label?: ReactNode;
}

export interface SurveyResponseSummaryProps {
  readonly summary: SurveySummaryInput;
  readonly version: FormVersionRecord | FormSchema;
  readonly sourceLanguage: string;
  readonly onSourceLanguageChange?: (language: string) => void;
  readonly renderQuestion?: (question: SurveyResponseSummaryQuestion) => ReactNode;
  /** Selects the package-provided question cards and progress-bar renderer. */
  readonly variant?: SurveyResponseSummaryVariant;
  /** Locale used for counts, statistics, and percentages. Defaults to sourceLanguage. */
  readonly locale?: string;
  readonly labels?: SurveyResponseSummaryDomainLabels;
  readonly className?: string;
}

export interface SurveyResponseSummaryDomainProps<TDomain> extends Omit<SurveyResponseSummaryProps, "version"> {
  readonly version: TDomain;
  readonly domainAdapter: SurveySchemaDomainAdapter<TDomain>;
  readonly labels?: SurveyResponseSummaryDomainLabels;
  readonly languageLabel?: (language: string) => ReactNode;
}

export interface SurveyResponseSummaryDomainLabels {
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

export interface SurveyResponseSummaryDomainInputProps<TSummary, TVersion> {
  readonly summary: TSummary;
  readonly version: TVersion;
  readonly domainAdapter: SurveyResponseSummaryDomainAdapter<TSummary, TVersion>;
  readonly languageOptions?: readonly SurveyResponseSummaryLanguageOption[];
  /** Initial uncontrolled language. `null` uses the adapter's source language. */
  readonly defaultLanguage?: string | null;
  readonly selectedLanguage?: string | null;
  readonly onLanguageChange?: (language: string | null) => void;
  readonly summaryLoader?: SurveySummaryLoader<TSummary>["load"] | SurveySummaryLoader<TSummary>;
  /** Optional state override used when spreading a domain hook result into this component. */
  readonly summaryState?: SurveyClientAsyncState;
  readonly slots?: SurveyResponseSummaryDomainSlots;
  readonly variant?: SurveyResponseSummaryVariant;
  /** Locale used for counts, statistics, and percentages. Defaults to the active language. */
  readonly locale?: string;
  readonly labels?: SurveyResponseSummaryDomainLabels;
  readonly languageLabel?: (language: string) => ReactNode;
  readonly className?: string;
}

export type SurveyResponseSummaryCustomDomainProps<TDomain, TDomainSummary> = SurveyResponseSummaryDomainInputProps<
  TDomainSummary,
  TDomain
>;

export type SurveyResponseSummaryLegacyDomainProps<TDomain> = SurveyResponseSummaryDomainProps<TDomain>;

export interface SurveyResponseSummaryLegacyCustomDomainProps<TDomain, TDomainSummary>
  extends Omit<SurveyResponseSummaryProps, "summary" | "version"> {
  readonly summary: TDomainSummary;
  readonly version: TDomain;
  readonly domainAdapter: SurveyResponseSummaryMapperAdapter<TDomain, TDomainSummary>;
}

export interface SurveyResponseSummarySlots {
  readonly renderQuestion?: (question: SurveyResponseSummaryQuestion) => ReactNode;
  readonly renderHeader?: (data: SurveyResponseSummaryData) => ReactNode;
  readonly renderLanguageTabs?: (props: SurveyResponseSummaryLanguageTabsProps) => ReactNode;
  readonly header?: (data: SurveyResponseSummaryData) => ReactNode;
  readonly question?: (question: SurveyResponseSummaryQuestion) => ReactNode;
  readonly skipReasons?: (reasons: readonly unknown[]) => ReactNode;
}

export interface SurveyResponseSummaryDomainSlots extends SurveyResponseSummarySlots {
  readonly renderHeader?: (data: SurveyResponseSummaryData<unknown, unknown>) => ReactNode;
  readonly header?: (data: SurveyResponseSummaryData<unknown, unknown>) => ReactNode;
  readonly question?: (question: SurveyResponseSummaryQuestion) => ReactNode;
  readonly skipReasons?: (reasons: readonly unknown[]) => ReactNode;
  readonly languageTabs?: (props: SurveyResponseSummaryLanguageTabsProps) => ReactNode;
}

export interface SurveyResponseSummaryLanguageTabsProps {
  readonly languages: readonly SurveyResponseSummaryLanguageAggregate[];
  readonly activeLanguage: string;
  readonly onChange: (language: string) => void;
}

export interface SurveyResponseSummaryComponentProps extends SurveyResponseSummaryProps {
  readonly slots?: SurveyResponseSummarySlots;
}

export type SurveyResponseSummaryDomainComponentProps<TDomain> = SurveyResponseSummaryDomainProps<TDomain> & {
  readonly slots?: SurveyResponseSummaryDomainSlots;
};

export type SurveyResponseSummaryCustomDomainComponentProps<TDomain, TDomainSummary> =
  SurveyResponseSummaryLegacyCustomDomainProps<TDomain, TDomainSummary> & {
    readonly slots?: SurveyResponseSummarySlots;
  };

export interface UseSurveyResponseSummaryDomainOptions<TSummary, TVersion>
  extends SurveyResponseSummaryDomainInputProps<TSummary, TVersion> {}

export interface UseSurveyResponseSummaryDomainResult<TSummary, TVersion> {
  readonly data: SurveyResponseSummaryData<TSummary, unknown>;
  readonly summary: TSummary;
  readonly version: TVersion;
  readonly domainAdapter: SurveyResponseSummaryDomainAdapter<TSummary, TVersion>;
  readonly selectedLanguage: string | null;
  readonly summaryState: SurveyClientAsyncState;
  readonly summaryLoading: boolean;
  readonly summaryError?: Error;
  readonly reloadSummary: () => Promise<TSummary | undefined>;
  readonly languageOptions: readonly SurveyResponseSummaryLanguageOption[];
  readonly variant?: SurveyResponseSummaryVariant;
  readonly locale?: string;
  readonly slots?: SurveyResponseSummaryDomainSlots;
  readonly labels?: SurveyResponseSummaryDomainLabels;
  readonly languageLabel?: (language: string) => ReactNode;
  readonly className?: string;
  /** Alias suitable for spreading the hook result into SurveyResponseSummaryDomain. */
  readonly onLanguageChange: (language: string | null) => void;
  readonly setLanguage: (language: string | null) => void;
}

export type SurveyClientAsyncState = {
  readonly status: "idle" | "loading" | "success" | "error";
  readonly error?: Error;
};
