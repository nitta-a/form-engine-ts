import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DomainSurveyVersionOperationRequest,
  DomainSurveyVersionPublishRequest,
  DomainSurveyVersionQualityIssueDecisionRequest,
  QualityCheckResult,
  QualityIssue,
  QualityIssueDecision,
  SurveyVersionActionAdapter,
  SurveyVersionActionEvent,
  SurveyVersionActionResult,
  SurveyVersionAdapterResponse,
  SurveyVersionDomainActionAdapter,
  SurveyVersionDomainActionsResult,
  SurveyVersionDomainOperationsResult,
  SurveyVersionOperationName,
  SurveyVersionOperationState,
  SurveyVersionQualityResult,
  SurveyVersionQualityState,
  UseSurveyVersionDomainActionsOptions,
  UseSurveyVersionDomainQualityActionsOptions,
  UseSurveyVersionOperationsOptions,
  UseSurveyVersionOperationsResult
} from "./types";

function normalizeError(cause: unknown): Error {
  if (cause instanceof Error) return cause;
  if (typeof cause === "object" && cause !== null && "message" in cause && typeof cause.message === "string") {
    return new Error(cause.message);
  }
  return new Error(String(cause));
}

function actionResult<TData = void>(
  succeeded: boolean,
  error?: Error,
  options: { readonly requiresConfirmation?: boolean; readonly cause?: unknown } = {}
): SurveyVersionActionResult<TData> {
  return {
    succeeded,
    ...(error === undefined ? {} : { error }),
    ...(options.cause === undefined ? {} : { cause: options.cause }),
    ...(options.requiresConfirmation === true ? { requiresConfirmation: true } : {})
  };
}

function completedActionResult(result: Awaited<SurveyVersionAdapterResponse>): SurveyVersionActionResult {
  return result === undefined ? actionResult(true) : result;
}

function failedActionResult(cause: unknown): SurveyVersionActionResult {
  const error = normalizeError(cause);
  return actionResult(false, error, cause instanceof Error ? {} : { cause });
}

function toDomainQualityResult<TQualityPayload>(
  result: QualityCheckResult<TQualityPayload>
): SurveyVersionQualityResult<TQualityPayload> {
  const status = result.status;
  let normalizedStatus: SurveyVersionQualityResult<TQualityPayload>["status"];
  if (status === "STALE") normalizedStatus = "STALE";
  else if (status === "RUNNING" || status === "running") normalizedStatus = "RUNNING";
  else if (status === "FAILED" || status === "failed" || status === "error") normalizedStatus = "FAILED";
  else normalizedStatus = "COMPLETED";
  return {
    status: normalizedStatus,
    issues: result.issues,
    ...(result.runId === undefined ? {} : { runId: result.runId }),
    ...(typeof result.checkedRevision === "number" ? { checkedRevision: result.checkedRevision } : {}),
    ...(result.payload === undefined
      ? result.response === undefined
        ? result.rawResponse === undefined
          ? {}
          : { payload: result.rawResponse }
        : { payload: result.response }
      : { payload: result.payload })
  };
}

function toDomainQualityAction<TQualityPayload>(
  action: SurveyVersionActionResult<QualityCheckResult<TQualityPayload>>
): SurveyVersionActionResult<SurveyVersionQualityResult<TQualityPayload>> {
  return {
    succeeded: action.succeeded,
    ...(action.data === undefined ? {} : { data: toDomainQualityResult(action.data) }),
    ...(action.error === undefined ? {} : { error: action.error }),
    ...(action.requiresConfirmation === undefined ? {} : { requiresConfirmation: action.requiresConfirmation }),
    ...(action.cause === undefined ? {} : { cause: action.cause }),
    ...(action.response === undefined ? {} : { response: action.response }),
    ...(action.metadata === undefined ? {} : { metadata: action.metadata })
  };
}

async function notifyAction(
  adapter: Pick<SurveyVersionDomainActionAdapter<unknown>, "invalidate" | "notify">,
  operation: SurveyVersionActionEvent["operation"],
  result: SurveyVersionActionResult
): Promise<void> {
  await adapter.invalidate?.();
  adapter.notify?.({ operation, result });
}

function operationStates(): Record<SurveyVersionOperationName, SurveyVersionOperationState> {
  return {
    runQualityCheck: { status: "idle" },
    publish: { status: "idle" },
    decideQualityIssue: { status: "idle" },
    cloneDraft: { status: "idle" },
    deleteDraft: { status: "idle" },
    setVisibility: { status: "idle" },
    qualityCheck: { status: "idle" },
    duplicate: { status: "idle" },
    delete: { status: "idle" },
    setStatus: { status: "idle" }
  };
}

function setOperation(
  current: Readonly<Record<SurveyVersionOperationName, SurveyVersionOperationState>>,
  names: readonly SurveyVersionOperationName[],
  state: SurveyVersionOperationState
): Readonly<Record<SurveyVersionOperationName, SurveyVersionOperationState>> {
  const next = { ...current };
  for (const name of names) next[name] = state;
  return next;
}

function issueKey(issue: QualityIssue): string {
  return `${issue.code}:${issue.path ?? ""}`;
}

function actionRequest<TVersion, TState>(
  version: TVersion,
  versionState: TState | undefined,
  signal: AbortSignal
): DomainSurveyVersionOperationRequest<TVersion, TState> {
  return {
    version,
    ...(versionState === undefined ? {} : { state: versionState }),
    signal
  };
}

/** Combines independently implemented version action adapters into one optional adapter. */
export function composeSurveyVersionActions<TVersion, TState>(
  ...adapters: readonly SurveyVersionActionAdapter<TVersion, TState>[]
): SurveyVersionActionAdapter<TVersion, TState> {
  const result: SurveyVersionActionAdapter<TVersion, TState> = {};
  for (let index = adapters.length - 1; index >= 0; index -= 1) {
    const adapter = adapters[index];
    if (adapter !== undefined) Object.assign(result, adapter);
  }
  return result;
}

export function composeSurveyVersionDomainActions<TVersion, TState, TQualityPayload = unknown>(
  ...adapters: readonly SurveyVersionDomainActionAdapter<TVersion, TState, TQualityPayload>[]
): SurveyVersionDomainActionAdapter<TVersion, TState, TQualityPayload> {
  const result: SurveyVersionDomainActionAdapter<TVersion, TState, TQualityPayload> = {};
  for (let index = adapters.length - 1; index >= 0; index -= 1) {
    const adapter = adapters[index];
    if (adapter !== undefined) Object.assign(result, adapter);
  }
  return result;
}

/** Manages quality checks and version lifecycle actions without choosing a transport or cache library. */
function useSurveyVersionOperationsInternal<TVersion, TState, TQualityPayload>({
  version,
  state: versionState,
  adapter
}: UseSurveyVersionDomainQualityActionsOptions<
  TVersion,
  TState,
  TQualityPayload
>): SurveyVersionDomainOperationsResult<TQualityPayload> {
  const [operations, setOperations] = useState(operationStates);
  const [quality, setQuality] = useState<SurveyVersionQualityState<TQualityPayload>>({
    status: "idle",
    issues: []
  });
  const [qualityDecisions, setQualityDecisions] = useState<Readonly<Record<string, QualityIssueDecision>>>({});
  const qualityDecisionsRef = useRef<Readonly<Record<string, QualityIssueDecision>>>({});
  const qualityRef = useRef<QualityCheckResult<TQualityPayload> | undefined>(undefined);
  const qualityErrorRef = useRef<Error | undefined>(undefined);
  const previousVersion = useRef<{
    readonly version: TVersion;
    readonly state?: TState;
  }>({
    version,
    ...(versionState === undefined ? {} : { state: versionState })
  });

  useEffect(() => {
    if (previousVersion.current.version === version && previousVersion.current.state === versionState) return;
    previousVersion.current = {
      version,
      ...(versionState === undefined ? {} : { state: versionState })
    };
    qualityRef.current = undefined;
    qualityErrorRef.current = undefined;
    setQuality({ status: "idle", issues: [] });
    qualityDecisionsRef.current = {};
    setQualityDecisions({});
    setOperations(operationStates());
  }, [version, versionState]);

  const request = useCallback(
    (signal: AbortSignal): DomainSurveyVersionOperationRequest<TVersion, TState> =>
      actionRequest(version, versionState, signal),
    [version, versionState]
  );

  const runQualityCheck = useCallback(async (): Promise<QualityCheckResult<TQualityPayload> | undefined> => {
    const qualityCheck = adapter.runQualityCheck ?? adapter.qualityCheck;
    const controller = new AbortController();
    setQuality((current) => ({
      ...current,
      status: "loading",
      checkStatus: "running",
      issues: current.issues ?? []
    }));
    setOperations((current) => setOperation(current, ["runQualityCheck", "qualityCheck"], { status: "loading" }));
    try {
      if (qualityCheck === undefined) throw new TypeError("SurveyVersionActionsAdapter requires runQualityCheck.");
      const result = await qualityCheck(request(controller.signal));
      qualityRef.current = result;
      qualityErrorRef.current = undefined;
      setQuality({
        status: "success",
        result,
        issues: result.issues,
        checkStatus: result.status ?? (result.issues.length === 0 ? "passed" : "failed"),
        ...(result.runId === undefined ? {} : { runId: result.runId }),
        ...(result.checkedRevision === undefined ? {} : { checkedRevision: result.checkedRevision })
      });
      setOperations((current) => setOperation(current, ["runQualityCheck", "qualityCheck"], { status: "success" }));
      return result;
    } catch (cause) {
      const error = normalizeError(cause);
      qualityErrorRef.current = error;
      setQuality((current) => ({
        ...current,
        status: "error",
        checkStatus: "error",
        issues: current.issues ?? [],
        error,
        cause
      }));
      setOperations((current) =>
        setOperation(current, ["runQualityCheck", "qualityCheck"], { status: "error", error })
      );
      return undefined;
    }
  }, [adapter, request]);

  const publishActionResult = useCallback(
    async (options: { readonly allowWarnings?: boolean } = {}): Promise<SurveyVersionActionResult> => {
      const allowWarnings = options.allowWarnings ?? false;
      const qualityCheck = adapter.runQualityCheck ?? adapter.qualityCheck;
      const qualityResult = qualityCheck === undefined ? undefined : (qualityRef.current ?? (await runQualityCheck()));
      if (qualityCheck !== undefined && qualityResult === undefined) {
        const result = actionResult(false, qualityErrorRef.current);
        setOperations((current) =>
          setOperation(current, ["publish"], {
            status: "error",
            result,
            ...(result.error === undefined ? {} : { error: result.error })
          })
        );
        return result;
      }
      const unresolvedIssues = (qualityResult?.issues ?? []).filter(
        (issue) => qualityDecisionsRef.current[issueKey(issue)] !== "accept"
      );
      if (!allowWarnings && unresolvedIssues.length > 0) {
        const result = actionResult(false, undefined, { requiresConfirmation: true });
        setOperations((current) => setOperation(current, ["publish"], { status: "needs_confirmation", result }));
        return result;
      }
      const publishAction = adapter.publishResult ?? adapter.publish;
      const controller = new AbortController();
      setOperations((current) => setOperation(current, ["publish"], { status: "loading" }));
      try {
        if (publishAction === undefined) throw new TypeError("SurveyVersionActionsAdapter requires publish.");
        const publishRequest: DomainSurveyVersionPublishRequest<TVersion, TState> = {
          ...request(controller.signal),
          allowWarnings
        };
        const result = completedActionResult(await publishAction(publishRequest));
        setOperations((current) =>
          setOperation(current, ["publish"], {
            status: result.succeeded ? "success" : "error",
            result,
            ...(result.error === undefined ? {} : { error: result.error })
          })
        );
        if (result.succeeded) await notifyAction(adapter, "publish", result);
        return result;
      } catch (cause) {
        const error = normalizeError(cause);
        const result = failedActionResult(cause);
        setOperations((current) => setOperation(current, ["publish"], { status: "error", error, result }));
        return result;
      }
    },
    [adapter, request, runQualityCheck]
  );

  const publish = useCallback(
    async (options: { readonly allowWarnings?: boolean } = {}): Promise<boolean> =>
      (await publishActionResult(options)).succeeded,
    [publishActionResult]
  );

  const publishResult = useCallback(
    async (options: { readonly allowWarnings?: boolean } = {}): Promise<SurveyVersionActionResult> => {
      return publishActionResult(options);
    },
    [publishActionResult]
  );

  const decideQualityIssueResult = useCallback(
    async (issue: QualityIssue, decision: QualityIssueDecision): Promise<SurveyVersionActionResult> => {
      const decide = adapter.decideQualityIssueResult ?? adapter.decideQualityIssue;
      const controller = new AbortController();
      setOperations((current) => setOperation(current, ["decideQualityIssue"], { status: "loading" }));
      try {
        if (decide === undefined) throw new TypeError("SurveyVersionActionsAdapter requires decideQualityIssue.");
        const decisionRequest: DomainSurveyVersionQualityIssueDecisionRequest<TVersion, TState> = {
          ...request(controller.signal),
          issue,
          decision
        };
        const result = completedActionResult(await decide(decisionRequest));
        if (!result.succeeded) {
          setOperations((current) =>
            setOperation(current, ["decideQualityIssue"], {
              status: "error",
              result,
              ...(result.error === undefined ? {} : { error: result.error })
            })
          );
          return result;
        }
        const key = issueKey(issue);
        qualityDecisionsRef.current = { ...qualityDecisionsRef.current, [key]: decision };
        setQualityDecisions((current) => ({ ...current, [key]: decision }));
        setOperations((current) => setOperation(current, ["decideQualityIssue"], { status: "success", result }));
        await notifyAction(adapter, "decideQualityIssue", result);
        return result;
      } catch (cause) {
        const error = normalizeError(cause);
        const result = failedActionResult(cause);
        setOperations((current) => setOperation(current, ["decideQualityIssue"], { status: "error", error, result }));
        return result;
      }
    },
    [adapter, request]
  );

  const decideQualityIssue = useCallback(
    async (issue: QualityIssue, decision: QualityIssueDecision): Promise<boolean> =>
      (await decideQualityIssueResult(issue, decision)).succeeded,
    [decideQualityIssueResult]
  );

  const runSimpleOperation = useCallback(
    async (
      names: readonly SurveyVersionOperationName[],
      operation:
        | ((request: DomainSurveyVersionOperationRequest<TVersion, TState>) => Promise<void>)
        | ((request: DomainSurveyVersionOperationRequest<TVersion, TState>) => SurveyVersionAdapterResponse)
        | undefined,
      requiredName: string
    ): Promise<SurveyVersionActionResult> => {
      const controller = new AbortController();
      setOperations((current) => setOperation(current, names, { status: "loading" }));
      try {
        if (operation === undefined) throw new TypeError(`SurveyVersionActionsAdapter requires ${requiredName}.`);
        const result = completedActionResult(await operation(request(controller.signal)));
        setOperations((current) =>
          setOperation(current, names, {
            status: result.succeeded ? "success" : "error",
            result,
            ...(result.error === undefined ? {} : { error: result.error })
          })
        );
        if (result.succeeded) await notifyAction(adapter, names[0] ?? "cloneDraft", result);
        return result;
      } catch (cause) {
        const error = normalizeError(cause);
        const result = failedActionResult(cause);
        setOperations((current) => setOperation(current, names, { status: "error", error, result }));
        return result;
      }
    },
    [request, adapter]
  );

  const cloneDraftResult = useCallback(
    () =>
      runSimpleOperation(
        ["cloneDraft", "duplicate"],
        adapter.cloneDraftResult ?? adapter.cloneDraft ?? adapter.duplicateResult ?? adapter.duplicate,
        "cloneDraft"
      ),
    [adapter.cloneDraft, adapter.cloneDraftResult, adapter.duplicate, adapter.duplicateResult, runSimpleOperation]
  );
  const cloneDraft = useCallback(
    async (): Promise<boolean> => (await cloneDraftResult()).succeeded,
    [cloneDraftResult]
  );
  const deleteDraftResult = useCallback(
    () =>
      runSimpleOperation(
        ["deleteDraft", "delete"],
        adapter.deleteDraftResult ?? adapter.deleteDraft ?? adapter.deleteResult ?? adapter.delete,
        "deleteDraft"
      ),
    [adapter.delete, adapter.deleteDraft, adapter.deleteDraftResult, adapter.deleteResult, runSimpleOperation]
  );
  const deleteDraft = useCallback(
    async (): Promise<boolean> => (await deleteDraftResult()).succeeded,
    [deleteDraftResult]
  );
  const setVisibilityResult = useCallback(
    async (status: "draft" | "published" | "archived"): Promise<SurveyVersionActionResult> => {
      const setVisibilityAction =
        adapter.setVisibilityResult ?? adapter.setVisibility ?? adapter.setStatusResult ?? adapter.setStatus;
      const controller = new AbortController();
      setOperations((current) => setOperation(current, ["setVisibility", "setStatus"], { status: "loading" }));
      try {
        if (setVisibilityAction === undefined)
          throw new TypeError("SurveyVersionActionsAdapter requires setVisibility.");
        const result = completedActionResult(await setVisibilityAction({ ...request(controller.signal), status }));
        setOperations((current) =>
          setOperation(current, ["setVisibility", "setStatus"], {
            status: result.succeeded ? "success" : "error",
            result,
            ...(result.error === undefined ? {} : { error: result.error })
          })
        );
        if (result.succeeded) await notifyAction(adapter, "setVisibility", result);
        return result;
      } catch (cause) {
        const error = normalizeError(cause);
        const result = failedActionResult(cause);
        setOperations((current) =>
          setOperation(current, ["setVisibility", "setStatus"], { status: "error", error, result })
        );
        return result;
      }
    },
    [adapter.setStatus, adapter.setStatusResult, adapter.setVisibility, adapter.setVisibilityResult, request, adapter]
  );

  const setVisibility = useCallback(
    async (status: "draft" | "published" | "archived"): Promise<boolean> =>
      (await setVisibilityResult(status)).succeeded,
    [setVisibilityResult]
  );

  return {
    quality,
    qualityDecisions,
    operations,
    runQualityCheck,
    decideQualityIssue,
    decideQualityIssueResult,
    publish,
    publishResult,
    runQualityCheckResult: async () => {
      const result = await runQualityCheck();
      return result === undefined
        ? actionResult<QualityCheckResult<TQualityPayload>>(false, qualityErrorRef.current)
        : { succeeded: true, data: result };
    },
    cloneDraft,
    cloneDraftResult,
    deleteDraft,
    deleteDraftResult,
    setVisibility,
    setVisibilityResult,
    duplicate: cloneDraft,
    delete: deleteDraft,
    setStatus: setVisibility
  };
}

/** Backward-compatible controller for Form Engine schemas and version records. */
export function useSurveyVersionOperations(
  options: UseSurveyVersionOperationsOptions
): UseSurveyVersionOperationsResult {
  return useSurveyVersionOperationsInternal(options);
}

/** Generic controller for application-owned version records and state. */
export function useSurveyVersionDomainActions<TVersion, TState = unknown, TQualityPayload = unknown>(
  options: UseSurveyVersionDomainQualityActionsOptions<TVersion, TState, TQualityPayload>
): SurveyVersionDomainActionsResult<TQualityPayload>;
export function useSurveyVersionDomainActions<TVersion, TState = unknown>(
  options: UseSurveyVersionDomainActionsOptions<TVersion, TState>
): UseSurveyVersionOperationsResult;
export function useSurveyVersionDomainActions<TVersion, TState = unknown, TQualityPayload = unknown>(
  options: UseSurveyVersionDomainQualityActionsOptions<TVersion, TState, TQualityPayload>
): SurveyVersionDomainActionsResult<TQualityPayload> {
  const internal = useSurveyVersionOperationsInternal(options);
  const result = internal.quality.result === undefined ? undefined : toDomainQualityResult(internal.quality.result);
  return {
    ...internal,
    quality: {
      status: internal.quality.status,
      ...(result === undefined ? {} : { result }),
      ...(internal.quality.error === undefined ? {} : { error: internal.quality.error })
    },
    runQualityCheckResult: async () => {
      const action = await internal.runQualityCheckResult();
      return toDomainQualityAction(action);
    }
  };
}

/** Preferred action-oriented name for the version controller. */
export const useSurveyVersionActions = useSurveyVersionOperations;

/** Explicit controller alias for applications that standardize on controller naming. */
export const useSurveyVersionActionsController = useSurveyVersionOperations;
