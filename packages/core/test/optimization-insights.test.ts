import type { FormInteractionAnalytics, FormInteractionEvent } from "../src";
import { aggregateInteractionEvents, analyzeInteractionAnalytics } from "../src";

function analytics(): FormInteractionAnalytics {
  return {
    formId: "form-1",
    formVersion: 3,
    sessions: 10,
    funnel: {
      viewedCount: 10,
      startedCount: 4,
      submitAttemptedCount: 4,
      submitFailedCount: 2,
      submittedCount: 1,
      abandonedCount: 3,
      startRate: 40,
      submissionRateFromView: 10,
      submissionRateFromStart: 25,
      abandonmentRate: 75,
      submitFailureRate: 50
    },
    pages: [
      {
        pageId: "page-1",
        viewedCount: 10,
        completedCount: 4,
        completionRate: 40,
        averageCompletionMs: 30_000
      }
    ],
    fields: [
      {
        fieldId: "q1",
        fieldType: "text",
        presentedCount: 10,
        focusedCount: 4,
        completedCount: 3,
        focusRate: 40,
        completionRate: 30,
        validationFailureCount: 4,
        validationFailureSessionCount: 2,
        averageCompletionMs: 40_000
      }
    ]
  };
}

function event(eventId: string, type: FormInteractionEvent["type"], sessionId: string): FormInteractionEvent {
  return {
    eventId,
    eventVersion: 1,
    type,
    sessionId,
    sequence: 1,
    formId: "form-1",
    formVersion: 3,
    occurredAt: "2026-09-20T00:00:00.000Z",
    elapsedMs: 0
  } as FormInteractionEvent;
}

describe("analyzeInteractionAnalytics", () => {
  it("analyzes the aggregate produced from raw interaction events", () => {
    const aggregated = aggregateInteractionEvents([
      event("view-1", "form.viewed", "s1"),
      event("view-2", "form.viewed", "s2"),
      event("start-1", "form.started", "s1"),
      event("attempt-1", "form.submit_attempted", "s1"),
      event("failed-1", "form.submit_failed", "s1")
    ]);
    const report = analyzeInteractionAnalytics(aggregated, {
      minimumSamples: { form: 1 },
      thresholds: { lowStartRate: 60, highSubmitFailureRate: 10 }
    });
    expect(report.insights.map((insight) => insight.type)).toEqual(["high_submit_failure_rate", "low_start_rate"]);
  });

  it("returns every P0 insight with deterministic, privacy-safe data", () => {
    const input = analytics();
    const options = {
      minimumSamples: { form: 1, page: 1, field: 1 },
      thresholds: {
        lowStartRate: 50,
        highAbandonmentRate: 50,
        highPageDropoffRate: 50,
        lowFieldFocusRate: 50,
        lowFieldCompletionRate: 70,
        highValidationFailureRate: 10,
        highSubmitFailureRate: 10,
        slowPageCompletionMs: 20_000,
        slowFieldCompletionMs: 20_000
      }
    } as const;
    const report = analyzeInteractionAnalytics(input, options);
    expect(report.insights.map((insight) => insight.type).sort()).toEqual([
      "high_form_abandonment",
      "high_page_dropoff",
      "high_submit_failure_rate",
      "high_validation_friction",
      "low_field_completion_rate",
      "low_field_focus_rate",
      "low_start_rate",
      "slow_field_completion",
      "slow_page_completion"
    ]);
    expect(report.insights.find((insight) => insight.type === "high_validation_friction")).toMatchObject({
      targetId: "q1",
      sampleSize: 10,
      observedValue: 20,
      threshold: 10
    });
    expect(report.insights.every((insight) => !("answer" in insight) && !("title" in insight))).toBe(true);
    expect(analyzeInteractionAnalytics(input, options)).toEqual(report);
    expect(report.insights.find((insight) => insight.targetId === "q1")?.id).toBe(
      "form-1:3:high_validation_friction:field:q1"
    );
  });

  it("uses strict thresholds, skips small samples and does not invent duration insights", () => {
    const input = analytics();
    expect(
      analyzeInteractionAnalytics(input, {
        minimumSamples: { form: 11, page: 11, field: 11 },
        thresholds: { lowStartRate: 40, highPageDropoffRate: 60 }
      }).insights
    ).toEqual([]);
    const boundaryInsights = analyzeInteractionAnalytics(input, {
      minimumSamples: { form: 1, page: 1, field: 1 },
      thresholds: { lowStartRate: 40, highPageDropoffRate: 60 }
    }).insights;
    expect(boundaryInsights.some((insight) => insight.type === "low_start_rate")).toBe(false);
    expect(boundaryInsights.some((insight) => insight.type === "high_page_dropoff")).toBe(false);
    expect(boundaryInsights.some((insight) => insight.type === "slow_page_completion")).toBe(false);
  });

  it("skips zero denominators and empty analytics", () => {
    const input = analytics();
    const empty: FormInteractionAnalytics = {
      formId: "",
      formVersion: 0,
      sessions: 0,
      funnel: {
        viewedCount: 0,
        startedCount: 0,
        submitAttemptedCount: 0,
        submitFailedCount: 0,
        submittedCount: 0,
        abandonedCount: 0,
        startRate: 0,
        submissionRateFromView: 0,
        submissionRateFromStart: 0,
        abandonmentRate: 0,
        submitFailureRate: 0
      },
      pages: [],
      fields: []
    };
    expect(analyzeInteractionAnalytics(empty).insights).toEqual([]);
    const zeroDenominator = analyzeInteractionAnalytics(
      {
        ...input,
        funnel: { ...input.funnel, viewedCount: 0, startedCount: 0, submitAttemptedCount: 0 },
        pages: [],
        fields: []
      },
      { minimumSamples: { form: 1, page: 1, field: 1 } }
    ).insights;
    expect(zeroDenominator).toEqual([]);
  });
});
