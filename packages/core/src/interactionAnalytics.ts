import type { FormInteractionEvent } from "./telemetry";
import type { QuestionType } from "./types";

export interface InteractionAnalyticsOptions {
  readonly abandonmentThresholdMs?: number;
  readonly now?: Date | string;
}

export interface FormInteractionFunnel {
  readonly viewedCount: number;
  readonly startedCount: number;
  readonly submitAttemptedCount: number;
  readonly submittedCount: number;
  readonly abandonedCount: number;
  readonly startRate: number;
  readonly submissionRateFromView: number;
  readonly submissionRateFromStart: number;
}

export interface PageInteractionAnalytics {
  readonly pageId: string;
  readonly viewedCount: number;
  readonly completedCount: number;
  readonly completionRate: number;
  readonly averageCompletionMs?: number;
}

export interface FieldInteractionAnalytics {
  readonly fieldId: string;
  readonly fieldType: QuestionType;
  readonly presentedCount: number;
  readonly focusedCount: number;
  readonly completedCount: number;
  readonly focusRate: number;
  readonly completionRate: number;
  readonly validationFailureCount: number;
  readonly validationFailureSessionCount: number;
  readonly averageCompletionMs?: number;
}

export interface FormInteractionAnalytics {
  readonly formId: string;
  readonly formVersion: number;
  readonly sessions: number;
  readonly funnel: FormInteractionFunnel;
  readonly pages: readonly PageInteractionAnalytics[];
  readonly fields: readonly FieldInteractionAnalytics[];
}

interface SessionState {
  readonly viewed: boolean;
  readonly started: boolean;
  readonly submitAttempted: boolean;
  readonly submitted: boolean;
  readonly exited: boolean;
  readonly lastOccurredAt: number;
}

interface PageState {
  readonly viewed: Set<string>;
  readonly completed: Map<string, number | undefined>;
}

interface FieldState {
  readonly fieldType: QuestionType;
  readonly presented: Set<string>;
  readonly focused: Set<string>;
  readonly completed: Map<string, number | undefined>;
  validationFailureCount: number;
  readonly validationFailureSessions: Set<string>;
}

function percentage(count: number, total: number): number {
  return total === 0 ? 0 : (count / total) * 100;
}

function average(values: readonly (number | undefined)[]): number | undefined {
  const numbers = values.filter((value): value is number => value !== undefined && Number.isFinite(value));
  return numbers.length === 0 ? undefined : numbers.reduce((total, value) => total + value, 0) / numbers.length;
}

function eventTime(event: FormInteractionEvent): number {
  const timestamp = Date.parse(event.occurredAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function updateSession(sessions: Map<string, SessionState>, event: FormInteractionEvent): void {
  const current = sessions.get(event.sessionId) ?? {
    viewed: false,
    started: false,
    submitAttempted: false,
    submitted: false,
    exited: false,
    lastOccurredAt: eventTime(event)
  };
  sessions.set(event.sessionId, {
    ...current,
    viewed: current.viewed || event.type === "form.viewed",
    started: current.started || event.type === "form.started",
    submitAttempted: current.submitAttempted || event.type === "form.submit_attempted",
    submitted: current.submitted || event.type === "form.submitted",
    exited: current.exited || event.type === "form.exited",
    lastOccurredAt: Math.max(current.lastOccurredAt, eventTime(event))
  });
}

function pageState(pages: Map<string, PageState>, pageId: string): PageState {
  const current = pages.get(pageId);
  if (current !== undefined) return current;
  const created = { viewed: new Set<string>(), completed: new Map<string, number | undefined>() };
  pages.set(pageId, created);
  return created;
}

function fieldState(fields: Map<string, FieldState>, fieldId: string, fieldType: QuestionType): FieldState {
  const current = fields.get(fieldId);
  if (current !== undefined) return current;
  const created = {
    fieldType,
    presented: new Set<string>(),
    focused: new Set<string>(),
    completed: new Map<string, number | undefined>(),
    validationFailureCount: 0,
    validationFailureSessions: new Set<string>()
  };
  fields.set(fieldId, created);
  return created;
}

export function aggregateInteractionEvents(
  events: readonly FormInteractionEvent[],
  options: InteractionAnalyticsOptions = {}
): FormInteractionAnalytics {
  const uniqueEvents: FormInteractionEvent[] = [];
  const eventIds = new Set<string>();
  for (const event of events) {
    if (eventIds.has(event.eventId)) continue;
    eventIds.add(event.eventId);
    uniqueEvents.push(event);
  }

  const firstEvent = uniqueEvents[0];
  const formId = firstEvent?.formId ?? "";
  const formVersion = firstEvent?.formVersion ?? 0;
  for (const event of uniqueEvents) {
    if (event.formId !== formId || event.formVersion !== formVersion) {
      throw new TypeError("Interaction events must belong to one form version.");
    }
  }

  const sessions = new Map<string, SessionState>();
  const pages = new Map<string, PageState>();
  const fields = new Map<string, FieldState>();
  for (const event of uniqueEvents) {
    updateSession(sessions, event);
    if (event.type === "page.viewed") pageState(pages, event.pageId).viewed.add(event.sessionId);
    if (event.type === "page.completed") {
      const state = pageState(pages, event.pageId);
      if (!state.completed.has(event.sessionId)) state.completed.set(event.sessionId, event.durationMs);
    }
    if (event.type === "field.presented")
      fieldState(fields, event.fieldId, event.fieldType).presented.add(event.sessionId);
    if (event.type === "field.focused") fieldState(fields, event.fieldId, event.fieldType).focused.add(event.sessionId);
    if (event.type === "field.completed") {
      const state = fieldState(fields, event.fieldId, event.fieldType);
      if (!state.completed.has(event.sessionId)) state.completed.set(event.sessionId, event.durationMs);
    }
    if (event.type !== "validation.failed") continue;
    for (const issue of event.issues) {
      const state = fields.get(issue.fieldId);
      if (state === undefined) continue;
      state.validationFailureCount += 1;
      state.validationFailureSessions.add(event.sessionId);
    }
  }

  const submittedSessions = new Set(
    [...sessions].filter(([, state]) => state.submitted).map(([sessionId]) => sessionId)
  );
  const abandonedSessions = new Set(
    [...sessions]
      .filter(([, state]) => {
        if (!state.started || state.submitted) return false;
        if (state.exited) return true;
        const threshold = options.abandonmentThresholdMs;
        if (threshold === undefined || !Number.isFinite(threshold) || threshold <= 0) return false;
        const now = options.now === undefined ? Date.now() : new Date(options.now).getTime();
        return Number.isFinite(now) && now - state.lastOccurredAt >= threshold;
      })
      .map(([sessionId]) => sessionId)
  );

  const viewedCount = new Set([...sessions].filter(([, state]) => state.viewed).map(([sessionId]) => sessionId)).size;
  const startedCount = new Set([...sessions].filter(([, state]) => state.started).map(([sessionId]) => sessionId)).size;
  const submitAttemptedCount = new Set(
    [...sessions].filter(([, state]) => state.submitAttempted).map(([sessionId]) => sessionId)
  ).size;
  const submittedCount = submittedSessions.size;
  const funnel: FormInteractionFunnel = {
    viewedCount,
    startedCount,
    submitAttemptedCount,
    submittedCount,
    abandonedCount: abandonedSessions.size,
    startRate: percentage(startedCount, viewedCount),
    submissionRateFromView: percentage(submittedCount, viewedCount),
    submissionRateFromStart: percentage(submittedCount, startedCount)
  };

  return {
    formId,
    formVersion,
    sessions: sessions.size,
    funnel,
    pages: [...pages].map(([pageId, state]) => {
      const averageCompletionMs = average([...state.completed.values()]);
      return {
        pageId,
        viewedCount: state.viewed.size,
        completedCount: state.completed.size,
        completionRate: percentage(state.completed.size, state.viewed.size),
        ...(averageCompletionMs === undefined ? {} : { averageCompletionMs })
      };
    }),
    fields: [...fields].map(([fieldId, state]) => {
      const averageCompletionMs = average([...state.completed.values()]);
      return {
        fieldId,
        fieldType: state.fieldType,
        presentedCount: state.presented.size,
        focusedCount: state.focused.size,
        completedCount: state.completed.size,
        focusRate: percentage(state.focused.size, state.presented.size),
        completionRate: percentage(state.completed.size, state.presented.size),
        validationFailureCount: state.validationFailureCount,
        validationFailureSessionCount: state.validationFailureSessions.size,
        ...(averageCompletionMs === undefined ? {} : { averageCompletionMs })
      };
    })
  };
}
