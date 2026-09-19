import type { FormInteractionAnalytics } from "../src";
import { compareInteractionAnalytics } from "../src";

function analytics(formId = "form-1", formVersion = 1): FormInteractionAnalytics {
  return {
    formId,
    formVersion,
    sessions: 10,
    funnel: {
      viewedCount: 10,
      startedCount: 8,
      submitAttemptedCount: 6,
      submitFailedCount: 2,
      submittedCount: 5,
      abandonedCount: 2,
      startRate: 80,
      submissionRateFromView: 50,
      submissionRateFromStart: 62.5,
      abandonmentRate: 25,
      submitFailureRate: 33.3
    },
    pages: [
      { pageId: "p1", viewedCount: 10, completedCount: 8, completionRate: 80, averageCompletionMs: 20_000 },
      { pageId: "removed", viewedCount: 4, completedCount: 2, completionRate: 50 }
    ],
    fields: [
      {
        fieldId: "q1",
        fieldType: "text",
        presentedCount: 10,
        focusedCount: 8,
        completedCount: 7,
        focusRate: 80,
        completionRate: 70,
        validationFailureCount: 2,
        validationFailureSessionCount: 1,
        averageCompletionMs: 10_000
      },
      {
        fieldId: "removed",
        fieldType: "text",
        presentedCount: 4,
        focusedCount: 2,
        completedCount: 2,
        focusRate: 50,
        completionRate: 50,
        validationFailureCount: 0,
        validationFailureSessionCount: 0
      }
    ]
  };
}

describe("compareInteractionAnalytics", () => {
  it("compares rates, durations, matched entities, and added/removed entities", () => {
    const before = analytics();
    const baseField = before.fields[0];
    if (baseField === undefined) throw new Error("Expected field fixture");
    const after = {
      ...analytics("form-1", 2),
      funnel: { ...analytics().funnel, startRate: 90, abandonmentRate: 10, submitFailureRate: 20 },
      pages: [
        { pageId: "p1", viewedCount: 12, completedCount: 10, completionRate: 83.333, averageCompletionMs: 7_000 },
        { pageId: "added", viewedCount: 2, completedCount: 1, completionRate: 50 }
      ],
      fields: [
        {
          ...baseField,
          presentedCount: 12,
          focusedCount: 9,
          completedCount: 8,
          focusRate: 75,
          completionRate: 66.667,
          validationFailureSessionCount: 2,
          averageCompletionMs: 8_000
        },
        {
          ...baseField,
          fieldId: "added",
          presentedCount: 2,
          focusedCount: 1,
          completedCount: 1,
          focusRate: 50,
          completionRate: 50,
          validationFailureCount: 0,
          validationFailureSessionCount: 0
        }
      ]
    } satisfies FormInteractionAnalytics;
    const comparison = compareInteractionAnalytics(before, after);
    expect(comparison.funnel.startRate).toEqual({ before: 80, after: 90, deltaPercentagePoints: 10 });
    expect(comparison.funnel.abandonmentRate.deltaPercentagePoints).toBe(-15);
    expect(comparison.funnel.submitFailureRate.deltaPercentagePoints).toBeCloseTo(-13.3);
    expect(comparison.pages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pageId: "p1",
          status: "matched",
          averageCompletionMs: { before: 20_000, after: 7_000, deltaMs: -13_000 }
        }),
        expect.objectContaining({ pageId: "removed", status: "removed" }),
        expect.objectContaining({ pageId: "added", status: "added" })
      ])
    );
    expect(comparison.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldId: "q1", status: "matched" }),
        expect.objectContaining({ fieldId: "removed", status: "removed" }),
        expect.objectContaining({ fieldId: "added", status: "added" })
      ])
    );
    expect(comparison.fields[0]?.validationFailureRate?.before).toBe(10);
    expect(comparison.fields[0]?.validationFailureRate?.after).toBeCloseTo(16.667);
    expect(before.formVersion).toBe(1);
  });

  it("rejects different forms and supports undefined durations", () => {
    expect(() => compareInteractionAnalytics(analytics(), analytics("other"))).toThrow(
      "Interaction analytics must belong to the same form."
    );
    const before = analytics();
    const after = {
      ...analytics("form-1", 2),
      pages: [{ pageId: "p1", viewedCount: 1, completedCount: 1, completionRate: 100 }]
    };
    expect(compareInteractionAnalytics(before, after).pages[0]?.averageCompletionMs).toEqual({ before: 20_000 });
  });

  it("handles empty analytics, zero denominators, and legacy funnel fields without mutation", () => {
    const source = analytics();
    const { abandonmentRate: _abandonmentRate, submitFailureRate: _submitFailureRate, ...legacyFunnel } = source.funnel;
    const before = { ...source, funnel: legacyFunnel, pages: [], fields: [] };
    const after = {
      ...before,
      formVersion: 2,
      funnel: { ...legacyFunnel, submitAttemptedCount: 0, submitFailedCount: 0 }
    };
    const snapshot = structuredClone(before);
    const comparison = compareInteractionAnalytics(before, after);
    expect(comparison.funnel.abandonmentRate).toEqual({ before: 25, after: 25, deltaPercentagePoints: 0 });
    expect(comparison.funnel.submitFailureRate.before).toBeCloseTo(33.333);
    expect(comparison.funnel.submitFailureRate.after).toBe(0);
    expect(comparison.funnel.submitFailureRate.deltaPercentagePoints).toBeCloseTo(-33.333);
    expect(comparison.pages).toEqual([]);
    expect(comparison.fields).toEqual([]);
    expect(before).toEqual(snapshot);
  });
});
