import type { BaseSubmissionMetadata, FormValues } from "@form-engine-ts/core";
import { useSyncExternalStore } from "react";
import type { SubmitResponse, TypedSubmitContext } from "./types";

export type SubmissionControllerStatus = "idle" | "submitting" | "success" | "error";

export interface SubmissionControllerState<TResponse = SubmitResponse> {
  readonly status: SubmissionControllerStatus;
  readonly response?: TResponse;
  readonly error: Error | null;
  readonly attemptCount: number;
  readonly canRetry: boolean;
}

export type SubmissionControllerSubmit<
  TResponse = SubmitResponse,
  TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata
> = (answers: FormValues, context: TypedSubmitContext<TMeta>) => Promise<SubmissionControllerResult<TResponse>>;

export type SubmissionControllerResult<TResponse = SubmitResponse> =
  | { readonly status: "cancelled" }
  | { readonly status: "success"; readonly response?: TResponse }
  | { readonly status: "error"; readonly error: Error };

export interface SubmissionControllerOptions<
  TResponse = SubmitResponse,
  TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata
> {
  readonly submit: (
    answers: FormValues,
    context: TypedSubmitContext<TMeta>
  ) => TResponse | void | Promise<TResponse | undefined> | Promise<void>;
  readonly onStateChange?: (state: SubmissionControllerState<TResponse>) => void;
}

export interface SubmissionController<
  TResponse = SubmitResponse,
  TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata
> {
  readonly getState: () => SubmissionControllerState<TResponse>;
  readonly subscribe: (listener: () => void) => () => void;
  readonly submit: SubmissionControllerSubmit<TResponse, TMeta>;
  readonly retry: () => Promise<SubmissionControllerResult<TResponse>>;
  readonly reset: () => void;
}

function normalizeError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

export function createSubmissionController<
  TResponse = SubmitResponse,
  TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata
>(options: SubmissionControllerOptions<TResponse, TMeta>): SubmissionController<TResponse, TMeta> {
  let state: SubmissionControllerState<TResponse> = {
    status: "idle",
    error: null,
    attemptCount: 0,
    canRetry: false
  };
  let inFlight: Promise<SubmissionControllerResult<TResponse>> | null = null;
  let previous: { readonly answers: FormValues; readonly context: TypedSubmitContext<TMeta> } | null = null;
  const listeners = new Set<() => void>();

  const publish = (next: SubmissionControllerState<TResponse>) => {
    state = next;
    options.onStateChange?.(state);
    for (const listener of listeners) listener();
  };

  const submit = (
    answers: FormValues,
    context: TypedSubmitContext<TMeta>
  ): Promise<SubmissionControllerResult<TResponse>> => {
    if (inFlight !== null || state.status === "success") return Promise.resolve({ status: "cancelled" });
    previous = { answers: { ...answers }, context };
    publish({
      status: "submitting",
      error: null,
      attemptCount: state.attemptCount + 1,
      canRetry: false
    });
    const request = Promise.resolve()
      .then(() => options.submit(previous?.answers ?? {}, previous?.context ?? context))
      .then((response) => {
        const result: SubmissionControllerResult<TResponse> =
          response === undefined ? { status: "success" } : { status: "success", response };
        publish({
          status: "success",
          ...(response === undefined ? {} : { response }),
          error: null,
          attemptCount: state.attemptCount,
          canRetry: false
        });
        return result;
      })
      .catch((cause: unknown) => {
        const error = normalizeError(cause);
        publish({ status: "error", error, attemptCount: state.attemptCount, canRetry: true });
        return { status: "error", error } as const;
      })
      .finally(() => {
        inFlight = null;
      });
    inFlight = request;
    return request;
  };

  const controller: SubmissionController<TResponse, TMeta> = {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    submit,
    retry: () => {
      if (!state.canRetry || previous === null) return Promise.resolve({ status: "cancelled" });
      return submit(previous.answers, previous.context);
    },
    reset: () => {
      if (inFlight !== null) return;
      previous = null;
      publish({ status: "idle", error: null, attemptCount: 0, canRetry: false });
    }
  };
  return controller;
}

export function useSubmissionController<TResponse, TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata>(
  controller: SubmissionController<TResponse, TMeta>
): SubmissionControllerState<TResponse> & Pick<SubmissionController<TResponse, TMeta>, "submit" | "retry" | "reset"> {
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  return { ...state, submit: controller.submit, retry: controller.retry, reset: controller.reset };
}
