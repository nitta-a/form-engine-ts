import type { FormSchema } from "@form-engine-ts/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MuiSurveyResponseSummaryDomain } from "../src";

const schema: FormSchema = {
  id: "customer-survey",
  version: 1,
  title: "Customer survey",
  defaultLocale: "en",
  supportedLocales: ["en", "ja"],
  fields: [
    {
      id: "satisfaction",
      type: "radio",
      title: "Satisfaction",
      required: false,
      options: [
        { id: "good", label: "Good" },
        { id: "bad", label: "Bad" }
      ]
    },
    { id: "score", type: "number", title: "Score", required: false },
    { id: "rating", type: "rating", title: "Rating", required: false },
    { id: "recommend", type: "checkbox", title: "Recommend", required: false }
  ]
};

const adapter = {
  toSummaryInput: () => ({
    questions: [
      {
        fieldId: "satisfaction",
        kind: "radio" as const,
        answeredCount: 3,
        unansweredCount: 0,
        options: [
          { id: "good", count: 3, percentageOfSubmissions: 100 },
          { id: "bad", count: 0, percentageOfSubmissions: -10 }
        ]
      },
      {
        fieldId: "score",
        kind: "number" as const,
        answeredCount: 2,
        unansweredCount: 1,
        average: 2.5,
        minimum: 1,
        maximum: 4,
        total: 5
      },
      {
        fieldId: "rating",
        kind: "rating" as const,
        answeredCount: 0,
        unansweredCount: 3,
        average: null,
        minimum: null,
        maximum: null,
        total: 0
      },
      {
        fieldId: "recommend",
        kind: "checkbox" as const,
        answeredCount: 3,
        unansweredCount: 0,
        trueCount: 2,
        falseCount: 1,
        truePercentageOfSubmissions: 200,
        falsePercentageOfSubmissions: 0
      }
    ]
  }),
  toFormSchema: () => schema,
  sourceLanguage: () => "ja-JP",
  mapSkipReasons: () => [{ reason: "not-applicable", count: 1234 }]
};

describe("@form-engine-ts/mui response summary", () => {
  it("renders question cards, progress bars, statistics cards, and skip reasons", () => {
    const { container } = render(
      <MuiSurveyResponseSummaryDomain
        summary={{ aggregate: "maker-summary" }}
        version={{ id: "version" }}
        domainAdapter={adapter}
        locale="de-DE"
        labels={{
          languages: "言語",
          answered: "回答済み",
          unanswered: "未回答",
          options: "選択肢",
          statistics: "集計",
          average: "平均",
          minimum: "最小",
          maximum: "最大",
          total: "合計",
          checked: "チェック済み",
          unchecked: "未チェック",
          skipReasons: "スキップ理由"
        }}
        slotProps={{ questionCard: { "data-testid": "mui-question-card" } }}
      />
    );

    expect(container.querySelectorAll('[data-mui-slot="response-summary-question"]')).toHaveLength(4);
    expect(screen.getAllByTestId("mui-question-card")).toHaveLength(4);
    expect(container.querySelector('[data-mui-slot="response-summary-skip-reasons"]')).toBeInTheDocument();
    expect(screen.getByText("選択肢")).toBeInTheDocument();
    expect(screen.getAllByText("平均")).toHaveLength(2);
    expect(screen.getByText("チェック済み")).toBeInTheDocument();
    expect(screen.getByText("スキップ理由")).toBeInTheDocument();
    expect(screen.getByText("1.234")).toBeInTheDocument();
    expect(screen.getByText("2,5")).toBeInTheDocument();

    const progressBars = screen.getAllByRole("progressbar");
    expect(progressBars).toHaveLength(2);
    expect(progressBars[0]).toHaveAttribute("aria-valuenow", "100");
    expect(progressBars[1]).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getAllByText("—")).toHaveLength(3);
  });

  it("allows MUI slot overrides without changing the existing aggregate shape", () => {
    const question = vi.fn(() => <div data-testid="mui-question-slot">Custom question</div>);
    const skipReasons = vi.fn(() => <div data-testid="mui-skip-slot">Custom reasons</div>);

    render(
      <MuiSurveyResponseSummaryDomain
        summary={{ aggregate: "maker-summary" }}
        version={{ id: "version" }}
        domainAdapter={adapter}
        slots={{ question, skipReasons }}
      />
    );

    expect(screen.getAllByTestId("mui-question-slot")).toHaveLength(4);
    expect(screen.getByTestId("mui-skip-slot")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(question).toHaveBeenCalledWith(expect.objectContaining({ fieldId: "satisfaction" }));
    expect(skipReasons).toHaveBeenCalledWith([{ reason: "not-applicable", count: 1234 }]);
  });

  it("renders and switches between the all-languages and language tabs", async () => {
    const user = userEvent.setup();
    const languageAdapter = {
      toSummaryInput: ({ answeredCount }: { readonly answeredCount: number }) => ({
        questions: [
          {
            fieldId: "satisfaction",
            kind: "radio" as const,
            answeredCount,
            unansweredCount: 4 - answeredCount,
            options: []
          }
        ]
      }),
      toFormSchema: () => schema,
      sourceLanguage: () => "en",
      mapLanguages: ({ summary: current }: { readonly summary: { readonly answeredCount: number } }) => [
        { language: "en", submissionCount: 1, summary: { questions: [] } },
        {
          language: "ja",
          submissionCount: 3,
          summary: {
            questions: [
              {
                fieldId: "satisfaction",
                kind: "radio" as const,
                answeredCount: current.answeredCount - 1,
                unansweredCount: 5 - current.answeredCount,
                options: []
              }
            ]
          }
        }
      ]
    };

    render(
      <MuiSurveyResponseSummaryDomain
        summary={{ answeredCount: 4 }}
        version={{ id: "version" }}
        domainAdapter={languageAdapter}
        locale="ja-JP"
        labels={{ languages: "言語" }}
      />
    );

    const allTab = screen.getByRole("tab", { name: "全言語 (4)" });
    expect(allTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "en (1)" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: "ja (3)" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByText("Answered").nextElementSibling).toHaveTextContent("4");

    await user.click(screen.getByRole("tab", { name: "ja (3)" }));

    expect(allTab).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: "ja (3)" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Answered").nextElementSibling).toHaveTextContent("3");
  });
});
