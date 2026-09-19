import {
  type FormField,
  type FormInteractionEvent,
  type FormInteractionEventBase,
  type FormSchema,
  type FormValue,
  type ValidationCode,
  validateFieldValue
} from "@form-engine-ts/core";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { FormTelemetryOptions } from "../types";

type EventInput = {
  [T in FormInteractionEvent["type"]]: Omit<
    Extract<FormInteractionEvent, { readonly type: T }>,
    keyof FormInteractionEventBase
  > & {
    readonly type: T;
  };
}[FormInteractionEvent["type"]];

export interface FormTelemetryRuntime {
  readonly formViewed: () => void;
  readonly start: () => void;
  readonly pageViewed: (pageId: string) => void;
  readonly pageCompleted: (pageId: string) => void;
  readonly fieldPresented: (field: FormField, pageId?: string) => void;
  readonly fieldFocused: (field: FormField, pageId?: string) => void;
  readonly fieldValueChanged: (field: FormField, nextValue: FormValue, pageId?: string) => void;
  readonly validationFailed: (
    scope: "field" | "page" | "form",
    issues: readonly { readonly fieldId: string; readonly code: ValidationCode }[],
    pageId?: string
  ) => void;
  readonly submitAttempted: () => void;
  readonly submitted: () => void;
  readonly submitFailed: () => void;
}

function now(): number {
  return globalThis.performance?.now() ?? Date.now();
}

function randomId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function hasMeaningfulValue(value: FormValue): boolean {
  if (value === undefined || value === "") return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object")
    return "optionId" in value && value.optionId.length > 0 && value.text.trim().length > 0;
  return true;
}

export function useFormTelemetry(schema: FormSchema, options?: FormTelemetryOptions): FormTelemetryRuntime {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const sessionIdRef = useRef(options?.sessionId ?? randomId());
  const sessionStartedAtRef = useRef(now());
  const sequenceRef = useRef(0);
  const viewedRef = useRef(false);
  const startedRef = useRef(false);
  const submittedRef = useRef(false);
  const exitedRef = useRef(false);
  const mountedRef = useRef(false);
  const presentedFieldsRef = useRef(new Set<string>());
  const focusedFieldsRef = useRef(new Set<string>());
  const completedFieldsRef = useRef(new Set<string>());
  const viewedPagesRef = useRef(new Set<string>());
  const completedPagesRef = useRef(new Set<string>());
  const pageStartedAtRef = useRef(new Map<string, number>());
  const fieldPresentedAtRef = useRef(new Map<string, number>());
  const fieldStartedAtRef = useRef(new Map<string, number>());
  const trackPendingRef = useRef(Promise.resolve());
  const sessionIdentityRef = useRef({ formId: schema.id, formVersion: schema.version, sessionId: options?.sessionId });

  const emit = useCallback(
    (input: EventInput): FormInteractionEvent | undefined => {
      const currentOptions = optionsRef.current;
      if (currentOptions === undefined) return undefined;
      const event: FormInteractionEvent = {
        ...input,
        eventId: randomId(),
        eventVersion: 1,
        sessionId: sessionIdRef.current,
        sequence: ++sequenceRef.current,
        formId: schema.id,
        formVersion: schema.version,
        occurredAt: new Date().toISOString(),
        elapsedMs: Math.max(0, now() - sessionStartedAtRef.current),
        ...(currentOptions.context === undefined ? {} : { context: currentOptions.context })
      };
      const reportError = (error: unknown) => {
        try {
          currentOptions.onError?.(error, event);
        } catch {
          // Telemetry error handlers must not affect form interaction.
        }
      };
      try {
        const trackPromise = Promise.resolve(currentOptions.adapter.track(event)).catch(reportError);
        trackPendingRef.current = trackPendingRef.current.then(() => trackPromise);
      } catch (error) {
        reportError(error);
      }
      return event;
    },
    [schema.id, schema.version]
  );

  const runtime = useMemo<FormTelemetryRuntime>(() => {
    const formViewed = () => {
      if (viewedRef.current) return;
      viewedRef.current = true;
      emit({ type: "form.viewed" });
    };
    const start = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      emit({ type: "form.started" });
    };
    const pageViewed = (pageId: string) => {
      if (viewedPagesRef.current.has(pageId)) return;
      viewedPagesRef.current.add(pageId);
      pageStartedAtRef.current.set(pageId, now());
      emit({ type: "page.viewed", pageId });
    };
    const pageCompleted = (pageId: string) => {
      if (completedPagesRef.current.has(pageId)) return;
      completedPagesRef.current.add(pageId);
      const startedAt = pageStartedAtRef.current.get(pageId);
      pageStartedAtRef.current.delete(pageId);
      emit({
        type: "page.completed",
        pageId,
        ...(startedAt === undefined ? {} : { durationMs: Math.max(0, now() - startedAt) })
      });
    };
    const fieldPresented = (field: FormField, pageId?: string) => {
      if (optionsRef.current?.capture?.fieldPresented === false || presentedFieldsRef.current.has(field.id)) return;
      presentedFieldsRef.current.add(field.id);
      fieldPresentedAtRef.current.set(field.id, now());
      emit({
        type: "field.presented",
        fieldId: field.id,
        fieldType: field.type,
        ...(pageId === undefined ? {} : { pageId })
      });
    };
    const fieldFocused = (field: FormField, pageId?: string) => {
      if (optionsRef.current?.capture?.fieldFocus === false || focusedFieldsRef.current.has(field.id)) return;
      focusedFieldsRef.current.add(field.id);
      fieldStartedAtRef.current.set(field.id, now());
      emit({
        type: "field.focused",
        fieldId: field.id,
        fieldType: field.type,
        ...(pageId === undefined ? {} : { pageId })
      });
    };
    const fieldValueChanged = (field: FormField, nextValue: FormValue, pageId?: string) => {
      start();
      if (
        completedFieldsRef.current.has(field.id) ||
        !hasMeaningfulValue(nextValue) ||
        !validateFieldValue(field, nextValue)
      )
        return;
      completedFieldsRef.current.add(field.id);
      const startedAt = fieldStartedAtRef.current.get(field.id) ?? fieldPresentedAtRef.current.get(field.id);
      const fallbackStartedAt = startedAt ?? sessionStartedAtRef.current;
      emit({
        type: "field.completed",
        fieldId: field.id,
        fieldType: field.type,
        ...(pageId === undefined ? {} : { pageId }),
        durationMs: Math.max(0, now() - fallbackStartedAt)
      });
    };
    const validationFailed = (
      scope: "field" | "page" | "form",
      issues: readonly { readonly fieldId: string; readonly code: ValidationCode }[],
      pageId?: string
    ) => {
      if (optionsRef.current?.capture?.validation === false) return;
      emit({ type: "validation.failed", scope, issues, ...(pageId === undefined ? {} : { pageId }) });
    };
    const submitAttempted = () => {
      start();
      emit({ type: "form.submit_attempted" });
    };
    const submitted = () => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      emit({ type: "form.submitted", durationMs: Math.max(0, now() - sessionStartedAtRef.current) });
    };
    const submitFailed = () => emit({ type: "form.submit_failed" });
    return {
      formViewed,
      start,
      pageViewed,
      pageCompleted,
      fieldPresented,
      fieldFocused,
      fieldValueChanged,
      validationFailed,
      submitAttempted,
      submitted,
      submitFailed
    };
  }, [emit]);

  useEffect(() => {
    const currentIdentity = sessionIdentityRef.current;
    if (
      currentIdentity.formId === schema.id &&
      currentIdentity.formVersion === schema.version &&
      currentIdentity.sessionId === options?.sessionId
    )
      return;

    sessionIdentityRef.current = { formId: schema.id, formVersion: schema.version, sessionId: options?.sessionId };
    sessionIdRef.current = options?.sessionId ?? randomId();
    sessionStartedAtRef.current = now();
    sequenceRef.current = 0;
    viewedRef.current = false;
    startedRef.current = false;
    submittedRef.current = false;
    exitedRef.current = false;
    presentedFieldsRef.current.clear();
    focusedFieldsRef.current.clear();
    completedFieldsRef.current.clear();
    viewedPagesRef.current.clear();
    completedPagesRef.current.clear();
    pageStartedAtRef.current.clear();
    fieldPresentedAtRef.current.clear();
    fieldStartedAtRef.current.clear();
  }, [options?.sessionId, schema.id, schema.version]);

  useEffect(() => {
    mountedRef.current = true;
    const exit = () => {
      if (!viewedRef.current || submittedRef.current || exitedRef.current) return;
      exitedRef.current = true;
      const event = emit({ type: "form.exited", reason: "pagehide" });
      const currentOptions = optionsRef.current;
      if (event === undefined || currentOptions?.adapter.flush === undefined) return;
      void trackPendingRef.current
        .then(() => currentOptions.adapter.flush?.())
        .catch((error: unknown) => {
          try {
            currentOptions.onError?.(error, event);
          } catch {
            // Telemetry error handlers must not affect form interaction.
          }
        });
    };
    globalThis.addEventListener("pagehide", exit);
    return () => {
      mountedRef.current = false;
      globalThis.removeEventListener("pagehide", exit);
      globalThis.setTimeout(() => {
        if (mountedRef.current || !viewedRef.current || submittedRef.current || exitedRef.current) return;
        exitedRef.current = true;
        const event = emit({ type: "form.exited", reason: "unmount" });
        const currentOptions = optionsRef.current;
        if (event === undefined || currentOptions?.adapter.flush === undefined) return;
        void trackPendingRef.current
          .then(() => currentOptions.adapter.flush?.())
          .catch((error: unknown) => {
            try {
              currentOptions.onError?.(error, event);
            } catch {
              // Telemetry error handlers must not affect form interaction.
            }
          });
      }, 0);
    };
  }, [emit]);

  return runtime;
}
