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
    const onSelectionChange = vi.fn();
    render(
      <MuiAuthoringSuggestionPreview
        suggestion={suggestion}
        preview={preview}
        selectedOperationIds={["one", "two"]}
        onSelectionChange={onSelectionChange}
        onApply={onApply}
        onReject={vi.fn()}
      />
    );
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(3);
    const secondCheckbox = checkboxes.slice(1, 2)[0];
    if (secondCheckbox === undefined) throw new Error("Expected an operation checkbox.");
    fireEvent.click(secondCheckbox);
    expect(onSelectionChange).toHaveBeenCalledWith(["two"]);

    const apply = vi.fn();
    render(
      <MuiAuthoringSuggestionPreview
        suggestion={suggestion}
        preview={preview}
        selectedOperationIds={["two"]}
        onSelectionChange={vi.fn()}
        onApply={apply}
        onReject={vi.fn()}
      />
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Apply selected" }).at(-1) as HTMLElement);
    expect(apply).toHaveBeenCalledWith(["two"]);
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
    expect(screen.queryByRole("button", { name: "Generate answer options" })).not.toBeInTheDocument();
    render(
      <MuiAuthoringFieldAction
        field={{ id: "q1", type: "radio", title: "Question", required: false, options: [] }}
        onRequest={onRequest}
      />
    );
    fireEvent.click(screen.getAllByRole("button", { name: "✨ AI" }).at(-1) as HTMLElement);
    fireEvent.click(screen.getAllByRole("button", { name: "Generate answer options" }).at(-1) as HTMLElement);
    expect(onRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        intent: "generate_options",
        target: { kind: "field", fieldId: "q1" }
      })
    );
  });

  it("shows readable deltas and disables invalid operations", () => {
    const update = {
      operationId: "rewrite",
      type: "updateField" as const,
      fieldId: "q1",
      patch: { title: "Updated question", required: true }
    };
    const invalid = {
      operationId: "invalid",
      type: "updateField" as const,
      fieldId: "missing",
      patch: { title: "Missing" }
    };
    const fieldSuggestion: AuthoringSuggestion = { ...suggestion, operations: [update, invalid] };
    const fieldPreview: AuthoringPreview = {
      ...preview,
      operations: [update],
      valid: true,
      operationPreviews: [
        {
          operationId: "rewrite",
          operation: update,
          valid: true,
          before: { kind: "field", field: { id: "q1", type: "text", title: "Question", required: false } },
          after: { kind: "field", field: { id: "q1", type: "text", title: "Updated question", required: true } },
          issues: []
        },
        {
          operationId: "invalid",
          operation: invalid,
          valid: false,
          issues: [{ code: "field_not_found", message: "Missing" }]
        }
      ],
      issues: []
    };
    render(
      <MuiAuthoringSuggestionPreview
        suggestion={fieldSuggestion}
        preview={fieldPreview}
        selectedOperationIds={["rewrite"]}
        onSelectionChange={vi.fn()}
        onApply={vi.fn()}
        onReject={vi.fn()}
      />
    );
    expect(screen.getByText(/Updated question/u)).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")[2]).toBeDisabled();
  });

  it("localizes preview properties, boolean values, and added options", () => {
    const add: AuthoringSuggestion = {
      ...suggestion,
      operations: [
        {
          operationId: "add-choice",
          type: "addField",
          field: {
            type: "radio",
            title: "満足度",
            required: true,
            options: [{ label: "満足" }, { label: "不満" }]
          }
        }
      ]
    };
    const addOperation = add.operations[0];
    if (addOperation === undefined) throw new Error("Expected an add-field operation.");
    const addPreview: AuthoringPreview = {
      ...preview,
      operations: add.operations,
      operationPreviews: [{ operationId: "add-choice", operation: addOperation, valid: true, issues: [] }]
    };
    render(
      <FormEngineI18nProvider locale="ja">
        <MuiAuthoringSuggestionPreview
          suggestion={add}
          preview={addPreview}
          selectedOperationIds={["add-choice"]}
          onSelectionChange={vi.fn()}
          onApply={vi.fn()}
          onReject={vi.fn()}
        />
      </FormEngineI18nProvider>
    );
    expect(screen.getByRole("region", { name: "AI提案のプレビュー" })).toBeInTheDocument();
    expect(screen.getByText("質問形式")).toBeInTheDocument();
    expect(screen.getByText("質問文")).toBeInTheDocument();
    expect(screen.getByText("必須回答")).toBeInTheDocument();
    expect(screen.getAllByText("選択肢")).toHaveLength(2);
    expect(screen.getByText(/単一選択/u)).toBeInTheDocument();
  });
});
