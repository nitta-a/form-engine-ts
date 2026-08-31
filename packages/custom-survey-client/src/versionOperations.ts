import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DomainSurveyVersionOperationRequest,
  DomainSurveyVersionPublishRequest,
  DomainSurveyVersionQualityIssueDecisionRequest,
  QualityCheckResult,
  QualityIssue,
  QualityIssueDecision,
  SurveyVersionActionAdapter,
  SurveyVersionOperationName,
  SurveyVersionOperationState,
  UseSurveyVersionDomainActionsOptions,
  UseSurveyVersionOperationsOptions,
  UseSurveyVersionOperationsResult
} from "./types";

function normalizeError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
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
  const [quality, setQuality] = useState<SurveyVersionOperationState & { readonly result?: QualityCheckResult }>({
    status: "idle"
  });
  const [qualityDecisions, setQualityDecisions] = useState<Readonly<Record<string, QualityIssueDecision>>>({});
  const qualityDecisionsRef = useRef<Readonly<Record<string, QualityIssueDecision>>>({});
  const qualityRef = useRef<QualityCheckResult | undefined>(undefined);
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
      setQuality({ status: "success", result });
      setOperations((current) => setOperation(current, ["runQualityCheck", "qualityCheck"], { status: "success" }));
      return result;
    } catch (cause) {
      const error = normalizeError(cause);
      setQuality({ status: "error", error });
      setOperations((current) =>
        setOperation(current, ["runQualityCheck", "qualityCheck"], { status: "error", error })
      );
      return undefined;
    }
  }, [adapter, request]);

  const publish = useCallback(
    async (options: { readonly allowWarnings?: boolean } = {}): Promise<boolean> => {
      const allowWarnings = options.allowWarnings ?? false;
      const qualityCheck = adapter.runQualityCheck ?? adapter.qualityCheck;
      const qualityResult = qualityCheck === undefined ? undefined : (qualityRef.current ?? (await runQualityCheck()));
      if (qualityCheck !== undefined && qualityResult === undefined) return false;
      const unresolvedIssues = (qualityResult?.issues ?? []).filter(
        (issue) => qualityDecisionsRef.current[issueKey(issue)] !== "accept"
      );
      if (!allowWarnings && unresolvedIssues.length > 0) {
        setOperations((current) => setOperation(current, ["publish"], { status: "needs_confirmation" }));
        return false;
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
        setOperations((current) => setOperation(current, ["publish"], { status: "success" }));
        return true;
      } catch (cause) {
        const error = normalizeError(cause);
        setOperations((current) => setOperation(current, ["publish"], { status: "error", error }));
        return false;
      }
    },
    [adapter.publish, adapter.qualityCheck, adapter.runQualityCheck, request, runQualityCheck]
  );

  const decideQualityIssue = useCallback(
    async (issue: QualityIssue, decision: QualityIssueDecision): Promise<boolean> => {
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
        setOperations((current) => setOperation(current, ["decideQualityIssue"], { status: "success" }));
        return true;
      } catch (cause) {
        const error = normalizeError(cause);
        setOperations((current) => setOperation(current, ["decideQualityIssue"], { status: "error", error }));
        return false;
      }
    },
    [adapter.decideQualityIssue, request]
  );

  const runSimpleOperation = useCallback(
    async (
      names: readonly SurveyVersionOperationName[],
      operation: ((request: DomainSurveyVersionOperationRequest<TVersion, TState>) => Promise<void>) | undefined,
      requiredName: string
    ): Promise<boolean> => {
      const controller = new AbortController();
      setOperations((current) => setOperation(current, names, { status: "loading" }));
      try {
        if (operation === undefined) throw new TypeError(`SurveyVersionActionsAdapter requires ${requiredName}.`);
        await operation(request(controller.signal));
        setOperations((current) => setOperation(current, names, { status: "success" }));
        return true;
      } catch (cause) {
        const error = normalizeError(cause);
        setOperations((current) => setOperation(current, names, { status: "error", error }));
        return false;
      }
    },
    [request]
  );

  const cloneDraft = useCallback(
    () => runSimpleOperation(["cloneDraft", "duplicate"], adapter.cloneDraft ?? adapter.duplicate, "cloneDraft"),
    [adapter.cloneDraft, adapter.duplicate, runSimpleOperation]
  );
  const deleteDraft = useCallback(
    () => runSimpleOperation(["deleteDraft", "delete"], adapter.deleteDraft ?? adapter.delete, "deleteDraft"),
    [adapter.delete, adapter.deleteDraft, runSimpleOperation]
  );
  const setVisibility = useCallback(
    async (status: "draft" | "published" | "archived"): Promise<boolean> => {
      const setVisibilityAction = adapter.setVisibility ?? adapter.setStatus;
      const controller = new AbortController();
      setOperations((current) => setOperation(current, ["setVisibility", "setStatus"], { status: "loading" }));
      try {
        if (setVisibilityAction === undefined)
          throw new TypeError("SurveyVersionActionsAdapter requires setVisibility.");
        await setVisibilityAction({ ...request(controller.signal), status });
        setOperations((current) => setOperation(current, ["setVisibility", "setStatus"], { status: "success" }));
        return true;
      } catch (cause) {
        const error = normalizeError(cause);
        setOperations((current) => setOperation(current, ["setVisibility", "setStatus"], { status: "error", error }));
        return false;
      }
    },
    [adapter.setStatus, adapter.setVisibility, request]
  );

  return {
    quality,
    qualityDecisions,
    operations,
    runQualityCheck,
    decideQualityIssue,
    publish,
    cloneDraft,
    deleteDraft,
    setVisibility,
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
