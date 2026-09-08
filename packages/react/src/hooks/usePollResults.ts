import {
  canShowPollResults,
  type FormSchema,
  getFormContentMode,
  type PollAccessContext,
  type PollRuntimeAdapter,
  readPollMetadata
} from "@form-engine-ts/core";
import { useEffect, useState } from "react";
export interface UsePollResultsProps<T> extends PollAccessContext {
  readonly schema: FormSchema;
  readonly adapter: PollRuntimeAdapter<T>;
  readonly alreadyVoted?: boolean;
  readonly submissionRevision?: number;
}
export function usePollResults<T>(props: UsePollResultsProps<T>) {
  const { schema, adapter, submitted, alreadyVoted = false, closed, canViewResults, submissionRevision = 0 } = props;
  const effectiveSubmitted = submitted || alreadyVoted;
  const enabled =
    getFormContentMode(schema.metadata) === "poll" &&
    canShowPollResults(readPollMetadata(schema.metadata), {
      submitted: effectiveSubmitted,
      closed,
      canViewResults
    });
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{
    schema: FormSchema;
    adapter: PollRuntimeAdapter<T>;
    data?: T;
    error?: Error;
    loading: boolean;
    revision: number;
    retry: number;
  }>();
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setState({ schema, adapter, loading: true, revision: submissionRevision, retry });
    void Promise.resolve()
      .then(() => {
        controller.signal.throwIfAborted();
        return adapter.loadResults(schema, controller.signal);
      })
      .then(
        (data) => {
          if (!controller.signal.aborted)
            setState({ schema, adapter, data, loading: false, revision: submissionRevision, retry });
        },
        (cause: unknown) => {
          if (!controller.signal.aborted)
            setState({
              schema,
              adapter,
              error: cause instanceof Error ? cause : new Error(String(cause)),
              loading: false,
              revision: submissionRevision,
              retry
            });
        }
      );
    return () => controller.abort();
  }, [enabled, schema, adapter, submissionRevision, retry]);
  const current =
    enabled &&
    state?.adapter === adapter &&
    state.schema === schema &&
    state.revision === submissionRevision &&
    state.retry === retry
      ? state
      : undefined;
  return {
    enabled,
    data: current?.data,
    error: current?.error,
    loading: enabled && (current?.loading ?? true),
    reload: () => setRetry((value) => value + 1)
  };
}
