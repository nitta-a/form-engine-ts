import {
  type ChoiceQuestionAggregate,
  canShowPollResults,
  type FormAnalytics,
  type FormSchema,
  getFormContentMode,
  type PollAccessContext,
  type PollRuntimeAdapter,
  readPollMetadata
} from "@form-engine-ts/core";
import { useCallback, useEffect, useState } from "react";

export interface UsePollResultsProps extends PollAccessContext {
  readonly schema: FormSchema;
  readonly adapter: PollRuntimeAdapter<FormAnalytics>;
  readonly alreadyVoted?: boolean;
  readonly submissionRevision?: number;
}

interface PollResultsState {
  readonly schema: FormSchema;
  readonly adapter: PollRuntimeAdapter<FormAnalytics>;
  readonly data?: FormAnalytics;
  readonly error?: Error;
  readonly loading: boolean;
  readonly revision: number;
  readonly retry: number;
}

function createOptimisticAnalytics(schema: FormSchema, selectedOptionIds: readonly string[]): FormAnalytics {
  const field = schema.fields[0];
  const selected = new Set(selectedOptionIds);
  const answered = selected.size > 0;
  if (field === undefined || !("options" in field)) {
    return { formId: schema.id, formVersion: schema.version, submissionCount: 1, questions: [] };
  }
  return {
    formId: schema.id,
    formVersion: schema.version,
    submissionCount: 1,
    questions: [
      {
        fieldId: field.id,
        kind: field.type,
        answeredCount: answered ? 1 : 0,
        unansweredCount: answered ? 0 : 1,
        options: field.options.map((option) => ({
          id: option.id,
          count: selected.has(option.id) ? 1 : 0,
          percentageOfSubmissions: selected.has(option.id) ? 100 : 0
        }))
      }
    ]
  };
}

function applyVoteToAnalytics(
  schema: FormSchema,
  analytics: FormAnalytics,
  selectedOptionIds: readonly string[]
): FormAnalytics {
  const selected = new Set(selectedOptionIds);
  const answered = selected.size > 0;
  const submissionCount = analytics.submissionCount + 1;
  const field = schema.fields[0];
  let matched = false;
  const questions = analytics.questions.map((question) => {
    if (
      question.fieldId !== field?.id ||
      (question.kind !== "radio" && question.kind !== "select" && question.kind !== "multi-select")
    )
      return question;
    matched = true;
    const aggregate: ChoiceQuestionAggregate = {
      ...question,
      answeredCount: question.answeredCount + (answered ? 1 : 0),
      unansweredCount: question.unansweredCount + (answered ? 0 : 1),
      options: question.options.map((option) => {
        const count = option.count + (selected.has(option.id) ? 1 : 0);
        return {
          ...option,
          count,
          percentageOfSubmissions: submissionCount === 0 ? 0 : (count / submissionCount) * 100
        };
      })
    };
    return aggregate;
  });
  if (!matched && field !== undefined && "options" in field) {
    questions.push({
      fieldId: field.id,
      kind: field.type,
      answeredCount: answered ? 1 : 0,
      unansweredCount: answered ? 0 : 1,
      options: field.options.map((option) => ({
        id: option.id,
        count: selected.has(option.id) ? 1 : 0,
        percentageOfSubmissions: submissionCount === 0 || !selected.has(option.id) ? 0 : (1 / submissionCount) * 100
      }))
    });
  }
  return { ...analytics, submissionCount, questions };
}

export function usePollResults(props: UsePollResultsProps) {
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
  const [state, setState] = useState<PollResultsState>();

  const reload = useCallback(() => {
    setRetry((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setState((current) => {
      const next = { schema, adapter, loading: true, revision: submissionRevision, retry };
      return current?.schema === schema && current.adapter === adapter && current.data !== undefined
        ? { ...next, data: current.data }
        : next;
    });
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
            setState((current) => {
              const next = {
                schema,
                adapter,
                error: cause instanceof Error ? cause : new Error(String(cause)),
                loading: false,
                revision: submissionRevision,
                retry
              };
              return current?.schema === schema && current.adapter === adapter && current.data !== undefined
                ? { ...next, data: current.data }
                : next;
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

  const applyOptimisticVote = useCallback(
    (selectedOptionIds: string | readonly string[]) => {
      if (!enabled) return;
      const selected = typeof selectedOptionIds === "string" ? [selectedOptionIds] : selectedOptionIds;
      setState((previous) => {
        const base =
          previous?.schema === schema && previous.adapter === adapter && previous.data !== undefined
            ? previous.data
            : createOptimisticAnalytics(schema, selected);
        const data =
          previous?.schema === schema && previous.adapter === adapter && previous.data !== undefined
            ? applyVoteToAnalytics(schema, previous.data, selected)
            : base;
        return {
          schema,
          adapter,
          data,
          loading: false,
          revision: submissionRevision,
          retry
        };
      });
    },
    [adapter, enabled, retry, schema, submissionRevision]
  );

  return {
    enabled,
    data: current?.data,
    error: current?.error,
    loading: enabled && (current?.loading ?? true),
    reload,
    applyOptimisticVote
  };
}
