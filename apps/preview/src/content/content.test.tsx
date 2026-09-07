import { contentMetadataToJson, createInitialSchemaByMode } from "@form-engine-ts/core";
import { createMemoryStorageAdapter } from "@form-engine-ts/storage-memory";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import App from "../app/App";
import { ContentAnswer } from "./ContentAnswer";

describe("content mode demo", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, "", "/");
  });
  it("creates a poll, blocks adding another question, saves and shows current results", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("tab", { name: "Forms" }));
    await user.click(screen.getByRole("button", { name: "Create form" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.click(dialog.getByRole("button", { name: "Poll" }));
    await user.type(dialog.getByLabelText("Title"), "Lunch vote");
    await user.click(dialog.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Add question" })).toBeDisabled();
    expect(screen.getByText("Polls have exactly one question.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("button", { name: "Open answer screen" }));
    await user.click(screen.getByRole("radio", { name: "Option 1" }));
    await user.click(screen.getByRole("button", { name: "Send response" }));
    await waitFor(() => expect(screen.getAllByRole("progressbar")).toHaveLength(2));
    expect(screen.getAllByRole("progressbar")[0]).toHaveAttribute("aria-valuenow", "100");
    await user.click(screen.getByRole("button", { name: "Back to list" }));
    await user.click(screen.getByRole("tab", { name: "Quiz" }));
    expect(window.location.search).toBe("?mode=quiz");
    expect(screen.queryByRole("button", { name: /Lunch vote/ })).not.toBeInTheDocument();
    await act(async () => {
      window.history.replaceState(null, "", "/?mode=poll");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.getByRole("button", { name: /Lunch vote/ })).toBeVisible();
  });
  it("edits quiz correctness and explanation then renders the submitted result", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("tab", { name: "Forms" }));
    await user.click(screen.getByRole("button", { name: "Create form" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.click(dialog.getByRole("button", { name: "Quiz" }));
    await user.type(dialog.getByLabelText("Title"), "Trivia");
    await user.click(dialog.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(screen.getByRole("radio", { name: "Correct answer: Option 2" }));
    await user.type(screen.getByLabelText("Explanation"), "A useful fact");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Open answer screen" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Open answer screen" }));
    await user.click(screen.getByRole("radio", { name: "Option 2" }));
    expect(screen.queryByText("A useful fact")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Send response" }));
    await waitFor(() => expect(screen.getByText("A useful fact")).toBeVisible());
    expect(screen.getByText("Total score: 1 / 1")).toBeVisible();
  });
  it("supports immediate feedback and keeps submission errors separate", async () => {
    const user = userEvent.setup();
    const preset = createInitialSchemaByMode("quiz", { title: "Quiz", locale: "en" });
    const schema = {
      ...preset,
      metadata: { mode: "quiz", quiz: { showExplanation: "immediate" } },
      fields: preset.fields.map((field) => ({
        ...field,
        metadata: contentMetadataToJson({ quiz: { correctOptionId: "option-1", explanation: "Instant fact" } })
      }))
    };
    render(<ContentAnswer schema={schema} locale="en" storage={createMemoryStorageAdapter()} />);
    await user.click(screen.getByRole("radio", { name: "Option 1" }));
    expect(screen.getByText("Instant fact")).toBeVisible();
    expect(screen.getByText("Correct", { exact: true })).toBeVisible();
    await user.click(screen.getByRole("radio", { name: "Option 2" }));
    expect(screen.getByText("Incorrect", { exact: true })).toBeVisible();
    fireEvent.click(screen.getByLabelText("Simulate submission error"));
    await user.click(screen.getByRole("button", { name: "Send response" }));
    await waitFor(() => expect(screen.getByText("Submission failed")).toBeVisible());
    expect(screen.queryByText("Submitted.")).not.toBeInTheDocument();
  });
});
