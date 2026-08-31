import type { ReactNode } from "react";

/** Common status values shared by all custom survey controllers. */
export type SurveyControllerStatus = "idle" | "loading" | "success" | "error";

/** A transport-neutral result that keeps the original failure available to the host app. */
export interface SurveyActionResult<TData = void> {
  readonly succeeded: boolean;
  readonly data?: TData;
  readonly error?: Error;
  readonly cause?: unknown;
  readonly response?: unknown;
}

/** Reusable slot contract for UI surfaces that can be replaced by a host application. */
export type SurveySlot<TProps> = (props: TProps) => ReactNode;

/** Generic state shape for an async adapter operation. */
export interface SurveyAsyncState<TData = unknown> {
  readonly status: SurveyControllerStatus;
  readonly data?: TData;
  readonly error?: Error;
  readonly cause?: unknown;
}

/** A controlled value paired with the callback used to update it. */
export interface SurveyControlledValue<TValue> {
  readonly value: TValue;
  readonly onChange: (value: TValue) => void;
}
