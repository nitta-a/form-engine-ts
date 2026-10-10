import { type FormSchema, type FormSubmission, resolveLocalizedSchema } from "@form-engine-ts/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { ResponseInbox } from "./ResponseInbox";

const schema: FormSchema = {
  id: "feedback",
  version: 1,
  title: "Feedback",
  defaultLocale: "en",
  fields: [
    {
      id: "team",
      type: "radio",
      title: "Team",
      required: false,
      translations: { ja: { title: "担当チーム" } },
      options: [
        { id: "support", label: "Support", translations: { ja: "サポート" } },
        { id: "sales", label: "Sales", translations: { ja: "営業" } }
      ]
    },
    { id: "comment", type: "textarea", title: "Comment", required: false },
    {
      id: "hidden",
      type: "text",
      title: "Hidden",
      required: false,
      displayCondition: { questionId: "team", operator: "equals", value: "sales" }
    }
  ]
};

const submissions: readonly FormSubmission[] = [
  {
    id: "response-one",
    formId: "feedback",
    formVersion: 1,
    locale: "en",
    submittedAt: "2026-01-01T10:00:00Z",
    values: { team: "support", comment: "Helpful staff", hidden: "private hidden value" },
    metadata: { source: "sample" }
  },
  {
    id: "response-two",
    formId: "feedback",
    formVersion: 1,
    locale: "ja",
    submittedAt: "2026-01-02T10:00:00Z",
    values: { team: "sales", comment: "Easy to understand" }
  }
];

describe("individual customer responses", () => {
  it("searches visible answers using choice labels, filters language and clears filters", () => {
    render(<ResponseInbox schema={schema} submissions={submissions} locale="en" />);
    expect(screen.getByText("Sample data")).toBeInTheDocument();
    expect(screen.queryByText("private hidden value")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search responses"), { target: { value: "SUPPORT" } });
    expect(screen.getByText("Response #1")).toBeInTheDocument();
    expect(screen.queryByText("Response #2")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Response language"), { target: { value: "ja" } });
    expect(screen.getByText("No responses match your search.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText("Response #2")).toBeInTheDocument();
    expect(screen.getByText("Response #1")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search responses"), { target: { value: "private hidden" } });
    expect(screen.getByText("No responses match your search.")).toBeInTheDocument();
  });

  it("shows localized question and option labels and finds a response by ID", () => {
    render(<ResponseInbox schema={resolveLocalizedSchema(schema, "ja")} submissions={submissions} locale="ja" />);
    fireEvent.change(screen.getByLabelText("回答を検索"), { target: { value: "response-one" } });
    expect(screen.getByText("回答 #1")).toBeInTheDocument();
    fireEvent.click(screen.getByText("回答 #1"));
    expect(screen.getByText("担当チーム")).toBeVisible();
    expect(screen.getByText("サポート")).toBeVisible();
    expect(screen.getByText("サンプルデータ")).toBeInTheDocument();
  });

  it("explains an empty response collection", () => {
    render(<ResponseInbox schema={schema} submissions={[]} locale="en" />);
    expect(screen.getByText("Saved responses will appear here.")).toBeInTheDocument();
    expect(screen.getByLabelText("Response language")).toHaveValue("");
  });
});
