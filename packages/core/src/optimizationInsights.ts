import type {
  FieldInteractionAnalytics,
  FormInteractionAnalytics,
  PageInteractionAnalytics
} from "./interactionAnalytics";

export type FormOptimizationInsightType =
  | "low_start_rate"
  | "high_form_abandonment"
  | "high_page_dropoff"
  | "low_field_focus_rate"
  | "low_field_completion_rate"
  | "high_validation_friction"
  | "high_submit_failure_rate"
  | "slow_page_completion"
  | "slow_field_completion";

export type FormOptimizationMetric =
  | "startRate"
  | "abandonmentRate"
  | "completionRate"
  | "focusRate"
  | "validationFailureRate"
  | "submitFailureRate"
  | "averageCompletionMs";

export interface FormOptimizationInsight {
  readonly id: string;
  readonly type: FormOptimizationInsightType;
  readonly scope: "form" | "page" | "field";
  readonly targetId?: string;
  readonly metric: FormOptimizationMetric;
  readonly sampleSize: number;
  readonly observedValue: number;
  readonly threshold: number;
}

export interface OptimizationInsightThresholds {
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

export interface OptimizationInsightOptions {
  readonly minimumSamples?: {
    readonly form?: number;
    readonly page?: number;
    readonly field?: number;
  };
  readonly thresholds?: OptimizationInsightThresholds;
}

export interface FormOptimizationReport {
  readonly formId: string;
  readonly formVersion: number;
  readonly insights: readonly FormOptimizationInsight[];
}

export const DEFAULT_OPTIMIZATION_MINIMUM_SAMPLES = {
  form: 30,
  page: 20,
  field: 20
} as const;

export const DEFAULT_OPTIMIZATION_THRESHOLDS = {
  lowStartRate: 50,
  highAbandonmentRate: 50,
  highPageDropoffRate: 40,
  lowFieldFocusRate: 50,
  lowFieldCompletionRate: 70,
  highValidationFailureRate: 20,
  highSubmitFailureRate: 10
} as const satisfies OptimizationInsightThresholds;

function rate(count: number, total: number): number {
  return total === 0 ? 0 : (count / total) * 100;
}

function insightId(
  formId: string,
  formVersion: number,
  type: FormOptimizationInsightType,
  scope: "form" | "page" | "field",
  targetId?: string
): string {
  return [formId, formVersion, type, scope, ...(targetId === undefined ? [] : [targetId])].join(":");
}

function addInsight(
  insights: FormOptimizationInsight[],
  analytics: FormInteractionAnalytics,
  minimumSamples: number,
  type: FormOptimizationInsightType,
  scope: "form" | "page" | "field",
  metric: FormOptimizationMetric,
  sampleSize: number,
  observedValue: number,
  threshold: number,
  targetId?: string
): void {
  if (sampleSize <= 0 || sampleSize < minimumSamples || !Number.isFinite(observedValue)) return;
  const low = type === "low_start_rate" || type === "low_field_focus_rate" || type === "low_field_completion_rate";
  if ((low && observedValue >= threshold) || (!low && observedValue <= threshold)) return;
  insights.push({
    id: insightId(analytics.formId, analytics.formVersion, type, scope, targetId),
    type,
    scope,
    ...(targetId === undefined ? {} : { targetId }),
    metric,
    sampleSize,
    observedValue,
    threshold
  });
}

function addFormInsights(
  insights: FormOptimizationInsight[],
  analytics: FormInteractionAnalytics,
  minimumSamples: number,
  thresholds: OptimizationInsightThresholds
): void {
  const { funnel } = analytics;
  const abandonmentRate = funnel.abandonmentRate ?? rate(funnel.abandonedCount, funnel.startedCount);
  const submitFailureRate =
    funnel.submitFailureRate ?? rate(funnel.submitFailedCount ?? 0, funnel.submitAttemptedCount);
  if (thresholds.lowStartRate !== undefined)
    addInsight(
      insights,
      analytics,
      minimumSamples,
      "low_start_rate",
      "form",
      "startRate",
      funnel.viewedCount,
      funnel.startRate,
      thresholds.lowStartRate
    );
  if (thresholds.highAbandonmentRate !== undefined)
    addInsight(
      insights,
      analytics,
      minimumSamples,
      "high_form_abandonment",
      "form",
      "abandonmentRate",
      funnel.startedCount,
      abandonmentRate,
      thresholds.highAbandonmentRate
    );
  if (thresholds.highSubmitFailureRate !== undefined)
    addInsight(
      insights,
      analytics,
      minimumSamples,
      "high_submit_failure_rate",
      "form",
      "submitFailureRate",
      funnel.submitAttemptedCount,
      submitFailureRate,
      thresholds.highSubmitFailureRate
    );
}

function addPageInsights(
  insights: FormOptimizationInsight[],
  analytics: FormInteractionAnalytics,
  minimumSamples: number,
  thresholds: OptimizationInsightThresholds,
  page: PageInteractionAnalytics
): void {
  if (thresholds.highPageDropoffRate !== undefined)
    addInsight(
      insights,
      analytics,
      minimumSamples,
      "high_page_dropoff",
      "page",
      "completionRate",
      page.viewedCount,
      100 - page.completionRate,
      thresholds.highPageDropoffRate,
      page.pageId
    );
  if (thresholds.slowPageCompletionMs !== undefined && page.averageCompletionMs !== undefined)
    addInsight(
      insights,
      analytics,
      minimumSamples,
      "slow_page_completion",
      "page",
      "averageCompletionMs",
      page.completedCount,
      page.averageCompletionMs,
      thresholds.slowPageCompletionMs,
      page.pageId
    );
}

function addFieldInsights(
  insights: FormOptimizationInsight[],
  analytics: FormInteractionAnalytics,
  minimumSamples: number,
  thresholds: OptimizationInsightThresholds,
  field: FieldInteractionAnalytics
): void {
  if (thresholds.lowFieldFocusRate !== undefined)
    addInsight(
      insights,
      analytics,
      minimumSamples,
      "low_field_focus_rate",
      "field",
      "focusRate",
      field.presentedCount,
      field.focusRate,
      thresholds.lowFieldFocusRate,
      field.fieldId
    );
  if (thresholds.lowFieldCompletionRate !== undefined)
    addInsight(
      insights,
      analytics,
      minimumSamples,
      "low_field_completion_rate",
      "field",
      "completionRate",
      field.presentedCount,
      field.completionRate,
      thresholds.lowFieldCompletionRate,
      field.fieldId
    );
  if (thresholds.highValidationFailureRate !== undefined)
    addInsight(
      insights,
      analytics,
      minimumSamples,
      "high_validation_friction",
      "field",
      "validationFailureRate",
      field.presentedCount,
      rate(field.validationFailureSessionCount, field.presentedCount),
      thresholds.highValidationFailureRate,
      field.fieldId
    );
  if (thresholds.slowFieldCompletionMs !== undefined && field.averageCompletionMs !== undefined)
    addInsight(
      insights,
      analytics,
      minimumSamples,
      "slow_field_completion",
      "field",
      "averageCompletionMs",
      field.completedCount,
      field.averageCompletionMs,
      thresholds.slowFieldCompletionMs,
      field.fieldId
    );
}

export function analyzeInteractionAnalytics(
  analytics: FormInteractionAnalytics,
  options: OptimizationInsightOptions = {}
): FormOptimizationReport {
  const minimumSamples = { ...DEFAULT_OPTIMIZATION_MINIMUM_SAMPLES, ...options.minimumSamples };
  const thresholds = { ...DEFAULT_OPTIMIZATION_THRESHOLDS, ...options.thresholds };
  const insights: FormOptimizationInsight[] = [];
  addFormInsights(insights, analytics, minimumSamples.form, thresholds);
  for (const page of analytics.pages) addPageInsights(insights, analytics, minimumSamples.page, thresholds, page);
  for (const field of analytics.fields) addFieldInsights(insights, analytics, minimumSamples.field, thresholds, field);
  insights.sort((left, right) => left.id.localeCompare(right.id));
  return { formId: analytics.formId, formVersion: analytics.formVersion, insights };
}
