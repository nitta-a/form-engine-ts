import { type FormSchema, resolveLocalizedSchema } from "@form-engine-ts/core";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PreviewWorkspaceProvider } from "../workspace/PreviewWorkspaceContext";
import { customerFeedbackSchema } from "../workspace/schema";
import { ContentEditor } from "./ContentEditor";
import { ContentLibrary } from "./ContentLibrary";

describe("customer survey library", () => {
  afterEach(cleanup);
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("searches localized titles and descriptions and clears an empty result", async () => {
    const user = userEvent.setup();
    render(<ContentLibrary />, { wrapper: PreviewWorkspaceProvider });
    const title = resolveLocalizedSchema(customerFeedbackSchema, "en").title;
    await screen.findByRole("button", { name: title });
    await user.type(screen.getByLabelText("Search surveys"), title.toUpperCase());
    expect(screen.getByRole("button", { name: title })).toBeVisible();
    await user.clear(screen.getByLabelText("Search surveys"));
    await user.type(screen.getByLabelText("Search surveys"), "NO MATCH");
    expect(screen.queryByRole("button", { name: title })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No surveys found" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByRole("button", { name: title })).toBeVisible();
  });

  it("opens a saved form in the workspace and calls the navigation callback", async () => {
    const user = userEvent.setup();
    const onOpenWorkspace = vi.fn();
    render(<ContentLibrary onOpenWorkspace={onOpenWorkspace} />, { wrapper: PreviewWorkspaceProvider });
    const title = resolveLocalizedSchema(customerFeedbackSchema, "en").title;
    const cardButton = await screen.findByRole("button", { name: title });
    const card = cardButton.closest("article");
    if (card === null) throw new Error("Expected a survey card");
    await user.click(within(card).getByRole("button", { name: "Use in workspace" }));
    await waitFor(() => expect(onOpenWorkspace).toHaveBeenCalledOnce());
  });

  it("starts from the satisfaction template and requires saving before answering", async () => {
    const user = userEvent.setup();
    render(<ContentLibrary />, { wrapper: PreviewWorkspaceProvider });
    await user.click(screen.getByRole("button", { name: "Use satisfaction template" }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByLabelText("Title")).toHaveValue("Customer satisfaction survey");
    expect(dialog.getByRole("button", { name: /Satisfaction survey/ })).toHaveAttribute("aria-pressed", "true");
    await user.click(dialog.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Overall satisfaction" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Open answer screen" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Use in workspace" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Open answer screen" })).toBeEnabled());
  });

  it("shows a failed save and permits retrying without treating the draft as saved", async () => {
    const user = userEvent.setup();
    const draft: FormSchema = {
      id: "draft",
      version: 1,
      title: "Customer feedback",
      fields: [{ id: "rating", type: "rating", title: "Overall satisfaction", required: true, min: 1, max: 5 }]
    };
    const save = vi.fn().mockRejectedValueOnce(new Error("Storage is full")).mockResolvedValueOnce(undefined);
    render(<ContentEditor schema={draft} locale="en" initiallySaved={false} save={save} onAnswer={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Storage is full"));
    expect(screen.getByRole("button", { name: "Open answer screen" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Open answer screen" })).toBeEnabled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("keeps an unsaved survey until the user explicitly discards its changes", async () => {
    const user = userEvent.setup();
    render(<ContentLibrary />, { wrapper: PreviewWorkspaceProvider });
    await user.click(screen.getByRole("button", { name: "Use satisfaction template" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Create" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Back to list" }));
    expect(screen.getByRole("dialog", { name: "Discard changes?" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Continue editing" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Overall satisfaction" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Back to list" }));
    await user.click(screen.getByRole("button", { name: "Discard changes" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Survey library" })).toBeVisible());
    expect(screen.queryByRole("button", { name: "Customer satisfaction survey" })).not.toBeInTheDocument();
  });

  it("requires explicit discard before changing storage with an unsaved survey", async () => {
    const user = userEvent.setup();
    render(<ContentLibrary />, { wrapper: PreviewWorkspaceProvider });
    await user.click(screen.getByRole("button", { name: "Use satisfaction template" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Create" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(screen.getByText("Demo storage"));
    await user.click(screen.getByLabelText("LocalStorage"));
    expect(screen.getByRole("dialog", { name: "Discard changes?" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Continue editing" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByLabelText("LocalStorage")).not.toBeChecked();
    expect(screen.getByRole("heading", { name: "Overall satisfaction" })).toBeVisible();
    await user.click(screen.getByLabelText("LocalStorage"));
    await user.click(screen.getByRole("button", { name: "Discard changes" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Survey library" })).toBeVisible());
    expect(screen.getByLabelText("LocalStorage")).toBeChecked();
  });

  it("unmounts the hidden builder while preserving its unsaved questions when the library is reactivated", async () => {
    const user = userEvent.setup();
    const view = render(<ContentLibrary active />, { wrapper: PreviewWorkspaceProvider });
    await user.click(screen.getByRole("button", { name: "Use satisfaction template" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Create" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.clear(screen.getByRole("textbox", { name: /Form title/ }));
    await user.type(screen.getByRole("textbox", { name: /Form title/ }), "Edited customer survey");
    view.rerender(<ContentLibrary active={false} />);
    expect(screen.queryByRole("textbox", { name: /Form title/ })).not.toBeInTheDocument();
    view.rerender(<ContentLibrary active />);
    expect(screen.getByRole("textbox", { name: /Form title/ })).toHaveValue("Edited customer survey");
    expect(screen.getByRole("heading", { name: "Overall satisfaction" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Open answer screen" })).toBeDisabled();
  });
});
