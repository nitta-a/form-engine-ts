import type { AuthoringAssistantAdapter, CreationAssistantAdapter, FormSchema } from "@form-engine-ts/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { type SurveyAiCreationLabels, SurveyAiCreationPanel } from "../src";

const schema: FormSchema = {
  id: "ai-survey",
  version: 1,
  title: "Survey",
  fields: [{ id: "seed", type: "text", title: "Seed question", required: false }]
};

const labels: SurveyAiCreationLabels = {
  title: "Create survey with AI",
  conversation: "Conversation",
  assistant: "Assistant",
  user: "You",
  purposeInput: "Tell us what you want to learn",
  messageInput: "Tell us what you want to learn",
  send: "Send",
  retry: "Retry",
  cancel: "Cancel",
  generate: "Generate survey",
  generating: "Generating",
  applying: "Applying",
  error: (code) => `Error: ${code}`,
  brief: "Survey brief",
  audience: "Audience",
  questionCount: "Questions",
  notSet: "Not set",
  review: "Review survey",
  questionType: "Type",
  required: "Required",
  optional: "Optional",
  choices: "Choices",
  removeQuestion: "Remove question",
  preview: "Preview",
  previewTitle: "Respondent preview",
  closePreview: "Close preview",
  createSurvey: "Create survey",
  emptyQuestions: "No questions",
  fieldType: (type) => type
};

const readyResponse = {
  type: "ready" as const,
  message: "Ready to create.",
  brief: { purpose: "Customer feedback", audience: "Customers", constraints: { targetQuestionCount: 2 } }
};

describe("SurveyAiCreationPanel", () => {
  it("supports conversation, quick replies, labeled errors, and retry", async () => {
    const respond = vi
      .fn()
      .mockRejectedValueOnce(new Error("network timeout"))
      .mockResolvedValueOnce({
        type: "clarification" as const,
        message: "Who should answer?",
        brief: readyResponse.brief,
        missing: ["audience" as const],
        suggestions: [{ id: "audience", label: "Customers", value: "Customers" }]
      })
      .mockResolvedValueOnce(readyResponse);
    const creationAdapter: CreationAssistantAdapter = { respond };
    const authoringAdapter: AuthoringAssistantAdapter = { generate: vi.fn() };
    render(
      <SurveyAiCreationPanel
        initialSchema={schema}
        sourceLocale="en"
        creationAdapter={creationAdapter}
        authoringAdapter={authoringAdapter}
        labels={labels}
        onComplete={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText(labels.purposeInput), { target: { value: "Learn satisfaction" } });
    fireEvent.click(screen.getByRole("button", { name: labels.send }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("network_error"));
    fireEvent.click(screen.getByRole("button", { name: labels.retry }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Customers" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Customers" }));
    expect(respond).toHaveBeenCalledTimes(3);
  });

  it("shows the generated survey, removes a question, previews it, and completes", async () => {
    const onComplete = vi.fn();
    const authoringSuggestion = {
      id: "suggestion-2",
      summary: "Add questions",
      baseSchemaHash: "",
      operations: [
        {
          operationId: "add-question",
          type: "addField" as const,
          field: { type: "radio" as const, title: "Satisfaction", required: true, options: [{ label: "Good" }] }
        }
      ]
    };
    const creationAdapter: CreationAssistantAdapter = { respond: async () => readyResponse };
    const authoringAdapter: AuthoringAssistantAdapter = {
      generate: vi.fn(async ({ context }) => ({ ...authoringSuggestion, baseSchemaHash: context.schemaHash as string }))
    };
    render(
      <SurveyAiCreationPanel
        initialSchema={schema}
        sourceLocale="en"
        creationAdapter={creationAdapter}
        authoringAdapter={authoringAdapter}
        labels={labels}
        onComplete={onComplete}
      />
    );

    fireEvent.change(screen.getByLabelText(labels.purposeInput), { target: { value: "Create it" } });
    fireEvent.click(screen.getByRole("button", { name: labels.send }));
    await waitFor(() => expect(screen.getByRole("button", { name: labels.generate })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: labels.generate }));
    await waitFor(() => expect(screen.getByRole("heading", { name: labels.review })).toBeInTheDocument());
    expect(screen.getByText("Satisfaction")).toBeInTheDocument();
    expect(screen.getByText(/Type: radio/)).toBeInTheDocument();
    expect(screen.getByText(labels.choices)).toBeInTheDocument();
    expect(screen.getByText("Good")).toBeInTheDocument();
    const removeButtons = screen.getAllByRole("button", { name: labels.removeQuestion });
    const generatedQuestionRemoveButton = removeButtons[1];
    if (generatedQuestionRemoveButton === undefined) throw new Error("Expected generated question remove button.");
    fireEvent.click(generatedQuestionRemoveButton);
    const previewButton = screen.getByRole("button", { name: labels.preview });
    previewButton.focus();
    fireEvent.click(previewButton);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: labels.closePreview })).toHaveFocus());
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(previewButton).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: labels.createSurvey }));
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ fields: [expect.objectContaining({ id: "seed" })] })
    );
  });
});
