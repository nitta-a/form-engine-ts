import { contentMetadataToJson, createInitialSchemaByMode, type FormSchema } from "@form-engine-ts/core";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, describe, expect, it } from "vitest";
import { ContentRenderer } from "../src";

function schema(showExplanation: "immediate" | "after_submit" = "immediate", locale = "en"): FormSchema {
  const base = createInitialSchemaByMode("quiz", { title: locale === "ja" ? "クイズ" : "Quiz", locale });
  return {
    ...base,
    metadata: contentMetadataToJson({ mode: "quiz", quiz: { showExplanation, passingScore: 1 } }),
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
