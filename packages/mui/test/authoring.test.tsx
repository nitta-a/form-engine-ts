import {
  type AuthoringPreview,
  type AuthoringSuggestion,
  computeAuthoringSchemaHash,
  createInitialSchemaByMode
} from "@form-engine-ts/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MuiAuthoringPrompt, MuiAuthoringSuggestionPreview } from "../src/authoring";

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
    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    fireEvent.click(screen.getByRole("button", { name: "Apply selected" }));
    expect(onApply).toHaveBeenCalledWith(["two"]);
  });
});
