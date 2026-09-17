import { createInitialSchemaByMode, type FormAnalytics, type PollRuntimeAdapter } from "@form-engine-ts/core";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PollResultsEmbed } from "../src";

describe("PollResultsEmbed", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads results and refreshes them on the configured interval", async () => {
    vi.useFakeTimers();
    const schema = {
      ...createInitialSchemaByMode("poll", { id: "embed-poll", title: "Poll", locale: "en" }),
      metadata: { mode: "poll", poll: { resultVisibility: "always" } }
    };
    let submissionCount = 1;
    const loadResults = vi.fn(
      async (): Promise<FormAnalytics> => ({
        formId: schema.id,
        formVersion: schema.version,
        submissionCount,
        questions: []
      })
    );
    const adapter: PollRuntimeAdapter<FormAnalytics> = { loadResults, canVote: async () => false };
    render(<PollResultsEmbed schema={schema} adapter={adapter} refreshIntervalMs={1_000} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(loadResults).toHaveBeenCalledTimes(1);
    submissionCount = 2;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(loadResults).toHaveBeenCalledTimes(2);
  });

  it("does not render private poll results", () => {
    const schema = {
      ...createInitialSchemaByMode("poll", { id: "private-poll", title: "Poll", locale: "en" }),
      metadata: { mode: "poll", poll: { resultVisibility: "private" } }
    };
    const adapter: PollRuntimeAdapter<FormAnalytics> = {
      loadResults: vi.fn(),
      canVote: async () => false
    };
    render(<PollResultsEmbed schema={schema} adapter={adapter} />);
    expect(screen.queryByTestId("poll-results")).not.toBeInTheDocument();
    expect(adapter.loadResults).not.toHaveBeenCalled();
  });

  it("does not expose closed-only results until explicitly closed", () => {
    const schema = {
      ...createInitialSchemaByMode("poll", { id: "closed-only-poll", title: "Poll", locale: "en" }),
      metadata: { mode: "poll", poll: { resultVisibility: "closed_only" } }
    };
    const adapter: PollRuntimeAdapter<FormAnalytics> = {
      loadResults: vi.fn(),
      canVote: async () => false
    };
    render(<PollResultsEmbed schema={schema} adapter={adapter} />);
    expect(adapter.loadResults).not.toHaveBeenCalled();
  });

  it("uses the result slot when results are available", async () => {
    const schema = {
      ...createInitialSchemaByMode("poll", { id: "slot-poll", title: "Poll", locale: "en" }),
      metadata: { mode: "poll", poll: { resultVisibility: "always" } }
    };
    render(
      <PollResultsEmbed
        schema={schema}
        adapter={{
          loadResults: async () => ({
            formId: schema.id,
            formVersion: schema.version,
            submissionCount: 1,
            questions: []
          }),
          canVote: async () => false
        }}
        slots={{ result: () => <p>Custom results</p> }}
      />
    );
    expect(await screen.findByText("Custom results")).toBeInTheDocument();
  });

  it("pauses refreshes while the document is hidden", async () => {
    vi.useFakeTimers();
    const schema = {
      ...createInitialSchemaByMode("poll", { id: "hidden-poll", title: "Poll", locale: "en" }),
      metadata: { mode: "poll", poll: { resultVisibility: "always" } }
    };
    const loadResults = vi.fn(async () => ({
      formId: schema.id,
      formVersion: schema.version,
      submissionCount: 1,
      questions: []
    }));
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    render(
      <PollResultsEmbed
        schema={schema}
        adapter={{ loadResults, canVote: async () => false }}
        refreshIntervalMs={1_000}
      />
    );
    await act(async () => Promise.resolve());
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
    await act(async () => vi.advanceTimersByTimeAsync(2_000));
    expect(loadResults).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
    await act(async () => vi.advanceTimersByTimeAsync(1_000));
    expect(loadResults).toHaveBeenCalledTimes(2);
  });
});
