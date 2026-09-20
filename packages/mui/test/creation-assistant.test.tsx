import {
  type AuthoringAssistantAdapter,
  type CreationAssistantAdapter,
  createInitialSchemaByMode
} from "@form-engine-ts/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MuiFormCreationAssistant } from "../src/authoring";

describe("MuiFormCreationAssistant", () => {
  it("shows conversation, quick replies, and the structured brief", async () => {
    const creationAdapter: CreationAssistantAdapter = {
      respond: async ({ latestMessage }) => ({
        type: "clarification",
        message: "Who will answer?",
        brief: { purpose: latestMessage },
        missing: ["audience"],
        suggestions: [{ id: "employees", label: "Employees", value: "Employees" }]
      })
    };
    const authoringAdapter: AuthoringAssistantAdapter = {
      generate: async () => {
        throw new Error("not used");
      }
    };
    render(
      <MuiFormCreationAssistant
        creationAdapter={creationAdapter}
        authoringAdapter={authoringAdapter}
        initialSchema={createInitialSchemaByMode("survey", { title: "Survey", locale: "en" })}
      />
    );
    fireEvent.change(screen.getByLabelText("Tell us what you want to learn"), { target: { value: "Learn more" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(screen.getByText("Who will answer?")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Employees" })).toBeInTheDocument();
    expect(screen.getByText("Purpose: Learn more")).toBeInTheDocument();
  });

  it("reviews and applies a generated draft, including a revision request", async () => {
    const creationAdapter: CreationAssistantAdapter = {
      respond: async ({ latestMessage }) => ({
        type: "ready",
        message: "Ready",
        brief: { purpose: latestMessage, audience: "Employees" }
      })
    };
    const authoringAdapter: AuthoringAssistantAdapter = {
      generate: async (request) => ({
        id: "draft",
        summary: "Draft",
        baseSchemaHash: typeof request.context?.schemaHash === "string" ? request.context.schemaHash : "",
        operations: [{ operationId: "question", type: "addField", field: { type: "text", title: "Question" } }]
      })
    };
    render(
      <MuiFormCreationAssistant
        creationAdapter={creationAdapter}
        authoringAdapter={authoringAdapter}
        initialSchema={createInitialSchemaByMode("survey", { title: "Survey", locale: "en" })}
      />
    );
    fireEvent.change(screen.getByLabelText("Tell us what you want to learn"), { target: { value: "Learn more" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(screen.getByText("Ready")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Create with this information" }));
    await waitFor(() => expect(screen.getByRole("region", { name: "Draft review" })).toBeInTheDocument());
    expect(screen.getByText("Question (text)")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Ask AI to revise this draft"), { target: { value: "Make it clearer" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask AI" }));
    await waitFor(() => expect(screen.getByRole("region", { name: "Draft review" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Open in editor" })).toBeInTheDocument();
  });

  it("allows conversation and draft review slots to replace the defaults", async () => {
    const creationAdapter: CreationAssistantAdapter = {
      respond: async () => ({ type: "ready", message: "Ready", brief: { purpose: "Learn", audience: "Users" } })
    };
    const authoringAdapter: AuthoringAssistantAdapter = {
      generate: async (request) => ({
        id: "draft",
        summary: "Draft",
        baseSchemaHash: typeof request.context?.schemaHash === "string" ? request.context.schemaHash : "",
        operations: []
      })
    };
    render(
      <MuiFormCreationAssistant
        creationAdapter={creationAdapter}
        authoringAdapter={authoringAdapter}
        initialSchema={createInitialSchemaByMode("survey", { title: "Survey", locale: "en" })}
        renderConversation={(assistant) => (
          <div>
            Custom conversation
            <button type="button" onClick={() => void assistant.sendMessage("Learn")}>
              Start
            </button>
          </div>
        )}
        renderBrief={() => <div>Custom brief</div>}
      />
    );
    expect(screen.getByText("Custom conversation")).toBeInTheDocument();
    expect(screen.getByText("Custom brief")).toBeInTheDocument();
  });
});
