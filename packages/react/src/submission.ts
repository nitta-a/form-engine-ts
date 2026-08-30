import type {
  BaseSubmissionMetadata,
  FormSchema,
  FormValues,
  JsonValue,
  StrictFormSubmission
} from "@form-engine-ts/core";
import { createSubmission } from "@form-engine-ts/core";
import { useMemo, useSyncExternalStore } from "react";
import { createLocalStorageSubmissionAttemptStore, type SubmissionAttemptStore } from "./attempt";
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

export interface SubmissionControllerScope {
  readonly formId: string;
  readonly formVersion: number;
  readonly deckId?: string;
  readonly sessionId?: string;
  readonly userId?: string;
  readonly tenantId?: string;
}

export interface CreateSubmissionControllerOptions<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata> {
  readonly schema: FormSchema;
  readonly scope: SubmissionControllerScope;
  readonly idFormat?: "uuid" | "ulid" | "custom";
  /** Shared scope-aware attempt store used by the Controller and FormRenderer. */
  readonly attemptStore?: SubmissionAttemptStore;
  readonly attemptIdFactory?: () => string;
  readonly metadata?: TMeta;
  readonly onSubmit: (submission: StrictFormSubmission<TMeta>) => Promise<{ readonly receiptId?: string }>;
}

export interface ScopedSubmissionControllerState<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata>
  extends SubmissionControllerState {
  readonly isSubmitted: boolean;
  readonly attemptId?: string;
  readonly receiptId?: string;
  readonly submission?: StrictFormSubmission<TMeta>;
  readonly scope: SubmissionControllerScope;
  readonly retry?: () => Promise<SubmissionControllerResult<{ readonly receiptId?: string }>>;
}

export interface ScopedSubmissionController<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata> {
  readonly getState: () => ScopedSubmissionControllerState<TMeta>;
  readonly subscribe: (listener: () => void) => () => void;
  readonly submit: (
    values: Readonly<Record<string, unknown>>,
    locale?: string
  ) => Promise<SubmissionControllerResult<{ readonly receiptId?: string }>>;
  readonly retry?: () => Promise<SubmissionControllerResult<{ readonly receiptId?: string }>>;
  readonly reset: () => void;
}

function normalizeError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

function randomUuid(): string {
  const generated = globalThis.crypto?.randomUUID?.();
  if (generated !== undefined) return generated;
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const getRandomValues = globalThis.crypto?.getRandomValues;
  if (typeof getRandomValues === "function") {
    getRandomValues.call(globalThis.crypto, bytes);
    return bytes;
  }
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  return bytes;
}

function createUlid(): string {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let timestamp = Date.now();
  let timePart = "";
  for (let index = 0; index < 10; index += 1) {
    timePart = alphabet[timestamp % 32] + timePart;
    timestamp = Math.floor(timestamp / 32);
  }
  return `${timePart}${Array.from(randomBytes(16), (value) => alphabet[value % 32]).join("")}`;
}

function createScopedSubmissionId<TMeta extends BaseSubmissionMetadata>(
  options: CreateSubmissionControllerOptions<TMeta>
): string {
  if (options.attemptIdFactory !== undefined) return options.attemptIdFactory();
  if (options.idFormat === "custom") throw new TypeError("attemptIdFactory is required when idFormat is custom.");
  return options.idFormat === "ulid" ? createUlid() : randomUuid();
}

export function createScopedSubmissionController<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata>(
  options: CreateSubmissionControllerOptions<TMeta>
): ScopedSubmissionController<TMeta> {
  if (options.scope.formId !== options.schema.id || options.scope.formVersion !== options.schema.version) {
    throw new TypeError("Submission controller scope must match the schema.");
  }
  const listeners = new Set<() => void>();
  const scope = { ...options.scope };
  let state: ScopedSubmissionControllerState<TMeta> = {
    status: "idle",
    error: null,
    attemptCount: 0,
    canRetry: false,
    isSubmitted: false,
    scope
  };
  let inFlight: Promise<SubmissionControllerResult<{ readonly receiptId?: string }>> | null = null;
  let lastSubmissionId: string | undefined;
  const attemptStore =
    options.attemptStore ??
    createLocalStorageSubmissionAttemptStore({
      ...(options.idFormat === undefined ? {} : { idFormat: options.idFormat })
    });

  const publish = (next: ScopedSubmissionControllerState<TMeta>): void => {
    state = next;
    for (const listener of listeners) listener();
  };
  const submit = async (
    values: Readonly<Record<string, unknown>>,
    locale = options.schema.defaultLocale ?? options.schema.supportedLocales?.[0] ?? "und"
  ): Promise<SubmissionControllerResult<{ readonly receiptId?: string }>> => {
    if (inFlight !== null || state.status === "success") return { status: "cancelled" };
    const attempt =
      lastSubmissionId === undefined
        ? attemptStore.getOrCreateForScope === undefined
          ? await attemptStore.getOrCreate(options.scope.formId, options.scope.formVersion, options.attemptIdFactory)
          : await attemptStore.getOrCreateForScope(options.scope, options.idFormat, options.attemptIdFactory)
        : undefined;
    const attemptId = lastSubmissionId ?? attempt?.attemptId ?? createScopedSubmissionId<TMeta>(options);
    lastSubmissionId = attemptId;
    const metadata = options.metadata ?? ({} as TMeta);
    let submission: StrictFormSubmission<TMeta>;
    try {
      submission = createSubmission(options.schema, values as FormValues, {
        id: attemptId,
        locale,
        submittedAt: new Date().toISOString(),
        metadata: metadata as TMeta & Readonly<Record<string, JsonValue>>
      }) as unknown as StrictFormSubmission<TMeta>;
    } catch (cause) {
      const error = normalizeError(cause);
      publish({ ...state, status: "error", error, attemptId, canRetry: false });
      return { status: "error", error };
    }
    publish({
      ...state,
      status: "submitting",
      error: null,
      attemptId,
      submission,
      canRetry: false,
      attemptCount: state.attemptCount + 1
    });
    const request = Promise.resolve()
      .then(() => options.onSubmit(submission))
      .then(async (response) => {
        const result = { status: "success", response } as const;
        publish({
          ...state,
          status: "success",
          error: null,
          ...(response.receiptId === undefined ? {} : { receiptId: response.receiptId }),
          canRetry: false,
          isSubmitted: true
        });
        if (response.receiptId !== undefined) await attemptStore.setReceiptForScope?.(scope, response.receiptId);
        return result;
      })
      .catch((cause: unknown) => {
        const error = normalizeError(cause);
        publish({ ...state, status: "error", error, canRetry: true });
        return { status: "error", error } as const;
      })
      .finally(() => {
        inFlight = null;
      });
    inFlight = request;
    return request;
  };
  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    submit,
    retry: () => {
      if (!state.canRetry || state.submission === undefined) return Promise.resolve({ status: "cancelled" });
      return submit(state.submission.values);
    },
    reset: () => {
      if (inFlight !== null) return;
      void attemptStore.clearForScope?.(scope);
      lastSubmissionId = undefined;
      publish({ status: "idle", error: null, attemptCount: 0, canRetry: false, isSubmitted: false, scope });
    }
  };
}

function isCreateSubmissionControllerOptions<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata>(
  value: unknown
): value is CreateSubmissionControllerOptions<TMeta> {
  return (
    typeof value === "object" &&
    value !== null &&
    "schema" in value &&
    "scope" in value &&
    "onSubmit" in value &&
    typeof value.onSubmit === "function"
  );
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
): SubmissionControllerState<TResponse> & Pick<SubmissionController<TResponse, TMeta>, "submit" | "retry" | "reset">;
export function useSubmissionController<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata>(
  options: CreateSubmissionControllerOptions<TMeta>
): ScopedSubmissionControllerState<TMeta> & Pick<ScopedSubmissionController<TMeta>, "submit" | "reset">;
export function useSubmissionController<TResponse, TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata>(
  controllerOrOptions: SubmissionController<TResponse, TMeta> | CreateSubmissionControllerOptions<TMeta>
):
  | (SubmissionControllerState<TResponse> & Pick<SubmissionController<TResponse, TMeta>, "submit" | "retry" | "reset">)
  | (ScopedSubmissionControllerState<TMeta> & Pick<ScopedSubmissionController<TMeta>, "submit" | "reset">) {
  const scopedOptions = isCreateSubmissionControllerOptions<TMeta>(controllerOrOptions) ? controllerOrOptions : null;
  const scopedSchema = scopedOptions?.schema;
  const scopedFormId = scopedOptions?.scope.formId;
  const scopedFormVersion = scopedOptions?.scope.formVersion;
  const scopedDeckId = scopedOptions?.scope.deckId;
  const scopedSessionId = scopedOptions?.scope.sessionId;
  const scopedUserId = scopedOptions?.scope.userId;
  const scopedTenantId = scopedOptions?.scope.tenantId;
  const scopedIdFormat = scopedOptions?.idFormat;
  const scopedAttemptIdFactory = scopedOptions?.attemptIdFactory;
  const scopedAttemptStore = scopedOptions?.attemptStore;
  const scopedMetadata = scopedOptions?.metadata;
  const scopedOnSubmit = scopedOptions?.onSubmit;
  const scopedController = useMemo(() => {
    if (
      scopedSchema === undefined ||
      scopedFormId === undefined ||
      scopedFormVersion === undefined ||
      scopedOnSubmit === undefined
    ) {
      return null;
    }
    return createScopedSubmissionController<TMeta>({
      schema: scopedSchema,
      scope: {
        formId: scopedFormId,
        formVersion: scopedFormVersion,
        ...(scopedDeckId === undefined ? {} : { deckId: scopedDeckId }),
        ...(scopedSessionId === undefined ? {} : { sessionId: scopedSessionId }),
        ...(scopedUserId === undefined ? {} : { userId: scopedUserId }),
        ...(scopedTenantId === undefined ? {} : { tenantId: scopedTenantId })
      },
      ...(scopedIdFormat === undefined ? {} : { idFormat: scopedIdFormat }),
      ...(scopedAttemptIdFactory === undefined ? {} : { attemptIdFactory: scopedAttemptIdFactory }),
      ...(scopedAttemptStore === undefined ? {} : { attemptStore: scopedAttemptStore }),
      ...(scopedMetadata === undefined ? {} : { metadata: scopedMetadata }),
      onSubmit: scopedOnSubmit
    });
  }, [
    scopedSchema,
    scopedFormId,
    scopedFormVersion,
    scopedDeckId,
    scopedSessionId,
    scopedUserId,
    scopedTenantId,
    scopedIdFormat,
    scopedAttemptIdFactory,
    scopedAttemptStore,
    scopedMetadata,
    scopedOnSubmit
  ]);
  const controller: SubmissionController<TResponse, TMeta> | ScopedSubmissionController<TMeta> =
    scopedController ?? (controllerOrOptions as SubmissionController<TResponse, TMeta>);
  const subscribe = controller.subscribe as (listener: () => void) => () => void;
  const getState = controller.getState as () =>
    | SubmissionControllerState<TResponse>
    | ScopedSubmissionControllerState<TMeta>;
  const state = useSyncExternalStore(subscribe, getState, getState);
  if (scopedController !== null) {
    return {
      ...(state as ScopedSubmissionControllerState<TMeta>),
      submit: scopedController.submit,
      retry: scopedController.retry,
      reset: scopedController.reset
    } as ScopedSubmissionControllerState<TMeta> & Pick<ScopedSubmissionController<TMeta>, "submit" | "reset">;
  }
  const legacyController = controllerOrOptions as SubmissionController<TResponse, TMeta>;
  return {
    ...(state as SubmissionControllerState<TResponse>),
    submit: legacyController.submit,
    retry: legacyController.retry,
    reset: legacyController.reset
  } as SubmissionControllerState<TResponse> &
    Pick<SubmissionController<TResponse, TMeta>, "submit" | "retry" | "reset">;
}
