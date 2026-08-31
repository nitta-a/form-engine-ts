import { useCallback, useEffect, useRef, useState } from "react";
import type {
  QualityCheckResult,
  QualityCheckStatus,
  QualityIssue,
  QualityIssueDecision,
  SurveyVersionActionResult
} from "../types";
import type { SurveyQualityEvent, UseSurveyQualityControllerOptions, UseSurveyQualityControllerResult } from "./types";

function issueKey(issue: QualityIssue): string {
  return `${issue.code}:${issue.path ?? ""}`;
}

function normalizeError(cause: unknown): Error {
  if (cause instanceof Error) return cause;
  if (typeof cause === "object" && cause !== null && "message" in cause && typeof cause.message === "string") {
    return new Error(cause.message);
  }
  return new Error(String(cause));
}

function normalizeCheckStatus(
  status: QualityCheckStatus | undefined,
  issueCount: number
): "idle" | "running" | "passed" | "failed" | "error" {
  if (status === undefined) return issueCount === 0 ? "passed" : "failed";
  if (status === "RUNNING") return "running";
  if (status === "COMPLETED") return issueCount === 0 ? "passed" : "failed";
  if (status === "FAILED" || status === "STALE") return "failed";
  return status;
}

function failedResult(cause: unknown): SurveyVersionActionResult {
  return { succeeded: false, error: normalizeError(cause), cause };
}

function notify<TResponse>(
  event: SurveyQualityEvent<TResponse>,
  notifyEvent: SurveyQualityCheckEventHandler<TResponse>
) {
  notifyEvent?.(event);
}

type SurveyQualityCheckEventHandler<TResponse> = (event: SurveyQualityEvent<TResponse>) => void;

/** Runs quality checks and decisions as one replaceable, transport-neutral controller. */
export function useSurveyQualityController<TVersion, TState = unknown, TResponse = unknown>({
  version,
  state: versionState,
  adapter
}: UseSurveyQualityControllerOptions<TVersion, TState, TResponse>): UseSurveyQualityControllerResult<TResponse> {
  const [quality, setQuality] = useState<UseSurveyQualityControllerResult<TResponse>["quality"]>({
    status: "idle",
    issues: []
  });
  const [decisions, setDecisions] = useState<Readonly<Record<string, QualityIssueDecision>>>({});
  const qualityRef = useRef<QualityCheckResult<TResponse> | undefined>(undefined);
  const previousVersion = useRef(version);
  const previousState = useRef(versionState);
  const versionRef = useRef(version);
  const stateRef = useRef(versionState);
  versionRef.current = version;
  stateRef.current = versionState;

  useEffect(() => {
    if (previousVersion.current === version && previousState.current === versionState) return;
    previousVersion.current = version;
    previousState.current = versionState;
    qualityRef.current = undefined;
    setQuality({ status: "idle", issues: [] });
    setDecisions({});
  }, [version, versionState]);

  const run = useCallback(async (): Promise<QualityCheckResult<TResponse> | undefined> => {
    setQuality((current) => ({ ...current, status: "loading", checkStatus: "running", issues: current.issues }));
    try {
      const result = await adapter.run({
        version: versionRef.current,
        ...(stateRef.current === undefined ? {} : { state: stateRef.current }),
        signal: new AbortController().signal
      });
      qualityRef.current = result;
      setQuality({
        status: "success",
        issues: result.issues,
        checkStatus: normalizeCheckStatus(result.status, result.issues.length),
        result,
        ...(result.runId === undefined ? {} : { runId: result.runId }),
        ...(result.checkedRevision === undefined ? {} : { checkedRevision: result.checkedRevision })
      });
      notify({ type: "checked", result }, adapter.notify ?? (() => undefined));
      await adapter.invalidate?.();
      return result;
    } catch (cause) {
      const error = normalizeError(cause);
      setQuality((current) => ({
        ...current,
        status: "error",
        checkStatus: "error",
        issues: current.issues,
        error,
        cause
      }));
      notify({ type: "error", error, cause }, adapter.notify ?? (() => undefined));
      return undefined;
    }
  }, [adapter]);

  const decide = useCallback(
    async (issue: QualityIssue, decision: QualityIssueDecision): Promise<SurveyVersionActionResult> => {
      const result = qualityRef.current;
      if (result === undefined) return failedResult(new Error("Run a quality check before deciding an issue."));
      if (adapter.decide === undefined)
        return failedResult(new TypeError("SurveyQualityCheckAdapter requires decide."));
      try {
        const response = await adapter.decide({
          version: versionRef.current,
          ...(stateRef.current === undefined ? {} : { state: stateRef.current }),
          signal: new AbortController().signal,
          issue,
          decision,
          result
        });
        const actionResult = response ?? { succeeded: true };
        if (actionResult.succeeded) {
          setDecisions((current) => ({ ...current, [issueKey(issue)]: decision }));
          notify({ type: "decided", issue, decision }, adapter.notify ?? (() => undefined));
          await adapter.invalidate?.();
        }
        return actionResult;
      } catch (cause) {
        const error = failedResult(cause);
        if (error.error !== undefined)
          notify({ type: "error", error: error.error, cause }, adapter.notify ?? (() => undefined));
        return error;
      }
    },
    [adapter]
  );

  const accept = useCallback((issue: QualityIssue) => decide(issue, "accept"), [decide]);
  const reject = useCallback((issue: QualityIssue) => decide(issue, "reject"), [decide]);
  return { quality, decisions, run, decide, accept, reject };
}
