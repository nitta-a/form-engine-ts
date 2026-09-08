import {
  contentMetadataToJson,
  createInitialSchemaByMode,
  type FormAnalytics,
  getContentModePolicy,
  type PollRuntimeAdapter
} from "@form-engine-ts/core";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useFormBuilder } from "../src/hooks/useFormBuilder";
import { usePollResults } from "../src/hooks/usePollResults";

describe("content mode controllers", () => {
  const analytics = (schema: ReturnType<typeof createInitialSchemaByMode>, submissionCount = 1): FormAnalytics => ({
    formId: schema.id,
    formVersion: schema.version,
    submissionCount,
    questions: []
  });
  it("blocks a second poll question and unsupported quiz types through actions", () => {
    const schema = createInitialSchemaByMode("poll", { title: "Poll", locale: "en" });
    const onChange = vi.fn();
    const { result } = renderHook(() => useFormBuilder({ schema, onChange, policy: getContentModePolicy("poll") }));
    expect(result.current.addField("radio")).toMatchObject({ success: false });
    expect(onChange).not.toHaveBeenCalled();
    const quiz = renderHook(() => useFormBuilder({ schema, onChange, policy: getContentModePolicy("quiz") }));
    expect(quiz.result.current.addField("text")).toMatchObject({ success: false });
    expect(quiz.result.current.changeFieldType("question-1", "multi-select")).toMatchObject({ success: false });
  });
  it("gates requests, retries errors, and discards stale requests", async () => {
    const schema = createInitialSchemaByMode("poll", { title: "Poll", locale: "en" });
    const loadResults = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(analytics(schema, 2));
    const adapter: PollRuntimeAdapter<FormAnalytics> = { loadResults, canVote: async () => true };
    const { result, rerender } = renderHook(
      ({ submitted, canViewResults }) => usePollResults({ schema, adapter, submitted, canViewResults, closed: false }),
      { initialProps: { submitted: false, canViewResults: true } }
    );
    expect(loadResults).not.toHaveBeenCalled();
    rerender({ submitted: true, canViewResults: true });
    await waitFor(() => expect(result.current.error?.message).toBe("offline"));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.data?.submissionCount).toBe(2));
    rerender({ submitted: true, canViewResults: false });
    expect(result.current.data).toBeUndefined();
    expect(loadResults).toHaveBeenCalledTimes(2);
  });
  it.each([
    ["always", true],
    ["after_submit", true],
    ["closed_only", false],
    ["private", false]
  ] as const)("treats an existing vote as submitted only for %s", (resultVisibility, enabled) => {
    const initial = createInitialSchemaByMode("poll", { title: "Poll", locale: "en" });
    const schema = {
      ...initial,
      metadata: contentMetadataToJson({ mode: "poll", poll: { resultVisibility } })
    };
    const adapter: PollRuntimeAdapter<FormAnalytics> = {
      loadResults: async () => analytics(schema),
      canVote: async () => false
    };
    const { result } = renderHook(() =>
      usePollResults({ schema, adapter, submitted: false, alreadyVoted: true, closed: false, canViewResults: true })
    );
    expect(result.current.enabled).toBe(enabled);
  });
  it("ignores a late response when the selected form changes", async () => {
    let resolveFirst: ((value: FormAnalytics) => void) | undefined;
    const first = createInitialSchemaByMode("poll", { title: "One", locale: "en", id: "one" });
    const second = { ...first, id: "two" };
    const adapter: PollRuntimeAdapter<FormAnalytics> = {
      canVote: async () => true,
      loadResults: (schema) =>
        schema.id === "one"
          ? new Promise((resolve) => {
              resolveFirst = resolve;
            })
          : Promise.resolve(analytics(schema, 2))
    };
    const { result, rerender } = renderHook(
      ({ schema }) => usePollResults({ schema, adapter, submitted: true, closed: false, canViewResults: true }),
      { initialProps: { schema: first } }
    );
    await waitFor(() => expect(resolveFirst).toBeDefined());
    rerender({ schema: second });
    await waitFor(() => expect(result.current.data?.submissionCount).toBe(2));
    await act(async () => resolveFirst?.(analytics(first, 1)));
    expect(result.current.data?.submissionCount).toBe(2);
  });
  it("applies an optimistic vote before the delayed aggregate arrives", async () => {
    const schema = createInitialSchemaByMode("poll", { title: "Poll", locale: "en" });
    let resolveResults: ((value: FormAnalytics) => void) | undefined;
    const adapter: PollRuntimeAdapter<FormAnalytics> = {
      canVote: async () => true,
      loadResults: async () =>
        new Promise((resolve) => {
          resolveResults = resolve;
        })
    };
    const { result } = renderHook(() =>
      usePollResults({ schema, adapter, submitted: true, closed: false, canViewResults: true })
    );
    await waitFor(() => expect(result.current.loading).toBe(true));
    act(() => result.current.applyOptimisticVote("option-1"));
    expect(result.current.data?.submissionCount).toBe(1);
    const question = result.current.data?.questions[0];
    expect(question?.kind).toBe("radio");
    if (question?.kind !== "radio") throw new Error("Expected radio aggregate");
    expect(question.options).toContainEqual({ id: "option-1", count: 1, percentageOfSubmissions: 100 });
    await act(async () => resolveResults?.(analytics(schema, 4)));
    await waitFor(() => expect(result.current.data?.submissionCount).toBe(4));
  });
});
