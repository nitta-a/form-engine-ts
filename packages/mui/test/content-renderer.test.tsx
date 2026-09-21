import {
  contentMetadataToJson,
  createInitialSchemaByMode,
  type FormAnalytics,
  type FormSchema
} from "@form-engine-ts/core";
import type { RespondentButtonProps } from "@form-engine-ts/react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MuiContentRenderer } from "../src/MuiContentRenderer";
import { MuiPollResults, MuiPollResultView } from "../src/MuiPollResults";
import { QuizResultView } from "../src/QuizResultView";

afterEach(cleanup);

function quizSchema(
  showExplanation: "after_submit" | "immediate" = "immediate",
  passingScore: number | null = 1
): FormSchema {
  const schema = createInitialSchemaByMode("quiz", { title: "Quiz", locale: "en" });
  return {
    ...schema,
    metadata: contentMetadataToJson({
      mode: "quiz",
      quiz: passingScore === null ? { showExplanation } : { showExplanation, passingScore }
    }),
    fields: schema.fields.map((field) => ({
      ...field,
      metadata: contentMetadataToJson({
        quiz: { correctOptionId: "option-1", explanation: "Because it is correct.", points: 2 }
      })
    }))
  };
}

function pollAnalytics(schema: FormSchema): FormAnalytics {
  return {
    formId: schema.id,
    formVersion: schema.version,
    submissionCount: 4,
    questions: [
      {
        fieldId: "question-1",
        kind: "radio",
        answeredCount: 4,
        unansweredCount: 0,
        options: [
          { id: "option-1", count: 3, percentageOfSubmissions: 75 },
          { id: "option-2", count: 1, percentageOfSubmissions: 25 }
        ]
      }
    ]
  };
}

function pagedSurveySchema(): FormSchema {
  const schema = createInitialSchemaByMode("survey", { title: "Paged survey", locale: "en" });
  const first = { id: "question-1", type: "text" as const, title: "Question 1", required: false };
  return {
    ...schema,
    fields: [first, { ...first, id: "question-2", title: "Question 2" }],
    pages: [
      { id: "page-1", title: "Page 1", questionIds: [first.id] },
      { id: "page-2", title: "Page 2", questionIds: ["question-2"] }
    ]
  };
}

describe("MuiContentRenderer", () => {
  it("separates the form title and description in the MUI header", () => {
    render(
      <MuiContentRenderer
        schema={{ ...quizSchema(), title: "Form title", description: "Form description" }}
        locale="en"
        onSubmit={async () => undefined}
      />
    );

    const header = screen.getByRole("heading", { name: "Form title" }).parentElement;
    expect(header).toHaveClass("MuiStack-root");
    expect(header).toContainElement(screen.getByText("Form description"));
    expect(document.querySelector(".MuiRadio-root")).toBeInTheDocument();
    expect(document.querySelector(".MuiButton-root")).toBeInTheDocument();
  });

  it("renders MUI progress and page navigation with the respondent flow", async () => {
    render(<MuiContentRenderer schema={pagedSurveySchema()} locale="en" onSubmit={async () => undefined} />);

    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-label", "Progress");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
  });

  it("routes MUI navigation through the respondent Button primitive", async () => {
    const kinds: string[] = [];
    function PrimitiveButton({ kind, type, disabled, children, onClick }: RespondentButtonProps) {
      if (kind !== undefined) kinds.push(kind);
      return (
        <button type={type} disabled={disabled} onClick={onClick}>
          {children}
        </button>
      );
    }

    render(
      <MuiContentRenderer
        schema={pagedSurveySchema()}
        locale="en"
        primitiveComponents={{ Button: PrimitiveButton }}
        onSubmit={async () => undefined}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(kinds).toContain("next");
    expect(kinds).toContain("submit");
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(kinds).toContain("previous");
  });

  it("uses MUI respondent primitives for standard answer controls", () => {
    const schema: FormSchema = {
      id: "mui-respondent-controls",
      version: 1,
      title: "Controls",
      defaultLocale: "en",
      fields: [
        { id: "text", type: "text", title: "Text", required: false },
        { id: "textarea", type: "textarea", title: "Description", required: false },
        {
          id: "select",
          type: "select",
          title: "Select",
          required: false,
          options: [{ id: "one", label: "One" }]
        },
        { id: "checkbox", type: "checkbox", title: "Agree", required: false },
        {
          id: "radio",
          type: "radio",
          title: "Choice",
          required: false,
          options: [
            { id: "one", label: "One" },
            { id: "two", label: "Two" }
          ]
        },
        { id: "rating", type: "rating", title: "Rating", required: false, min: 1, max: 3 }
      ]
    };

    render(<MuiContentRenderer schema={schema} locale="en" onSubmit={async () => undefined} />);

    expect(screen.getByRole("textbox", { name: "Text" }).closest(".MuiTextField-root")).not.toBeNull();
    expect(screen.getByRole("textbox", { name: "Description" }).tagName).toBe("TEXTAREA");
    expect(screen.getByRole("textbox", { name: "Description" })).not.toHaveAttribute("field");
    expect(screen.getByRole("combobox", { name: "Select" })).not.toHaveAttribute("field");
    expect(screen.getByRole("checkbox", { name: "Agree" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "One" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toHaveClass("MuiButton-root");
  });

  it("shows immediate quiz feedback and a final score", async () => {
    render(<MuiContentRenderer schema={quizSchema()} locale="en" onSubmit={async () => undefined} />);
    await userEvent.click(screen.getByRole("radio", { name: "Option 1" }));
    expect(document.querySelector('[data-option-id="option-1"]')).toHaveAttribute("data-selected", "true");
    expect(screen.getByText("Because it is correct.")).toBeInTheDocument();
    expect(screen.queryByText(/Total score:/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("Total score: 2 / 2")).toBeInTheDocument();
    expect(screen.getByText("Passed")).toBeInTheDocument();
  });

  it("shows the score without pass status when no passing score is configured", async () => {
    render(
      <MuiContentRenderer schema={quizSchema("after_submit", null)} locale="en" onSubmit={async () => undefined} />
    );
    await userEvent.click(screen.getByRole("radio", { name: "Option 1" }));
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("Submitted.")).toBeInTheDocument();
    expect(screen.getByText("Total score: 2 / 2")).toBeInTheDocument();
    expect(screen.queryByText("Passed")).not.toBeInTheDocument();
    expect(screen.queryByText("Not passed")).not.toBeInTheDocument();
  });

  it("forwards quiz share options to the default summary", async () => {
    const onShare = vi.fn();
    render(
      <MuiContentRenderer
        schema={quizSchema("after_submit")}
        locale="en"
        onSubmit={async () => undefined}
        contentModeOptions={{
          quiz: { share: { url: "https://example.test/quiz", onShare, buildText: () => "I scored 2 / 2" } }
        }}
      />
    );
    await userEvent.click(screen.getByRole("radio", { name: "Option 1" }));
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    await userEvent.click(await screen.findByRole("button", { name: "Share result" }));
    expect(onShare).toHaveBeenCalledWith({
      title: "Quiz",
      text: "I scored 2 / 2",
      url: "https://example.test/quiz"
    });
  });

  it("shows score in the standalone result view without a passing score", () => {
    render(<QuizResultView evaluation={{ totalScore: 2, maxPossibleScore: 2, questions: [] }} />);
    expect(screen.getByText("Total score: 2 / 2")).toBeInTheDocument();
    expect(screen.queryByText("Passed")).not.toBeInTheDocument();
  });

  it("renders a server evaluation and reward from the submit response", async () => {
    const evaluation = {
      totalScore: 0,
      maxPossibleScore: 2,
      isPassed: false,
      questions: [
        {
          questionId: "question-1",
          isCorrect: false,
          correctOptionId: "option-1",
          explanation: "Server explanation",
          scoreEarned: 0,
          maxScore: 2
        }
      ],
      reward: { type: "coupon" as const, code: "SAVE-20", message: "20% off" }
    };
    render(
      <MuiContentRenderer
        schema={quizSchema("after_submit")}
        locale="en"
        onSubmit={async () => ({ quizEvaluation: evaluation })}
      />
    );
    await userEvent.click(screen.getByRole("radio", { name: "Option 2" }));
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("SAVE-20")).toBeInTheDocument();
    expect(screen.getByText("Server explanation")).toBeInTheDocument();
    expect(screen.getByText("Total score: 0 / 2")).toBeInTheDocument();
  });

  it("rejects an invalid quiz schema before rendering", () => {
    const initial = createInitialSchemaByMode("quiz", { title: "Invalid", locale: "en" });
    const invalid = {
      ...initial,
      fields: initial.fields.map(({ metadata: _metadata, ...field }) => field)
    };
    expect(() => render(<MuiContentRenderer schema={invalid} locale="en" onSubmit={async () => undefined} />)).toThrow(
      "correct option"
    );
  });

  it("loads poll results only when the visibility rule allows it", async () => {
    const schema = createInitialSchemaByMode("poll", { title: "Poll", locale: "en" });
    const loadResults = vi.fn(async () => pollAnalytics(schema));
    render(
      <MuiContentRenderer
        schema={schema}
        locale="en"
        onSubmit={async () => undefined}
        contentModeOptions={{
          poll: { adapter: { loadResults, canVote: async () => true }, closed: false, canViewResults: true }
        }}
      />
    );
    expect(loadResults).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("radio", { name: "Option 1" }));
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    const firstResult = await screen.findByText("3 votes (75%)");
    expect(firstResult.closest("label")).toContainElement(screen.getByRole("radio", { name: "Option 1" }));
    expect(screen.queryByRole("heading", { name: "Poll results" })).not.toBeInTheDocument();
    expect(loadResults).toHaveBeenCalledOnce();
  });

  it("does not request private poll results", async () => {
    const initial = createInitialSchemaByMode("poll", { title: "Poll", locale: "en" });
    const schema = {
      ...initial,
      metadata: contentMetadataToJson({ mode: "poll", poll: { resultVisibility: "private" } })
    };
    const loadResults = vi.fn(async () => pollAnalytics(schema));
    render(
      <MuiContentRenderer
        schema={schema}
        locale="en"
        onSubmit={async () => undefined}
        contentModeOptions={{
          poll: { adapter: { loadResults, canVote: async () => true }, closed: true, canViewResults: true }
        }}
      />
    );
    await userEvent.click(screen.getByRole("radio", { name: "Option 1" }));
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(screen.getByText("Submitted.")).toBeInTheDocument());
    expect(loadResults).not.toHaveBeenCalled();
  });

  it("loads after-submit results immediately for an existing vote", async () => {
    const initial = createInitialSchemaByMode("poll", { title: "Poll", locale: "en" });
    const schema = {
      ...initial,
      metadata: contentMetadataToJson({ mode: "poll", poll: { resultVisibility: "after_submit" } })
    };
    const loadResults = vi.fn(async () => pollAnalytics(schema));
    render(
      <MuiContentRenderer
        schema={schema}
        locale="en"
        onSubmit={async () => undefined}
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
    const result = await screen.findByText("3 votes (75%)");
    expect(result.closest("label")).toContainElement(screen.getByRole("radio", { name: "Option 1" }));
    expect(loadResults).toHaveBeenCalledOnce();
  });

  it("keeps an explicit aggregate poll result override after the form", async () => {
    const schema = createInitialSchemaByMode("poll", { title: "Poll", locale: "en" });
    const loadResults = vi.fn(async () => pollAnalytics(schema));
    render(
      <MuiContentRenderer
        schema={schema}
        locale="en"
        onSubmit={async () => undefined}
        contentModeOptions={{
          poll: { adapter: { loadResults, canVote: async () => true }, closed: false, canViewResults: true }
        }}
        slots={{ renderPollResults: () => <p>Legacy poll result</p> }}
      />
    );
    await userEvent.click(screen.getByRole("radio", { name: "Option 1" }));
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("Legacy poll result")).toBeInTheDocument();
    expect(screen.queryByText("3 votes (75%)")).not.toBeInTheDocument();
  });

  it("respects explicit renderer slots", async () => {
    render(
      <MuiContentRenderer
        schema={quizSchema("after_submit")}
        locale="en"
        onSubmit={async () => undefined}
        slots={{
          renderCompletion: () => <p>Custom completion</p>,
          renderAfterForm: () => <p>Custom after form</p>
        }}
      />
    );
    expect(screen.getByText("Custom after form")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Option 1" }));
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("Custom completion")).toBeInTheDocument();
    expect(screen.queryByText(/Total score:/)).not.toBeInTheDocument();
  });
});

describe("MUI content result views", () => {
  it("shows a poll loading failure and retries it", async () => {
    const schema = createInitialSchemaByMode("poll", { title: "Poll", locale: "en" });
    const loadResults = vi
      .fn<() => Promise<FormAnalytics>>()
      .mockRejectedValueOnce(new Error("Unavailable"))
      .mockResolvedValueOnce(pollAnalytics(schema));
    render(
      <MuiPollResults
        schema={schema}
        adapter={{ loadResults, canVote: async () => true }}
        submitted
        closed={false}
        canViewResults
      />
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Unavailable");
    await userEvent.click(screen.getByRole("button", { name: "Retry results" }));
    expect(await screen.findByText("Poll results")).toBeInTheDocument();
    expect(loadResults).toHaveBeenCalledTimes(2);
  });

  it("loads standalone after-submit results for an existing vote", async () => {
    const initial = createInitialSchemaByMode("poll", { title: "Poll", locale: "en" });
    const schema = {
      ...initial,
      metadata: contentMetadataToJson({ mode: "poll", poll: { resultVisibility: "after_submit" } })
    };
    const loadResults = vi.fn(async () => pollAnalytics(schema));
    render(
      <MuiPollResults
        schema={schema}
        adapter={{ loadResults, canVote: async () => false }}
        submitted={false}
        alreadyVoted
        closed={false}
        canViewResults
      />
    );
    expect(await screen.findByText("Poll results")).toBeInTheDocument();
    expect(loadResults).toHaveBeenCalledOnce();
  });

  it("loads closed-only results after closing and reloads for a new revision", async () => {
    const initial = createInitialSchemaByMode("poll", { title: "Poll", locale: "en" });
    const schema = {
      ...initial,
      metadata: contentMetadataToJson({ mode: "poll", poll: { resultVisibility: "closed_only" } })
    };
    const loadResults = vi.fn(async () => pollAnalytics(schema));
    const adapter = { loadResults, canVote: async () => true };
    const view = render(
      <MuiPollResults
        schema={schema}
        adapter={adapter}
        submitted={false}
        closed={false}
        canViewResults
        submissionRevision={0}
      />
    );
    expect(loadResults).not.toHaveBeenCalled();
    view.rerender(
      <MuiPollResults
        schema={schema}
        adapter={adapter}
        submitted={false}
        closed
        canViewResults
        submissionRevision={0}
      />
    );
    await waitFor(() => expect(loadResults).toHaveBeenCalledOnce());
    view.rerender(
      <MuiPollResults
        schema={schema}
        adapter={adapter}
        submitted={false}
        closed
        canViewResults
        submissionRevision={1}
      />
    );
    await waitFor(() => expect(loadResults).toHaveBeenCalledTimes(2));
  });

  it("customizes quiz labels, slots and slotProps", () => {
    render(
      <QuizResultView
        evaluation={{
          totalScore: 1,
          maxPossibleScore: 2,
          isPassed: false,
          questions: [
            {
              questionId: "q1",
              isCorrect: false,
              correctOptionId: "answer",
              explanation: "Why",
              maxScore: 2,
              scoreEarned: 1
            }
          ]
        }}
        labels={{ notPassed: "Try again" }}
        slots={{ score: () => <p>Custom score</p> }}
        slotProps={{ status: { "data-testid": "quiz-status" }, questionCard: { variant: "outlined" } }}
      />
    );
    expect(screen.getByText("Custom score")).toBeInTheDocument();
    expect(screen.getByTestId("quiz-status")).toHaveTextContent("Try again");
    expect(screen.getByText("q1").closest(".MuiCard-root")).toHaveClass("MuiPaper-outlined");
  });

  it("uses custom translations and clamps poll progress", () => {
    const schema = createInitialSchemaByMode("poll", { title: "Poll", locale: "en" });
    const analytics = pollAnalytics(schema);
    const overflowing = {
      ...analytics,
      questions: analytics.questions.map((question) =>
        question.kind === "radio"
          ? { ...question, options: question.options.map((option) => ({ ...option, percentageOfSubmissions: 150 })) }
          : question
      )
    };
    render(
      <MuiPollResultView
        schema={schema}
        analytics={overflowing}
        i18n={{ locale: "ja", messages: { "content.results.pollResults": "集計結果" } }}
      />
    );
    expect(screen.getByText("集計結果")).toBeInTheDocument();
    for (const progress of screen.getAllByRole("progressbar")) expect(progress).toHaveAttribute("aria-valuenow", "100");
  });

  it("renders and submits optional radio text with the MUI slot", async () => {
    const schema: FormSchema = {
      id: "mui-radio-text",
      version: 1,
      title: "Radio text",
      defaultLocale: "en",
      supportedLocales: ["en"],
      fields: [
        {
          id: "choice",
          type: "radio",
          title: "Choice",
          required: true,
          options: [
            { id: "yes", label: "Yes" },
            { id: "other", label: "Other", textInput: true }
          ]
        }
      ]
    };
    const onSubmit = vi.fn(async () => undefined);
    render(<MuiContentRenderer schema={schema} locale="en" onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole("radio", { name: "Other" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Additional text for Other (optional)" }), "Details");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).toHaveBeenCalledWith({ choice: { optionId: "other", text: "Details" } }, expect.anything());
  });
});
