import { createInitialSchemaByMode } from "@form-engine-ts/core";
import { createMemoryStorageAdapter } from "@form-engine-ts/storage-memory";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContentAnswer } from "./ContentAnswer";

describe("poll publication and vote persistence", () => {
  beforeEach(() => localStorage.clear());
  it.each(["always", "closed_only", "private", "after_submit"] as const)(
    "applies %s before and after submission",
    async (resultVisibility) => {
      const user = userEvent.setup();
      const storage = createMemoryStorageAdapter();
      const schema = {
        ...createInitialSchemaByMode("poll", { title: "Poll", locale: "en" }),
        metadata: { mode: "poll", poll: { resultVisibility } }
      };
      await storage.saveSchema(schema);
      const query = vi.spyOn(storage, "listSubmissions");
      render(<ContentAnswer schema={schema} locale="en" storage={storage} />);
      if (resultVisibility === "always")
        await waitFor(() => expect(screen.getAllByRole("progressbar")).toHaveLength(2));
      else expect(query).not.toHaveBeenCalled();
      await user.click(screen.getByRole("radio", { name: "Option 1" }));
      await user.click(screen.getByRole("button", { name: "Send response" }));
      await waitFor(() => expect(screen.getByText("Submitted.")).toBeVisible());
      if (resultVisibility === "always" || resultVisibility === "after_submit")
        await waitFor(() => expect(screen.getAllByRole("progressbar")[0]).toHaveAttribute("aria-valuenow", "100"));
      else expect(query).not.toHaveBeenCalled();
      if (resultVisibility === "closed_only") {
        await user.click(screen.getByLabelText("Closed"));
        await waitFor(() => expect(screen.getAllByRole("progressbar")).toHaveLength(2));
      }
      await user.click(screen.getByLabelText("Result access"));
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    }
  );
  it("rejects a repeat vote after remount and refuses voting after closing", async () => {
    const user = userEvent.setup();
    const storage = createMemoryStorageAdapter();
    const schema = {
      ...createInitialSchemaByMode("poll", { title: "Poll", locale: "en" }),
      metadata: { mode: "poll", poll: { resultVisibility: "private", strictOneVotePerUser: true } }
    };
    await storage.saveSchema(schema);
    const view = render(<ContentAnswer schema={schema} locale="en" storage={storage} />);
    await user.click(screen.getByRole("radio", { name: "Option 1" }));
    await user.click(screen.getByRole("button", { name: "Send response" }));
    await waitFor(() => expect(screen.getByText("Submitted.")).toBeVisible());
    view.unmount();
    render(<ContentAnswer schema={schema} locale="en" storage={storage} />);
    await user.click(screen.getByRole("radio", { name: "Option 2" }));
    await user.click(screen.getByRole("button", { name: "Send response" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("already voted"));
    expect(await storage.listSubmissions(schema.id, schema.version)).toHaveLength(1);
    await user.click(screen.getByLabelText("Closed"));
    await user.click(screen.getByRole("button", { name: "Retry submission" }));
    expect(await storage.listSubmissions(schema.id, schema.version)).toHaveLength(1);
  });
  it("keeps a successful submission when results fail and recovers without resubmitting", async () => {
    const user = userEvent.setup();
    const storage = createMemoryStorageAdapter();
    const schema = createInitialSchemaByMode("poll", { title: "Poll", locale: "en" });
    await storage.saveSchema(schema);
    render(<ContentAnswer schema={schema} locale="en" storage={storage} />);
    await user.click(screen.getByLabelText("Simulate results error"));
    await user.click(screen.getByRole("radio", { name: "Option 1" }));
    await user.click(screen.getByRole("button", { name: "Send response" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Retry results" })).toBeVisible());
    expect(screen.getByText("Submitted.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Retry results" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Results request failed"));
    await user.click(screen.getByLabelText("Simulate results error"));
    await waitFor(() => expect(screen.getAllByRole("progressbar")).toHaveLength(2));
    expect(await storage.listSubmissions(schema.id, schema.version)).toHaveLength(1);
  });
});
