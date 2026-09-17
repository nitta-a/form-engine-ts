import type { FormSchema } from "@form-engine-ts/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuizResultSummary } from "../src";

const schema: FormSchema = {
  id: "quiz-share",
  version: 1,
  title: "Knowledge check",
  fields: []
};

const evaluation = {
  totalScore: 8,
  maxPossibleScore: 10,
  isPassed: true,
  questions: []
} as const;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("QuizResultSummary sharing", () => {
  it("uses an injected share handler", async () => {
    const user = userEvent.setup();
    const onShare = vi.fn();
    render(
      <QuizResultSummary
        evaluation={evaluation}
        schema={schema}
        share={{ url: "https://example.test/result", onShare }}
      />
    );
    await user.click(screen.getByRole("button", { name: "Share result" }));
    expect(onShare).toHaveBeenCalledWith({
      title: "Knowledge check",
      text: "Total score: 8 / 10",
      url: "https://example.test/result"
    });
    expect(screen.getByRole("button", { name: "Shared" })).toBeDisabled();
  });

  it("falls back to clipboard when Web Share is unavailable", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<QuizResultSummary evaluation={evaluation} schema={schema} share={{}} />);
    await user.click(screen.getByRole("button", { name: "Share result" }));
    expect(writeText).toHaveBeenCalledWith("Total score: 8 / 10");
    expect(screen.getByRole("button", { name: "Copied" })).toBeDisabled();
  });

  it("supports custom share text and rendering", async () => {
    const user = userEvent.setup();
    const onShare = vi.fn();
    const buildText = vi.fn(() => "I scored 8 out of 10");
    render(
      <QuizResultSummary
        evaluation={evaluation}
        schema={schema}
        share={{ onShare, buildText }}
        renderShare={({ onShare: shareResult }) => (
          <button type="button" onClick={shareResult}>
            Custom share
          </button>
        )}
      />
    );
    await user.click(screen.getByRole("button", { name: "Custom share" }));
    expect(buildText).toHaveBeenCalledWith(evaluation, schema);
    expect(onShare).toHaveBeenCalledWith({ title: "Knowledge check", text: "I scored 8 out of 10" });
  });
});
