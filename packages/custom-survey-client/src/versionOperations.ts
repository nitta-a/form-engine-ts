import { useCallback, useEffect, useRef, useState } from "react";
import type {
  QualityCheckResult,
  SurveyVersionOperationName,
  SurveyVersionOperationRequest,
  SurveyVersionOperationState,
  SurveyVersionPublishRequest,
  UseSurveyVersionOperationsOptions,
  UseSurveyVersionOperationsResult
} from "./types";

function normalizeError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

function operationStates(): Record<SurveyVersionOperationName, SurveyVersionOperationState> {
  return {
    qualityCheck: { status: "idle" },
    publish: { status: "idle" },
    duplicate: { status: "idle" },
    delete: { status: "idle" },
    setStatus: { status: "idle" }
  };
}

function setOperation(
  current: Readonly<Record<SurveyVersionOperationName, SurveyVersionOperationState>>,
  name: SurveyVersionOperationName,
  state: SurveyVersionOperationState
): Readonly<Record<SurveyVersionOperationName, SurveyVersionOperationState>> {
  return { ...current, [name]: state };
}

/** Manages quality checks and version lifecycle actions without choosing a transport or cache library. */
export function useSurveyVersionOperations({
  version,
  state: versionState,
  adapter
}: UseSurveyVersionOperationsOptions): UseSurveyVersionOperationsResult {
  const [operations, setOperations] = useState(operationStates);
  const [quality, setQuality] = useState<SurveyVersionOperationState & { readonly result?: QualityCheckResult }>({
    status: "idle"
  });
  const qualityRef = useRef<QualityCheckResult | undefined>(undefined);
  const previousVersion = useRef<{
    readonly version: UseSurveyVersionOperationsOptions["version"];
    readonly state?: UseSurveyVersionOperationsOptions["state"];
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
    setOperations(operationStates());
  }, [version, versionState]);

  const request = useCallback(
    (signal: AbortSignal): SurveyVersionOperationRequest => ({
      version,
      ...(versionState === undefined ? {} : { state: versionState }),
      signal
    }),
    [version, versionState]
  );

  const runQualityCheck = useCallback(async (): Promise<QualityCheckResult | undefined> => {
    const controller = new AbortController();
    setQuality({ status: "loading" });
    setOperations((current) => setOperation(current, "qualityCheck", { status: "loading" }));
    try {
      const result = await adapter.qualityCheck(request(controller.signal));
      qualityRef.current = result;
      setQuality({ status: "success", result });
      setOperations((current) => setOperation(current, "qualityCheck", { status: "success" }));
      return result;
    } catch (cause) {
      const error = normalizeError(cause);
      setQuality({ status: "error", error });
      setOperations((current) => setOperation(current, "qualityCheck", { status: "error", error }));
      return undefined;
    }
  }, [adapter, request]);

  const publish = useCallback(
    async (options: { readonly allowWarnings?: boolean } = {}): Promise<boolean> => {
      const allowWarnings = options.allowWarnings ?? false;
      const qualityResult = qualityRef.current ?? (await runQualityCheck());
      if (qualityResult === undefined) return false;
      if (!allowWarnings && qualityResult.issues.length > 0) {
        setOperations((current) => setOperation(current, "publish", { status: "needs_confirmation" }));
        return false;
      }
      const controller = new AbortController();
      setOperations((current) => setOperation(current, "publish", { status: "loading" }));
      try {
        const publishRequest: SurveyVersionPublishRequest = {
          ...request(controller.signal),
          allowWarnings
        };
        await adapter.publish(publishRequest);
        setOperations((current) => setOperation(current, "publish", { status: "success" }));
        return true;
      } catch (cause) {
        const error = normalizeError(cause);
        setOperations((current) => setOperation(current, "publish", { status: "error", error }));
        return false;
      }
    },
    [adapter, request, runQualityCheck]
  );

  const runSimpleOperation = useCallback(
    async (name: "duplicate" | "delete", operation: (request: SurveyVersionOperationRequest) => Promise<void>) => {
      const controller = new AbortController();
      setOperations((current) => setOperation(current, name, { status: "loading" }));
      try {
        await operation(request(controller.signal));
        setOperations((current) => setOperation(current, name, { status: "success" }));
        return true;
      } catch (cause) {
        const error = normalizeError(cause);
        setOperations((current) => setOperation(current, name, { status: "error", error }));
        return false;
      }
    },
    [request]
  );

  const duplicate = useCallback(
    () => runSimpleOperation("duplicate", adapter.duplicate),
    [adapter.duplicate, runSimpleOperation]
  );
  const deleteVersion = useCallback(
    () => runSimpleOperation("delete", adapter.delete),
    [adapter.delete, runSimpleOperation]
  );

  const setStatus = useCallback(
    async (status: "draft" | "published" | "archived"): Promise<boolean> => {
      const controller = new AbortController();
      setOperations((current) => setOperation(current, "setStatus", { status: "loading" }));
      try {
        await adapter.setStatus({ ...request(controller.signal), status });
        setOperations((current) => setOperation(current, "setStatus", { status: "success" }));
        return true;
      } catch (cause) {
        const error = normalizeError(cause);
        setOperations((current) => setOperation(current, "setStatus", { status: "error", error }));
        return false;
      }
    },
    [adapter, request]
  );

  return { quality, operations, runQualityCheck, publish, duplicate, delete: deleteVersion, setStatus };
}
