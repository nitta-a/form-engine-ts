import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DomainSurveyVersionOperationRequest,
  DomainSurveyVersionPublishRequest,
  DomainSurveyVersionQualityIssueDecisionRequest,
  QualityCheckResult,
  QualityIssue,
  QualityIssueDecision,
  SurveyVersionActionAdapter,
  SurveyVersionActionResult,
  SurveyVersionOperationName,
  SurveyVersionOperationState,
  SurveyVersionQualityState,
  UseSurveyVersionDomainActionsOptions,
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
  options: { readonly requiresConfirmation?: boolean } = {}
): SurveyVersionActionResult<TData> {
  return {
    succeeded,
    ...(error === undefined ? {} : { error }),
    ...(options.requiresConfirmation === true ? { requiresConfirmation: true } : {})
  };
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

/** Manages quality checks and version lifecycle actions without choosing a transport or cache library. */
function useSurveyVersionOperationsInternal<TVersion, TState>({
  version,
  state: versionState,
  adapter
}: UseSurveyVersionDomainActionsOptions<TVersion, TState>): UseSurveyVersionOperationsResult {
  const [operations, setOperations] = useState(operationStates);
  const [quality, setQuality] = useState<SurveyVersionQualityState>({
    status: "idle"
  });
  const [qualityDecisions, setQualityDecisions] = useState<Readonly<Record<string, QualityIssueDecision>>>({});
  const qualityDecisionsRef = useRef<Readonly<Record<string, QualityIssueDecision>>>({});
  const qualityRef = useRef<QualityCheckResult | undefined>(undefined);
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
    setQuality({ status: "idle" });
    qualityDecisionsRef.current = {};
    setQualityDecisions({});
    setOperations(operationStates());
  }, [version, versionState]);

  const request = useCallback(
    (signal: AbortSignal): DomainSurveyVersionOperationRequest<TVersion, TState> =>
      actionRequest(version, versionState, signal),
    [version, versionState]
  );

  const runQualityCheck = useCallback(async (): Promise<QualityCheckResult | undefined> => {
    const qualityCheck = adapter.runQualityCheck ?? adapter.qualityCheck;
    const controller = new AbortController();
    setQuality({ status: "loading" });
    setOperations((current) => setOperation(current, ["runQualityCheck", "qualityCheck"], { status: "loading" }));
    try {
      if (qualityCheck === undefined) throw new TypeError("SurveyVersionActionsAdapter requires runQualityCheck.");
      const result = await qualityCheck(request(controller.signal));
      qualityRef.current = result;
      qualityErrorRef.current = undefined;
      setQuality({ status: "success", result });
      setOperations((current) => setOperation(current, ["runQualityCheck", "qualityCheck"], { status: "success" }));
      return result;
    } catch (cause) {
      const error = normalizeError(cause);
      qualityErrorRef.current = error;
      setQuality({ status: "error", error });
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
      const publishAction = adapter.publish;
      const controller = new AbortController();
      setOperations((current) => setOperation(current, ["publish"], { status: "loading" }));
      try {
        if (publishAction === undefined) throw new TypeError("SurveyVersionActionsAdapter requires publish.");
        const publishRequest: DomainSurveyVersionPublishRequest<TVersion, TState> = {
          ...request(controller.signal),
          allowWarnings
        };
        await publishAction(publishRequest);
        const result = actionResult(true);
        setOperations((current) => setOperation(current, ["publish"], { status: "success", result }));
        return result;
      } catch (cause) {
        const error = normalizeError(cause);
        const result = actionResult(false, error);
        setOperations((current) => setOperation(current, ["publish"], { status: "error", error, result }));
        return result;
      }
    },
    [adapter.publish, adapter.qualityCheck, adapter.runQualityCheck, request, runQualityCheck]
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
      const decide = adapter.decideQualityIssue;
      const controller = new AbortController();
      setOperations((current) => setOperation(current, ["decideQualityIssue"], { status: "loading" }));
      try {
        if (decide === undefined) throw new TypeError("SurveyVersionActionsAdapter requires decideQualityIssue.");
        const decisionRequest: DomainSurveyVersionQualityIssueDecisionRequest<TVersion, TState> = {
          ...request(controller.signal),
          issue,
          decision
        };
        await decide(decisionRequest);
        const key = issueKey(issue);
        qualityDecisionsRef.current = { ...qualityDecisionsRef.current, [key]: decision };
        setQualityDecisions((current) => ({ ...current, [key]: decision }));
        const result = actionResult(true);
        setOperations((current) => setOperation(current, ["decideQualityIssue"], { status: "success", result }));
        return result;
      } catch (cause) {
        const error = normalizeError(cause);
        const result = actionResult(false, error);
        setOperations((current) => setOperation(current, ["decideQualityIssue"], { status: "error", error, result }));
        return result;
      }
    },
    [adapter.decideQualityIssue, request]
  );

  const decideQualityIssue = useCallback(
    async (issue: QualityIssue, decision: QualityIssueDecision): Promise<boolean> =>
      (await decideQualityIssueResult(issue, decision)).succeeded,
    [decideQualityIssueResult]
  );

  const runSimpleOperation = useCallback(
    async (
      names: readonly SurveyVersionOperationName[],
      operation: ((request: DomainSurveyVersionOperationRequest<TVersion, TState>) => Promise<void>) | undefined,
      requiredName: string
    ): Promise<SurveyVersionActionResult> => {
      const controller = new AbortController();
      setOperations((current) => setOperation(current, names, { status: "loading" }));
      try {
        if (operation === undefined) throw new TypeError(`SurveyVersionActionsAdapter requires ${requiredName}.`);
        await operation(request(controller.signal));
        const result = actionResult(true);
        setOperations((current) => setOperation(current, names, { status: "success", result }));
        return result;
      } catch (cause) {
        const error = normalizeError(cause);
        const result = actionResult(false, error);
        setOperations((current) => setOperation(current, names, { status: "error", error, result }));
        return result;
      }
    },
    [request]
  );

  const cloneDraftResult = useCallback(
    () => runSimpleOperation(["cloneDraft", "duplicate"], adapter.cloneDraft ?? adapter.duplicate, "cloneDraft"),
    [adapter.cloneDraft, adapter.duplicate, runSimpleOperation]
  );
  const cloneDraft = useCallback(
    async (): Promise<boolean> => (await cloneDraftResult()).succeeded,
    [cloneDraftResult]
  );
  const deleteDraftResult = useCallback(
    () => runSimpleOperation(["deleteDraft", "delete"], adapter.deleteDraft ?? adapter.delete, "deleteDraft"),
    [adapter.delete, adapter.deleteDraft, runSimpleOperation]
  );
  const deleteDraft = useCallback(
    async (): Promise<boolean> => (await deleteDraftResult()).succeeded,
    [deleteDraftResult]
  );
  const setVisibilityResult = useCallback(
    async (status: "draft" | "published" | "archived"): Promise<SurveyVersionActionResult> => {
      const setVisibilityAction = adapter.setVisibility ?? adapter.setStatus;
      const controller = new AbortController();
      setOperations((current) => setOperation(current, ["setVisibility", "setStatus"], { status: "loading" }));
      try {
        if (setVisibilityAction === undefined)
          throw new TypeError("SurveyVersionActionsAdapter requires setVisibility.");
        await setVisibilityAction({ ...request(controller.signal), status });
        const result = actionResult(true);
        setOperations((current) =>
          setOperation(current, ["setVisibility", "setStatus"], { status: "success", result })
        );
        return result;
      } catch (cause) {
        const error = normalizeError(cause);
        const result = actionResult(false, error);
        setOperations((current) =>
          setOperation(current, ["setVisibility", "setStatus"], { status: "error", error, result })
        );
        return result;
      }
    },
    [adapter.setStatus, adapter.setVisibility, request]
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
        ? actionResult<QualityCheckResult>(false, qualityErrorRef.current)
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
export function useSurveyVersionDomainActions<TVersion, TState = unknown>(
  options: UseSurveyVersionDomainActionsOptions<TVersion, TState>
): UseSurveyVersionOperationsResult {
  return useSurveyVersionOperationsInternal(options);
}

/** Preferred action-oriented name for the version controller. */
export const useSurveyVersionActions = useSurveyVersionOperations;

/** Explicit controller alias for applications that standardize on controller naming. */
export const useSurveyVersionActionsController = useSurveyVersionOperations;
