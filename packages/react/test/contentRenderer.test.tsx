import {
  contentMetadataToJson,
  createInitialSchemaByMode,
  type FormAnalytics,
  type FormSchema
} from "@form-engine-ts/core";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContentRenderer } from "../src";

function schema(
  showExplanation: "immediate" | "after_submit" = "immediate",
  locale = "en",
  passingScore: number | null = 1
): FormSchema {
  const base = createInitialSchemaByMode("quiz", { title: locale === "ja" ? "クイズ" : "Quiz", locale });
  return {
    ...base,
    metadata: contentMetadataToJson({
      mode: "quiz",
      quiz: passingScore === null ? { showExplanation } : { showExplanation, passingScore }
    }),
    fields: base.fields.map((field) => ({
      ...field,
      metadata: contentMetadataToJson({
        quiz: { correctOptionId: "option-1", explanation: "Because it is correct.", points: 2 }
      })
    }))
  };
}

describe("ContentRenderer", () => {
  afterEach(cleanup);

  it("renders poll results inside each choice label after submission", async () => {
    const user = userEvent.setup();
    const poll = createInitialSchemaByMode("poll", { title: "Poll", locale: "en" });
    const loadResults = () =>
      Promise.resolve<FormAnalytics>({
        formId: poll.id,
        formVersion: poll.version,
        submissionCount: 4,
        questions: [
          {
            fieldId: poll.fields[0]?.id ?? "question-1",
            kind: "radio",
            answeredCount: 4,
            unansweredCount: 0,
            options: [
              { id: "option-1", count: 3, percentageOfSubmissions: 75 },
              { id: "option-2", count: 1, percentageOfSubmissions: 25 }
            ]
          }
        ]
      });
    render(
      <ContentRenderer
        schema={poll}
        onSubmit={() => undefined}
        contentModeOptions={{
          poll: { adapter: { loadResults, canVote: async () => true }, closed: false, canViewResults: true }
        }}
      />
    );
    await user.click(screen.getByRole("radio", { name: "Option 1" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));
    const result = await screen.findByText("3 votes (75%)");
    expect(result.closest("label")).toContainElement(screen.getByRole("radio", { name: "Option 1" }));
    expect(screen.queryByRole("heading", { name: "Poll results" })).not.toBeInTheDocument();
  });

  it("keeps poll loading errors and retry inside the choice group", async () => {
    const initialPoll = createInitialSchemaByMode("poll", { title: "Poll", locale: "en" });
    const poll = {
      ...initialPoll,
      metadata: contentMetadataToJson({ mode: "poll", poll: { resultVisibility: "always" } })
    };
    const analytics: FormAnalytics = {
      formId: poll.id,
      formVersion: poll.version,
      submissionCount: 0,
      questions: []
    };
    const loadResults = vi.fn().mockRejectedValueOnce(new Error("Unavailable")).mockResolvedValueOnce(analytics);
    render(
      <ContentRenderer
        schema={poll}
        contentModeOptions={{
          poll: {
            adapter: { loadResults, canVote: async () => true },
            closed: false,
            canViewResults: true
          }
        }}
      />
    );
    const alert = await screen.findByRole("alert");
    expect(alert.closest("fieldset")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry results" }));
    await screen.findByRole("radio", { name: "Option 1" });
    expect(loadResults).toHaveBeenCalledTimes(2);
  });

  it("loads after-submit results immediately for an existing vote", async () => {
    const initialPoll = createInitialSchemaByMode("poll", { title: "Poll", locale: "en" });
    const poll = {
      ...initialPoll,
      metadata: contentMetadataToJson({ mode: "poll", poll: { resultVisibility: "after_submit" } })
    };
    const loadResults = vi.fn(
      async () =>
        ({
          formId: poll.id,
          formVersion: poll.version,
          submissionCount: 1,
          questions: [
            {
              fieldId: poll.fields[0]?.id ?? "question-1",
              kind: "radio" as const,
              answeredCount: 1,
              unansweredCount: 0,
              options: [{ id: "option-1", count: 1, percentageOfSubmissions: 100 }]
            }
          ]
        }) satisfies FormAnalytics
    );
    render(
      <ContentRenderer
        schema={poll}
        contentModeOptions={{
          poll: {
            adapter: { loadResults, canVote: async () => false },
            closed: false,
            canViewResults: true,
            alreadyVoted: true
          }
        }}
      />
    );
    expect(await screen.findByText("1 votes (100%)")).toBeInTheDocument();
    expect(screen.getByText("0 votes (0%)")).toBeInTheDocument();
    expect(loadResults).toHaveBeenCalledOnce();
    expect(screen.queryByRole("heading", { name: "Poll results" })).not.toBeInTheDocument();
  });

  it("renders inline results for multi-select poll choices", async () => {
    const initialPoll = createInitialSchemaByMode("poll", { title: "Poll", locale: "en" });
    const initialField = initialPoll.fields[0];
    if (initialField === undefined || !("options" in initialField)) throw new Error("Expected poll choice field");
    const poll = {
      ...initialPoll,
      fields: [{ ...initialField, type: "multi-select" as const }],
      metadata: contentMetadataToJson({ mode: "poll", poll: { resultVisibility: "always" } })
    };
    const loadResults = async () =>
      ({
        formId: poll.id,
        formVersion: poll.version,
        submissionCount: 2,
        questions: [
          {
            fieldId: poll.fields[0]?.id ?? "question-1",
            kind: "multi-select" as const,
            answeredCount: 2,
            unansweredCount: 0,
            options: [
              { id: "option-1", count: 1, percentageOfSubmissions: 50 },
              { id: "option-2", count: 2, percentageOfSubmissions: 100 }
            ]
          }
        ]
      }) satisfies FormAnalytics;
    render(
      <ContentRenderer
        schema={poll}
        contentModeOptions={{
          poll: { adapter: { loadResults, canVote: async () => true }, closed: false, canViewResults: true }
        }}
      />
    );
    expect(await screen.findByText("1 votes (50%)")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Option 1" }).closest("label")).toContainElement(
      screen.getByText("1 votes (50%)")
    );
  });

  it("shows inline feedback with state classes and keeps the incorrect answer out of aria-invalid", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ContentRenderer
        schema={schema()}
        onSubmit={() => undefined}
        classNames={{ quizQuestionCorrect: "is-correct", quizQuestionIncorrect: "is-incorrect" }}
      />
    );
    const option = screen.getByRole("radio", { name: "Option 2" });
    await user.click(option);
    expect(screen.getByText(/Incorrect/)).toBeInTheDocument();
    expect(container.querySelector(".fe-quiz-feedback")).toHaveClass("is-incorrect");
    expect(container.querySelector(".fe-choice-group")).toHaveClass("is-incorrect");
    expect(option).not.toHaveAttribute("aria-invalid");
    await user.click(screen.getByRole("radio", { name: "Option 1" }));
    expect(container.querySelector(".fe-quiz-feedback")?.textContent).toContain("Correct");
    expect(container.querySelector(".fe-quiz-feedback")).toHaveClass("is-correct");
    expect(container.querySelector(".fe-choice-group")).toHaveClass("is-correct");
  });

  it("shows only the score and pass status in the completion summary", async () => {
    const user = userEvent.setup();
    render(<ContentRenderer schema={schema("after_submit")} onSubmit={() => undefined} />);
    await user.click(screen.getByRole("radio", { name: "Option 1" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText(/Total score: 2 \/ 2/)).toBeInTheDocument();
    expect(screen.getByText("Passed")).toBeInTheDocument();
    expect(screen.getAllByText("Because it is correct.").length).toBe(1);
  });

  it("omits score and pass status when no passing score is configured", async () => {
    const user = userEvent.setup();
    render(<ContentRenderer schema={schema("after_submit", "en", null)} onSubmit={() => undefined} />);
    await user.click(screen.getByRole("radio", { name: "Option 1" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("Submitted.")).toBeInTheDocument();
    expect(screen.queryByText(/Total score:/)).not.toBeInTheDocument();
    expect(screen.queryByText("Passed")).not.toBeInTheDocument();
    expect(screen.queryByText("Not passed")).not.toBeInTheDocument();
  });

  it("keeps quiz feedback accessible and announces its result", async () => {
    const user = userEvent.setup();
    const { container } = render(<ContentRenderer schema={schema()} onSubmit={() => undefined} />);
    await user.click(screen.getByRole("radio", { name: "Option 2" }));
    const feedback = container.querySelector(".fe-quiz-feedback");
    expect(feedback).toHaveAttribute("aria-live", "polite");
    expect(feedback?.querySelector('[role="status"]')).toHaveTextContent("Incorrect");
    const result = await axe.run(container);
    expect(result.violations).toEqual([]);
  });

  it("localizes quiz feedback and summary labels", async () => {
    const user = userEvent.setup();
    render(<ContentRenderer schema={schema("immediate", "ja")} locale="ja" onSubmit={() => undefined} />);
    await user.click(screen.getByRole("radio", { name: "選択肢2" }));
    expect(screen.getByText("不正解")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "選択肢1" }));
    await user.click(screen.getByRole("button", { name: "送信する" }));
    expect(await screen.findByText(/合計得点/)).toBeInTheDocument();
  });
});
