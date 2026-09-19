import type { QuestionType, ValidationCode } from "./types";

export type FormInteractionEventType =
  | "form.viewed"
  | "form.started"
  | "page.viewed"
  | "page.completed"
  | "field.presented"
  | "field.focused"
  | "field.completed"
  | "validation.failed"
  | "form.submit_attempted"
  | "form.submitted"
  | "form.submit_failed"
  | "form.exited";

export type FormTelemetryContextValue = string | number | boolean | null;

export interface FormInteractionEventBase {
  readonly eventId: string;
  readonly eventVersion: 1;
  readonly type: FormInteractionEventType;
  readonly sessionId: string;
  readonly sequence: number;
  readonly formId: string;
  readonly formVersion: number;
  readonly occurredAt: string;
  readonly elapsedMs: number;
  readonly context?: Readonly<Record<string, FormTelemetryContextValue>>;
}

export interface FormViewedEvent extends FormInteractionEventBase {
  readonly type: "form.viewed";
}

export interface FormStartedEvent extends FormInteractionEventBase {
  readonly type: "form.started";
}

export interface PageViewedEvent extends FormInteractionEventBase {
  readonly type: "page.viewed";
  readonly pageId: string;
}

export interface PageCompletedEvent extends FormInteractionEventBase {
  readonly type: "page.completed";
  readonly pageId: string;
  readonly durationMs?: number;
}

export interface FieldPresentedEvent extends FormInteractionEventBase {
  readonly type: "field.presented";
  readonly fieldId: string;
  readonly fieldType: QuestionType;
  readonly pageId?: string;
}

export interface FieldFocusedEvent extends FormInteractionEventBase {
  readonly type: "field.focused";
  readonly fieldId: string;
  readonly fieldType: QuestionType;
  readonly pageId?: string;
}

export interface FieldCompletedEvent extends FormInteractionEventBase {
  readonly type: "field.completed";
  readonly fieldId: string;
  readonly fieldType: QuestionType;
  readonly pageId?: string;
  readonly durationMs?: number;
}

export interface ValidationFailedEvent extends FormInteractionEventBase {
  readonly type: "validation.failed";
  readonly scope: "field" | "page" | "form";
  readonly pageId?: string;
  readonly issues: readonly { readonly fieldId: string; readonly code: ValidationCode }[];
}

export interface FormSubmitAttemptedEvent extends FormInteractionEventBase {
  readonly type: "form.submit_attempted";
}

export interface FormSubmittedEvent extends FormInteractionEventBase {
  readonly type: "form.submitted";
  readonly durationMs?: number;
}

export interface FormSubmitFailedEvent extends FormInteractionEventBase {
  readonly type: "form.submit_failed";
  readonly code?: string;
}

export interface FormExitedEvent extends FormInteractionEventBase {
  readonly type: "form.exited";
  readonly reason?: "pagehide" | "unmount";
}

export type FormInteractionEvent =
  | FormViewedEvent
  | FormStartedEvent
  | PageViewedEvent
  | PageCompletedEvent
  | FieldPresentedEvent
  | FieldFocusedEvent
  | FieldCompletedEvent
  | ValidationFailedEvent
  | FormSubmitAttemptedEvent
  | FormSubmittedEvent
  | FormSubmitFailedEvent
  | FormExitedEvent;

export interface FormTelemetryAdapter {
  track(event: FormInteractionEvent): void | Promise<void>;
  flush?(): void | Promise<void>;
}
