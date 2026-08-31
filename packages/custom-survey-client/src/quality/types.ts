import type {
  DomainSurveyVersionOperationRequest,
  QualityCheckResult,
  QualityIssue,
  QualityIssueDecision,
  SurveyVersionActionResult,
  SurveyVersionAdapterResponse
} from "../types";

export interface SurveyQualityCheckAdapter<TVersion, TState = unknown, TResponse = unknown> {
  readonly run: (
    request: DomainSurveyVersionOperationRequest<TVersion, TState>
  ) => Promise<QualityCheckResult<TResponse>>;
  readonly decide?: (
    request: DomainSurveyVersionOperationRequest<TVersion, TState> & {
      readonly issue: QualityIssue;
      readonly decision: QualityIssueDecision;
      readonly result: QualityCheckResult<TResponse>;
    }
  ) => SurveyVersionAdapterResponse;
  readonly invalidate?: () => void | Promise<void>;
  readonly notify?: (event: SurveyQualityEvent<TResponse>) => void;
}

export type SurveyQualityEvent<TResponse = unknown> =
  | { readonly type: "checked"; readonly result: QualityCheckResult<TResponse> }
  | { readonly type: "decided"; readonly issue: QualityIssue; readonly decision: QualityIssueDecision }
  | { readonly type: "error"; readonly error: Error; readonly cause: unknown };

export interface SurveyQualityState<TResponse = unknown> {
  readonly status: "idle" | "loading" | "success" | "error";
  readonly issues: readonly QualityIssue[];
  readonly checkStatus?: "idle" | "running" | "passed" | "failed" | "error";
  readonly result?: QualityCheckResult<TResponse>;
  readonly error?: Error;
  readonly cause?: unknown;
  readonly runId?: string;
  readonly checkedRevision?: string | number;
}

export interface UseSurveyQualityControllerOptions<TVersion, TState = unknown, TResponse = unknown> {
  readonly version: TVersion;
  readonly state?: TState;
  readonly adapter: SurveyQualityCheckAdapter<TVersion, TState, TResponse>;
}

export interface UseSurveyQualityControllerResult<TResponse = unknown> {
  readonly quality: SurveyQualityState<TResponse>;
  readonly decisions: Readonly<Record<string, QualityIssueDecision>>;
  readonly run: () => Promise<QualityCheckResult<TResponse> | undefined>;
  readonly decide: (issue: QualityIssue, decision: QualityIssueDecision) => Promise<SurveyVersionActionResult>;
  readonly accept: (issue: QualityIssue) => Promise<SurveyVersionActionResult>;
  readonly reject: (issue: QualityIssue) => Promise<SurveyVersionActionResult>;
}
