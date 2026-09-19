import type {
  FieldInteractionAnalytics,
  FormInteractionAnalytics,
  PageInteractionAnalytics
} from "./interactionAnalytics";

export interface RateComparison {
  readonly before: number;
  readonly after: number;
  readonly deltaPercentagePoints: number;
}

export interface DurationComparison {
  readonly before?: number;
  readonly after?: number;
  readonly deltaMs?: number;
}

export interface CountComparison {
  readonly before: number;
  readonly after: number;
  readonly delta: number;
}

export interface FunnelInteractionComparison {
  readonly startRate: RateComparison;
  readonly submissionRateFromView: RateComparison;
  readonly submissionRateFromStart: RateComparison;
  readonly abandonmentRate: RateComparison;
  readonly submitFailureRate: RateComparison;
}

export interface PageInteractionComparison {
  readonly pageId: string;
  readonly status: "matched" | "added" | "removed";
  readonly completionRate?: RateComparison;
  readonly averageCompletionMs?: DurationComparison;
  readonly viewedCount?: CountComparison;
  readonly completedCount?: CountComparison;
}

export interface FieldInteractionComparison {
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

export interface InteractionAnalyticsComparison {
  readonly formId: string;
  readonly beforeVersion: number;
  readonly afterVersion: number;
  readonly funnel: FunnelInteractionComparison;
  readonly pages: readonly PageInteractionComparison[];
  readonly fields: readonly FieldInteractionComparison[];
}

function rate(before: number, after: number): RateComparison {
  return { before, after, deltaPercentagePoints: after - before };
}

function duration(before: number | undefined, after: number | undefined): DurationComparison {
  return {
    ...(before === undefined ? {} : { before }),
    ...(after === undefined ? {} : { after }),
    ...(before === undefined || after === undefined ? {} : { deltaMs: after - before })
  };
}

function count(before: number, after: number): CountComparison {
  return { before, after, delta: after - before };
}

function abandonmentRate(analytics: FormInteractionAnalytics): number {
  return (
    analytics.funnel.abandonmentRate ??
    (analytics.funnel.startedCount === 0 ? 0 : (analytics.funnel.abandonedCount / analytics.funnel.startedCount) * 100)
  );
}

function submitFailureRate(analytics: FormInteractionAnalytics): number {
  return (
    analytics.funnel.submitFailureRate ??
    (analytics.funnel.submitAttemptedCount === 0
      ? 0
      : ((analytics.funnel.submitFailedCount ?? 0) / analytics.funnel.submitAttemptedCount) * 100)
  );
}

function pageComparison(
  before: PageInteractionAnalytics | undefined,
  after: PageInteractionAnalytics | undefined
): PageInteractionComparison {
  const pageId = after?.pageId ?? before?.pageId ?? "";
  if (before === undefined) return { pageId, status: "added" };
  if (after === undefined) return { pageId, status: "removed" };
  return {
    pageId,
    status: "matched",
    completionRate: rate(before.completionRate, after.completionRate),
    ...(before.averageCompletionMs === undefined && after.averageCompletionMs === undefined
      ? {}
      : { averageCompletionMs: duration(before.averageCompletionMs, after.averageCompletionMs) }),
    viewedCount: count(before.viewedCount, after.viewedCount),
    completedCount: count(before.completedCount, after.completedCount)
  };
}

function fieldComparison(
  before: FieldInteractionAnalytics | undefined,
  after: FieldInteractionAnalytics | undefined
): FieldInteractionComparison {
  const fieldId = after?.fieldId ?? before?.fieldId ?? "";
  if (before === undefined) return { fieldId, status: "added" };
  if (after === undefined) return { fieldId, status: "removed" };
  return {
    fieldId,
    status: "matched",
    focusRate: rate(before.focusRate, after.focusRate),
    completionRate: rate(before.completionRate, after.completionRate),
    validationFailureRate: rate(
      before.presentedCount === 0 ? 0 : (before.validationFailureSessionCount / before.presentedCount) * 100,
      after.presentedCount === 0 ? 0 : (after.validationFailureSessionCount / after.presentedCount) * 100
    ),
    ...(before.averageCompletionMs === undefined && after.averageCompletionMs === undefined
      ? {}
      : { averageCompletionMs: duration(before.averageCompletionMs, after.averageCompletionMs) }),
    presentedCount: count(before.presentedCount, after.presentedCount),
    focusedCount: count(before.focusedCount, after.focusedCount),
    completedCount: count(before.completedCount, after.completedCount)
  };
}

function matchIds<T extends { readonly pageId: string }>(before: readonly T[], after: readonly T[]): string[] {
  return [...new Set([...before.map((item) => item.pageId), ...after.map((item) => item.pageId)])];
}

export function compareInteractionAnalytics(
  before: FormInteractionAnalytics,
  after: FormInteractionAnalytics
): InteractionAnalyticsComparison {
  if (before.formId !== after.formId) throw new TypeError("Interaction analytics must belong to the same form.");
  const beforePages = new Map(before.pages.map((page) => [page.pageId, page]));
  const afterPages = new Map(after.pages.map((page) => [page.pageId, page]));
  const beforeFields = new Map(before.fields.map((field) => [field.fieldId, field]));
  const afterFields = new Map(after.fields.map((field) => [field.fieldId, field]));
  return {
    formId: before.formId,
    beforeVersion: before.formVersion,
    afterVersion: after.formVersion,
    funnel: {
      startRate: rate(before.funnel.startRate, after.funnel.startRate),
      submissionRateFromView: rate(before.funnel.submissionRateFromView, after.funnel.submissionRateFromView),
      submissionRateFromStart: rate(before.funnel.submissionRateFromStart, after.funnel.submissionRateFromStart),
      abandonmentRate: rate(abandonmentRate(before), abandonmentRate(after)),
      submitFailureRate: rate(submitFailureRate(before), submitFailureRate(after))
    },
    pages: matchIds(before.pages, after.pages).map((pageId) =>
      pageComparison(beforePages.get(pageId), afterPages.get(pageId))
    ),
    fields: [
      ...new Set([...before.fields.map((field) => field.fieldId), ...after.fields.map((field) => field.fieldId)])
    ].map((fieldId) => fieldComparison(beforeFields.get(fieldId), afterFields.get(fieldId)))
  };
}
