import {
  type AuthoringPreview,
  type AuthoringSuggestion,
  computeAuthoringSchemaHash,
  createInitialSchemaByMode
} from "@form-engine-ts/core";
import { FormEngineI18nProvider } from "@form-engine-ts/react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MuiAuthoringFieldAction, MuiAuthoringPrompt, MuiAuthoringSuggestionPreview } from "../src/authoring";

const schema = createInitialSchemaByMode("survey", { id: "mui-authoring", title: "Survey", locale: "en" });
const suggestion: AuthoringSuggestion = {
  id: "s1",
  summary: "Add one question",
  baseSchemaHash: computeAuthoringSchemaHash(schema),
  operations: [
    { operationId: "one", type: "updateForm", patch: { title: "Updated" } },
    { operationId: "two", type: "updateForm", patch: { description: "Description" } }
  ]
};
const preview: AuthoringPreview = {
  valid: true,
  baseSchemaHash: suggestion.baseSchemaHash,
  schema,
  operations: suggestion.operations,
  operationPreviews: suggestion.operations.map((operation) => ({
    operationId: operation.operationId,
    operation,
    valid: true,
    issues: []
  })),
  issues: []
};

describe("authoring MUI components", () => {
  it("submits a prompt and applies a selected operation", () => {
    const onSubmit = vi.fn();
    render(<MuiAuthoringPrompt onSubmit={onSubmit} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Create a survey" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask AI" }));
    expect(onSubmit).toHaveBeenCalledWith({ intent: "add_questions", prompt: "Create a survey" });

    const onApply = vi.fn();
    render(
      <MuiAuthoringSuggestionPreview suggestion={suggestion} preview={preview} onApply={onApply} onReject={vi.fn()} />
    );
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(3);
    const secondCheckbox = checkboxes.slice(1, 2)[0];
    if (secondCheckbox === undefined) throw new Error("Expected an operation checkbox.");
    fireEvent.click(secondCheckbox);
    fireEvent.click(screen.getByRole("button", { name: "Apply selected" }));
    expect(onApply).toHaveBeenCalledWith(["two"]);
  });

  it("builds intent and target-aware requests", () => {
    const onSubmit = vi.fn();
    render(<MuiAuthoringPrompt onSubmit={onSubmit} intent="rewrite_field" target={{ kind: "field", fieldId: "q1" }} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Shorten it" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask AI" }));
    expect(onSubmit).toHaveBeenCalledWith({
      intent: "rewrite_field",
      prompt: "Shorten it",
      target: { kind: "field", fieldId: "q1" }
    });

    const customSubmit = vi.fn();
    render(
      <MuiAuthoringPrompt
        onSubmit={customSubmit}
        createRequest={(prompt) => ({ intent: "generate_form", prompt, context: { source: "custom" } })}
      />
    );
    const textboxes = screen.getAllByRole("textbox");
    const customTextbox = textboxes.slice(-1)[0];
    const customButton = screen.getAllByRole("button", { name: "Ask AI" }).slice(-1)[0];
    if (customTextbox === undefined || customButton === undefined) throw new Error("Expected custom prompt controls.");
    fireEvent.change(customTextbox, { target: { value: "Custom request" } });
    fireEvent.click(customButton);
    expect(customSubmit).toHaveBeenCalledWith({
      intent: "generate_form",
      prompt: "Custom request",
      context: { source: "custom" }
    });
  });

  it("supports localized labels and field actions", () => {
    const onSubmit = vi.fn();
    render(
      <FormEngineI18nProvider locale="ja">
        <MuiAuthoringPrompt onSubmit={onSubmit} />
      </FormEngineI18nProvider>
    );
    expect(screen.getByLabelText("フォームの変更内容を入力")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AIに依頼" })).toBeInTheDocument();

    const onRequest = vi.fn();
    render(
      <MuiAuthoringFieldAction
        field={{ id: "q1", type: "text", title: "Question", required: false }}
        onRequest={onRequest}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "✨ AI" }));
    fireEvent.click(screen.getByRole("button", { name: "Generate answer options" }));
    expect(onRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        intent: "generate_options",
        target: { kind: "field", fieldId: "q1" }
      })
    );
  });
});
