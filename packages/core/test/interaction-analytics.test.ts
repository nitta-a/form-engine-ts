import type { FormInteractionEvent } from "../src";
import { aggregateInteractionEvents } from "../src";

function event(
  eventId: string,
  type: FormInteractionEvent["type"],
  sessionId: string,
  occurredAt = "2026-09-20T00:00:00.000Z",
  extra: Record<string, unknown> = {}
): FormInteractionEvent {
  return {
    eventId,
    eventVersion: 1,
    type,
    sessionId,
    sequence: 1,
    formId: "form-1",
    formVersion: 1,
    occurredAt,
    elapsedMs: 0,
    ...extra
  } as FormInteractionEvent;
}

describe("aggregateInteractionEvents", () => {
  it("deduplicates events and uses presented fields as the completion denominator", () => {
    const events: FormInteractionEvent[] = [
      event("s1-view", "form.viewed", "s1"),
      event("s1-start", "form.started", "s1"),
      event("s1-page-view-1", "page.viewed", "s1", undefined, { pageId: "page-1" }),
      event("s1-page-view-2", "page.viewed", "s1", undefined, { pageId: "page-1" }),
      event("s1-page-complete", "page.completed", "s1", undefined, { pageId: "page-1", durationMs: 20 }),
      event("s1-present", "field.presented", "s1", undefined, { fieldId: "question-1", fieldType: "text" }),
      event("s1-focus-1", "field.focused", "s1", undefined, { fieldId: "question-1", fieldType: "text" }),
      event("s1-focus-2", "field.focused", "s1", undefined, { fieldId: "question-1", fieldType: "text" }),
      event("s1-complete", "field.completed", "s1", undefined, {
        fieldId: "question-1",
        fieldType: "text",
        durationMs: 30
      }),
      event("s1-validation-1", "validation.failed", "s1", undefined, {
        scope: "field",
        issues: [{ fieldId: "question-1", code: "required" }]
      }),
      event("s1-validation-2", "validation.failed", "s1", undefined, {
        scope: "field",
        issues: [{ fieldId: "question-1", code: "required" }]
      }),
      event("s1-attempt", "form.submit_attempted", "s1"),
      event("s1-submitted", "form.submitted", "s1"),
      event("s1-submitted", "form.submitted", "s1"),
      event("s2-view", "form.viewed", "s2"),
      event("s2-start", "form.started", "s2"),
      event("s2-present", "field.presented", "s2", undefined, { fieldId: "question-1", fieldType: "text" }),
      event("s2-exit", "form.exited", "s2"),
      event("s3-view", "form.viewed", "s3")
    ];

    const analytics = aggregateInteractionEvents(events);

    expect(analytics.sessions).toBe(3);
    expect(analytics.funnel).toMatchObject({
      viewedCount: 3,
      startedCount: 2,
      submitAttemptedCount: 1,
      submittedCount: 1,
      abandonedCount: 1,
      startRate: (2 / 3) * 100,
      submissionRateFromView: (1 / 3) * 100,
      submissionRateFromStart: 50
    });
    expect(analytics.pages[0]).toMatchObject({
      pageId: "page-1",
      viewedCount: 1,
      completedCount: 1,
      completionRate: 100,
      averageCompletionMs: 20
    });
    expect(analytics.fields[0]).toMatchObject({
      fieldId: "question-1",
      presentedCount: 2,
      focusedCount: 1,
      completedCount: 1,
      focusRate: 50,
      completionRate: 50,
      validationFailureCount: 2,
      validationFailureSessionCount: 1,
      averageCompletionMs: 30
    });
  });

  it("derives timeout abandonment and handles empty rates", () => {
    const analytics = aggregateInteractionEvents(
      [
        event("view", "form.viewed", "session", "2026-09-20T00:00:00.000Z"),
        event("start", "form.started", "session", "2026-09-20T00:01:00.000Z")
      ],
      { abandonmentThresholdMs: 30_000, now: "2026-09-20T00:02:00.000Z" }
    );

    expect(analytics.funnel.abandonedCount).toBe(1);
    expect(aggregateInteractionEvents([]).funnel).toMatchObject({
      viewedCount: 0,
      startedCount: 0,
      startRate: 0,
      submissionRateFromView: 0,
      submissionRateFromStart: 0
    });
  });

  it("keeps conditional-field completion rates scoped to presented sessions", () => {
    const events: FormInteractionEvent[] = [];
    for (let index = 0; index < 100; index += 1) {
      const sessionId = `session-${index}`;
      events.push(
        event(`${sessionId}-presented`, "field.presented", sessionId, undefined, {
          fieldId: "conditional",
          fieldType: "text"
        })
      );
      if (index < 64) {
        events.push(
          event(`${sessionId}-completed`, "field.completed", sessionId, undefined, {
            fieldId: "conditional",
            fieldType: "text"
          })
        );
      }
    }

    expect(aggregateInteractionEvents(events).fields[0]?.completionRate).toBe(64);
  });

  it("counts each field once per validation event", () => {
    const events: FormInteractionEvent[] = [
      event("present", "field.presented", "session", undefined, { fieldId: "question-1", fieldType: "text" }),
      event("failure-1", "validation.failed", "session", undefined, {
        scope: "form",
        issues: [
          { fieldId: "question-1", code: "required" },
          { fieldId: "question-1", code: "pattern" }
        ]
      }),
      event("failure-2", "validation.failed", "session", undefined, {
        scope: "form",
        issues: [{ fieldId: "question-1", code: "pattern" }]
      })
    ];

    expect(aggregateInteractionEvents(events).fields[0]).toMatchObject({
      validationFailureCount: 2,
      validationFailureSessionCount: 1
    });
  });
});
