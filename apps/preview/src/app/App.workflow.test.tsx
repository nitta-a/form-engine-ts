import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "./App";
import { clearPreviewStorage } from "./app-test-helpers";

describe("customer survey workflow", () => {
  beforeEach(clearPreviewStorage);
  afterEach(cleanup);

  it("starts in the library and keeps keyboard navigation and browser history synchronized", async () => {
    window.history.replaceState(null, "", "/?mode=survey&campaign=customer");
    const user = userEvent.setup();
    render(<App />);
    const library = screen.getByRole("tab", { name: "Surveys" });
    expect(library).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { level: 1, name: "Surveys" })).toBeVisible();
    await user.click(library);
    await user.keyboard("{End}");
    const comparison = screen.getByRole("tab", { name: "Translation comparison" });
    expect(comparison).toHaveFocus();
    expect(comparison).toHaveAttribute("aria-selected", "true");
    expect(new URLSearchParams(window.location.search).get("view")).toBe("comparison");
    await user.keyboard("{Home}{ArrowDown}");
    const editor = screen.getByRole("tab", { name: "Survey editor" });
    expect(editor).toHaveFocus();
    expect(editor).toHaveAttribute("aria-selected", "true");
    expect(new URLSearchParams(window.location.search).get("view")).toBe("mui");
    expect(new URLSearchParams(window.location.search).get("campaign")).toBe("customer");
    await user.keyboard("{ArrowUp}");
    expect(library).toHaveFocus();
    expect(library).toHaveAttribute("aria-selected", "true");
    expect(new URLSearchParams(window.location.search).has("view")).toBe(false);
    act(() => {
      window.history.replaceState(null, "", "/?view=respondent&mode=survey&campaign=customer");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.getByRole("tab", { name: "Answer preview" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "Answer preview" })).toBeVisible();
    expect(library).toHaveAttribute("aria-selected", "false");
  });

  it("preserves an unfinished answer when reviewing insights and returning", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("tab", { name: "Answer preview" }));
    const respondent = within(screen.getByRole("tabpanel", { name: "Answer preview" }));
    await user.type(respondent.getByLabelText(/^Your name/), "Ada Lovelace");
    await user.click(screen.getByRole("tab", { name: "Responses & insights" }));
    expect(screen.getByRole("tabpanel", { name: "Responses & insights" })).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "Answer preview" }));
    expect(respondent.getByLabelText(/^Your name/)).toHaveValue("Ada Lovelace");
  });

  it("keeps an invalid editor draft across navigation and resumes preview after correction", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("tab", { name: "Survey editor" }));
    const editor = within(screen.getByRole("tabpanel", { name: "Survey editor" }));
    const title = editor.getByDisplayValue("サービスの満足度");
    await user.clear(title);
    expect(title).toHaveValue("");
    expect(editor.getByText(/Invalid changes are not saved/)).toBeVisible();
    expect(editor.getByText("The live preview will resume when the draft is valid.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Preview survey →" }));
    expect(within(screen.getByRole("tabpanel", { name: "Answer preview" })).getByLabelText(/^Your name/)).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "Advanced editor" }));
    expect(document.querySelectorAll("#builder-form-title")).toHaveLength(1);
    await user.click(screen.getByRole("tab", { name: "Survey editor" }));
    expect(document.querySelectorAll("#builder-form-title")).toHaveLength(1);
    const retainedTitle = editor.getByRole("textbox", { name: /^Form title/ });
    expect(retainedTitle).toHaveValue("");
    await user.type(retainedTitle, "Updated survey");
    expect(editor.queryByText(/Invalid changes are not saved/)).not.toBeInTheDocument();
    expect(editor.queryByText("The live preview will resume when the draft is valid.")).not.toBeInTheDocument();
    expect(retainedTitle).toHaveValue("Updated survey");
  });

  it("allows correction of an invalid draft in the advanced editor", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("tab", { name: "Advanced editor" }));
    const editor = within(screen.getByRole("tabpanel", { name: "Advanced editor" }));
    const title = editor.getByDisplayValue("サービスの満足度");
    await user.clear(title);
    expect(editor.getByText(/Invalid changes are not saved/)).toBeVisible();
    await user.type(title, "Recovered survey");
    expect(editor.queryByText(/Invalid changes are not saved/)).not.toBeInTheDocument();
    expect(title).toHaveValue("Recovered survey");
    await user.click(screen.getByRole("button", { name: "Preview survey →" }));
    expect(screen.getByRole("tabpanel", { name: "Answer preview" })).toBeVisible();
  });

  it("opens a saved library survey in the editor and carries its response into analytics", async () => {
    const user = userEvent.setup();
    const title = "Customer feedback workflow";
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Create form" }));
    const creation = within(screen.getByRole("dialog", { name: "Create a form" }));
    await user.click(creation.getByRole("button", { name: /Satisfaction survey/ }));
    await user.type(creation.getByLabelText("Title"), title);
    await user.click(creation.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByText("All changes saved")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Back to list" }));
    const savedSurvey = (await screen.findByRole("heading", { level: 3, name: title })).closest("article");
    if (savedSurvey === null) throw new Error("Expected a saved survey card.");
    await user.click(within(savedSurvey).getByRole("button", { name: "Use in workspace" }));
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Survey editor" })).toHaveAttribute("aria-selected", "true")
    );
    const editor = within(screen.getByRole("tabpanel", { name: "Survey editor" }));
    expect(editor.getByDisplayValue(title)).toBeVisible();
    expect(screen.getByRole("region", { name: "Current survey" })).toHaveTextContent(title);
    await user.click(screen.getByRole("button", { name: "Preview survey →" }));
    const respondent = within(screen.getByRole("tabpanel", { name: "Answer preview" }));
    expect(respondent.getByRole("heading", { name: title })).toBeVisible();
    await user.click(respondent.getByLabelText("4"));
    await user.type(respondent.getByLabelText("What should we improve?"), "Quicker support replies");
    await user.click(respondent.getByRole("button", { name: "Send response" }));
    await waitFor(() => expect(respondent.getByRole("status")).toHaveTextContent(/Response saved|Thank you/));
    await user.click(screen.getByRole("button", { name: "View responses →" }));
    const analytics = within(screen.getByRole("tabpanel", { name: "Responses & insights" }));
    expect(screen.getByRole("region", { name: "Current survey" })).toHaveTextContent(title);
    expect(analytics.getByText("Responses").previousElementSibling).toHaveTextContent("1");
    const inbox = within(analytics.getByRole("region", { name: "Individual responses" }));
    await user.click(inbox.getByText("Response #1"));
    expect(inbox.getByText("Quicker support replies")).toBeVisible();
    expect(inbox.getByText("Overall satisfaction")).toBeVisible();
  });
});
