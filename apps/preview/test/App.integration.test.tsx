import { aggregateResponses, createSubmission, type FormSchema, type FormValues } from "@form-engine-ts/core";
import { FormRenderer } from "@form-engine-ts/react";
import { createMemoryStorageAdapter } from "@form-engine-ts/storage-memory";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/app/App";
import { clearPreviewStorage, submitCompleteResponse } from "../src/app/app-test-helpers";

describe("persistent response integration", () => {
  beforeEach(clearPreviewStorage);

  it("restores a submitted response in analytics after the app is remounted", async () => {
    const user = userEvent.setup();
    const app = render(<App />);
    await user.click(screen.getByRole("tab", { name: "Answer preview" }));
    fireEvent.click(screen.getByText("Demo settings & submission testing"));
    await user.click(within(screen.getByRole("tabpanel")).getByLabelText("LocalStorage"));
    await submitCompleteResponse(user);
    app.unmount();

    render(<App />);
    await user.click(screen.getByRole("tab", { name: "Answer preview" }));
    fireEvent.click(screen.getByText("Demo settings & submission testing"));
    await user.click(within(screen.getByRole("tabpanel")).getByLabelText("LocalStorage"));
    await user.click(screen.getByRole("tab", { name: "Responses & insights" }));
    await waitFor(() => expect(screen.getByText("Responses").previousElementSibling).toHaveTextContent("1"));
    const inbox = within(screen.getByRole("region", { name: "Individual responses" }));
    await user.click(inbox.getByText("Response #1"));
    expect(inbox.getByText("Ada")).toBeVisible();
  });

  it("blocks an incomplete response and accepts it after correction", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("tab", { name: "Answer preview" }));
    const respondent = within(screen.getByRole("tabpanel", { name: "Answer preview" }));
    await user.click(respondent.getByRole("button", { name: "Next" }));
    expect(respondent.getByLabelText(/^Your name/)).toHaveAttribute("aria-invalid", "true");
    await user.click(screen.getByRole("tab", { name: "Responses & insights" }));
    expect(screen.getByText("Responses").previousElementSibling).toHaveTextContent("0");
    await user.click(screen.getByRole("tab", { name: "Answer preview" }));
    await submitCompleteResponse(user);
    await user.click(screen.getByRole("tab", { name: "Responses & insights" }));
    await waitFor(() => expect(screen.getByText("Responses").previousElementSibling).toHaveTextContent("1"));
  });

  it("isolates responses when switching storage and restores them on return", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("tab", { name: "Answer preview" }));
    fireEvent.click(screen.getByText("Demo settings & submission testing"));
    const respondent = within(screen.getByRole("tabpanel", { name: "Answer preview" }));
    await user.click(respondent.getByLabelText("LocalStorage"));
    await submitCompleteResponse(user);
    await user.click(respondent.getByLabelText("Memory"));
    await user.click(screen.getByRole("tab", { name: "Responses & insights" }));
    await waitFor(() => expect(screen.getByText("Responses").previousElementSibling).toHaveTextContent("0"));
    await user.click(screen.getByRole("tab", { name: "Answer preview" }));
    await user.click(respondent.getByLabelText("LocalStorage"));
    await user.click(screen.getByRole("tab", { name: "Responses & insights" }));
    await waitFor(() => expect(screen.getByText("Responses").previousElementSibling).toHaveTextContent("1"));
  });

  it("keeps deleted responses absent after remount", async () => {
    const user = userEvent.setup();
    const app = render(<App />);
    await user.click(screen.getByRole("tab", { name: "Answer preview" }));
    fireEvent.click(screen.getByText("Demo settings & submission testing"));
    await user.click(within(screen.getByRole("tabpanel")).getByLabelText("LocalStorage"));
    await submitCompleteResponse(user);
    await user.click(screen.getByRole("button", { name: "Reset responses" }));
    await user.click(screen.getByRole("button", { name: "Confirm reset" }));
    await screen.findByText("All responses for this form were deleted.");
    app.unmount();

    render(<App />);
    await user.click(screen.getByRole("tab", { name: "Answer preview" }));
    fireEvent.click(screen.getByText("Demo settings & submission testing"));
    await user.click(within(screen.getByRole("tabpanel")).getByLabelText("LocalStorage"));
    await user.click(screen.getByRole("tab", { name: "Responses & insights" }));
    await waitFor(() => expect(screen.getByText("Responses").previousElementSibling).toHaveTextContent("0"));
  });

  it("preserves a cancelled submission and saves it exactly once on retry", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("tab", { name: "Answer preview" }));
    fireEvent.click(screen.getByText("Demo settings & submission testing"));
    await user.click(screen.getByLabelText("Cancel next submission in beforeSubmit"));
    await submitCompleteResponse(user, false);
    await screen.findByText(/Submission cancelled/);
    expect(screen.getByLabelText(/I agree that this response/)).toBeChecked();
    await user.click(screen.getByRole("tab", { name: "Responses & insights" }));
    expect(screen.getByText("Responses").previousElementSibling).toHaveTextContent("0");
    await user.click(screen.getByRole("tab", { name: "Answer preview" }));
    await user.click(screen.getByRole("button", { name: "Send response" }));
    await screen.findByText(/Response saved|Thank you/);
    await user.click(screen.getByRole("tab", { name: "Responses & insights" }));
    await waitFor(() => expect(screen.getByText("Responses").previousElementSibling).toHaveTextContent("1"));
  });

  it("retains a saved response after cancelling deletion and remounting", async () => {
    const user = userEvent.setup();
    const app = render(<App />);
    await user.click(screen.getByRole("tab", { name: "Answer preview" }));
    fireEvent.click(screen.getByText("Demo settings & submission testing"));
    await user.click(within(screen.getByRole("tabpanel")).getByLabelText("LocalStorage"));
    await submitCompleteResponse(user);
    await user.click(screen.getByRole("button", { name: "Reset responses" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    app.unmount();

    render(<App />);
    await user.click(screen.getByRole("tab", { name: "Answer preview" }));
    fireEvent.click(screen.getByText("Demo settings & submission testing"));
    await user.click(within(screen.getByRole("tabpanel")).getByLabelText("LocalStorage"));
    await user.click(screen.getByRole("tab", { name: "Responses & insights" }));
    await waitFor(() => expect(screen.getByText("Responses").previousElementSibling).toHaveTextContent("1"));
    const inbox = within(screen.getByRole("region", { name: "Individual responses" }));
    await user.click(inbox.getByText("Response #1"));
    expect(inbox.getByText("Ada")).toBeVisible();
  });

  it("retains answers after a storage failure and saves them on retry", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("tab", { name: "Answer preview" }));
    fireEvent.click(screen.getByText("Demo settings & submission testing"));
    await user.click(within(screen.getByRole("tabpanel")).getByLabelText("LocalStorage"));
    const originalSetItem = Storage.prototype.setItem;
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key.startsWith("form-engine-preview_submission:")) throw new Error("Storage unavailable");
      originalSetItem.call(this, key, value);
    });
    try {
      await submitCompleteResponse(user, false);
      await screen.findByRole("alert");
      expect(screen.getByLabelText(/I agree that this response/)).toBeChecked();
      setItem.mockRestore();
      await user.click(screen.getByRole("tab", { name: "Responses & insights" }));
      expect(screen.getByText("Responses").previousElementSibling).toHaveTextContent("0");
      await user.click(screen.getByRole("tab", { name: "Answer preview" }));
      await user.click(screen.getByRole("button", { name: "Send response" }));
      await screen.findByText(/Response saved|Thank you/);
      await user.click(screen.getByRole("tab", { name: "Responses & insights" }));
      await waitFor(() => expect(screen.getByText("Responses").previousElementSibling).toHaveTextContent("1"));
    } finally {
      setItem.mockRestore();
    }
  });

  it("saves a conditional answer and displays it in the response inbox", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("tab", { name: "Answer preview" }));
    const respondent = within(screen.getByRole("tabpanel", { name: "Answer preview" }));
    await user.type(respondent.getByLabelText(/^Your name/), "Ada");
    await user.type(respondent.getByLabelText(/^Reference code/), "ABC123");
    await user.type(respondent.getByLabelText(/^Age/), "36");
    await user.click(respondent.getByRole("button", { name: "Next" }));
    await user.selectOptions(respondent.getByLabelText(/^Team/), "opt_a1b2c3d4");
    await user.click(respondent.getByLabelText("Email"));
    expect(respondent.queryByLabelText(/What made the experience disappointing/)).not.toBeInTheDocument();
    await user.click(respondent.getByLabelText("No"));
    await user.type(respondent.getByLabelText(/What made the experience disappointing/), "Slow support");
    await user.click(respondent.getByLabelText("5"));
    await user.click(respondent.getByRole("button", { name: "Next" }));
    await user.click(respondent.getByLabelText(/I agree that this response/));
    await user.click(respondent.getByRole("button", { name: "Send response" }));
    await respondent.findByText(/Response saved|Thank you/);
    await user.click(screen.getByRole("tab", { name: "Responses & insights" }));
    const inbox = within(screen.getByRole("region", { name: "Individual responses" }));
    await user.click(inbox.getByText("Response #1"));
    expect(inbox.getByText("Slow support")).toBeVisible();
  });

  it("resumes a multi-page draft, submits it, and clears the draft", async () => {
    const user = userEvent.setup();
    const app = render(<App />);
    await user.click(screen.getByRole("tab", { name: "Answer preview" }));
    let respondent = within(screen.getByRole("tabpanel", { name: "Answer preview" }));
    await user.type(respondent.getByLabelText(/^Your name/), "Ada");
    await user.type(respondent.getByLabelText(/^Reference code/), "ABC123");
    await user.type(respondent.getByLabelText(/^Age/), "36");
    await user.click(respondent.getByRole("button", { name: "Next" }));
    await user.selectOptions(respondent.getByLabelText(/^Team/), "opt_a1b2c3d4");
    await waitFor(() =>
      expect(localStorage.getItem("form-engine-preview-draft:memory:customer-feedback:1")).toContain("opt_a1b2c3d4")
    );
    app.unmount();
    const restored = render(<App />);
    await user.click(screen.getByRole("tab", { name: "Answer preview" }));
    await user.click(screen.getByRole("button", { name: "Continue where you left off" }));
    respondent = within(screen.getByRole("tabpanel", { name: "Answer preview" }));
    expect(respondent.getByLabelText(/^Team/)).toHaveValue("opt_a1b2c3d4");
    await user.click(respondent.getByLabelText("Email"));
    await user.click(respondent.getByLabelText("Yes"));
    await user.click(respondent.getByLabelText("5"));
    await user.click(respondent.getByRole("button", { name: "Next" }));
    await user.click(respondent.getByLabelText(/I agree that this response/));
    await user.click(respondent.getByRole("button", { name: "Send response" }));
    await respondent.findByText(/Response saved|Thank you/);
    await user.click(screen.getByRole("tab", { name: "Responses & insights" }));
    await waitFor(() => expect(screen.getByText("Responses").previousElementSibling).toHaveTextContent("1"));
    restored.unmount();
    render(<App />);
    await user.click(screen.getByRole("tab", { name: "Answer preview" }));
    expect(screen.queryByRole("button", { name: "Continue where you left off" })).not.toBeInTheDocument();
  });

  it("keeps answers when switching language during a response", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("tab", { name: "Answer preview" }));
    fireEvent.click(screen.getByText("Demo settings & submission testing"));
    await user.type(screen.getByLabelText(/^Your name/), "Ada");
    await user.click(screen.getByRole("button", { name: "日本語" }));
    expect(screen.getByLabelText(/^お名前/)).toHaveValue("Ada");
    await user.click(screen.getByRole("button", { name: "EN" }));
    expect(screen.getByLabelText(/^Your name/)).toHaveValue("Ada");
    await user.clear(screen.getByLabelText(/^Your name/));
    await submitCompleteResponse(user);
    await user.click(screen.getByRole("tab", { name: "Responses & insights" }));
    const inbox = within(screen.getByRole("region", { name: "Individual responses" }));
    await user.click(inbox.getByText("Response #1"));
    expect(inbox.getByText("Ada")).toBeVisible();
  });

  it("omits a hidden conditional answer from the submitted response", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("tab", { name: "Answer preview" }));
    fireEvent.click(screen.getByText("Demo settings & submission testing"));
    const respondent = within(screen.getByRole("tabpanel", { name: "Answer preview" }));
    await user.click(respondent.getByLabelText("LocalStorage"));
    await user.type(respondent.getByLabelText(/^Your name/), "Ada");
    await user.type(respondent.getByLabelText(/^Reference code/), "ABC123");
    await user.type(respondent.getByLabelText(/^Age/), "36");
    await user.click(respondent.getByRole("button", { name: "Next" }));
    await user.selectOptions(respondent.getByLabelText(/^Team/), "opt_a1b2c3d4");
    await user.click(respondent.getByLabelText("Email"));
    await user.click(respondent.getByLabelText("No"));
    await user.type(respondent.getByLabelText(/What made the experience disappointing/), "Hidden answer");
    await user.click(respondent.getByLabelText("Yes"));
    expect(respondent.queryByLabelText(/What made the experience disappointing/)).not.toBeInTheDocument();
    await user.click(respondent.getByLabelText("5"));
    await user.click(respondent.getByRole("button", { name: "Next" }));
    await user.click(respondent.getByLabelText(/I agree that this response/));
    await user.click(respondent.getByRole("button", { name: "Send response" }));
    await respondent.findByText(/Response saved|Thank you/);
    const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index));
    const key = keys.find((value) => value?.startsWith("form-engine-preview_submission:"));
    expect(key).toBeDefined();
    expect(localStorage.getItem(key ?? "")).not.toContain("Hidden answer");
    await user.click(screen.getByRole("tab", { name: "Responses & insights" }));
    const inbox = within(screen.getByRole("region", { name: "Individual responses" }));
    await user.click(inbox.getByText("Response #1"));
    expect(inbox.queryByText("Hidden answer")).not.toBeInTheDocument();
  });

  it("exports submitted text safely in CSV", async () => {
    const user = userEvent.setup();
    let blob: Blob | undefined;
    const createUrl = vi.spyOn(URL, "createObjectURL").mockImplementation((value) => {
      blob = value as Blob;
      return "blob:test";
    });
    const revokeUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    try {
      render(<App />);
      await user.click(screen.getByRole("tab", { name: "Answer preview" }));
      const respondent = within(screen.getByRole("tabpanel", { name: "Answer preview" }));
      await user.type(respondent.getByLabelText(/^Your name/), "Ada");
      await user.type(respondent.getByLabelText(/^Reference code/), "ABC123");
      await user.type(respondent.getByLabelText(/^Age/), "36");
      await user.click(respondent.getByRole("button", { name: "Next" }));
      await user.selectOptions(respondent.getByLabelText(/^Team/), "opt_a1b2c3d4");
      await user.click(respondent.getByLabelText("Email"));
      await user.click(respondent.getByLabelText("Yes"));
      await user.click(respondent.getByLabelText("5"));
      await user.click(respondent.getByRole("button", { name: "Next" }));
      await user.type(respondent.getByLabelText(/What could we improve/), "=SUM(1,2)\nMore help");
      await user.click(respondent.getByLabelText(/I agree that this response/));
      await user.click(respondent.getByRole("button", { name: "Send response" }));
      await respondent.findByText(/Response saved|Thank you/);
      await user.click(screen.getByRole("tab", { name: "Responses & insights" }));
      fireEvent.click(screen.getByText("Advanced analytics & demo tools"));
      await user.click(screen.getByRole("button", { name: "Download CSV" }));
      await waitFor(() => expect(blob).toBeDefined());
      const csv = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error);
        reader.onload = () => resolve(String(reader.result));
        if (blob !== undefined) reader.readAsText(blob);
      });
      expect(csv).toContain("Ada");
      expect(csv).toContain('"\'=SUM(1,2)\nMore help"');
    } finally {
      createUrl.mockRestore();
      revokeUrl.mockRestore();
      click.mockRestore();
    }
  });

  it("recovers from a corrupt draft and accepts a new response", async () => {
    localStorage.setItem("form-engine-preview-draft:memory:customer-feedback:1", "{");
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("tab", { name: "Answer preview" }));
    expect(screen.queryByRole("button", { name: "Continue where you left off" })).not.toBeInTheDocument();
    await submitCompleteResponse(user);
    await user.click(screen.getByRole("tab", { name: "Responses & insights" }));
    await waitFor(() => expect(screen.getByText("Responses").previousElementSibling).toHaveTextContent("1"));
  });

  it("isolates a duplicated form's responses and deletion from the original", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("tab", { name: "Answer preview" }));
    await submitCompleteResponse(user);
    await user.click(screen.getByRole("tab", { name: "Surveys" }));
    const original = (await screen.findByRole("button", { name: "Service satisfaction" })).closest("article");
    if (original === null) throw new Error("Expected original survey card");
    await user.click(within(original).getByRole("button", { name: "Duplicate" }));
    await screen.findByDisplayValue("Service satisfaction (copy)");
    await user.click(screen.getByRole("button", { name: "Use in workspace" }));
    await user.click(screen.getByRole("button", { name: "Preview survey →" }));
    await user.click(screen.getByRole("tab", { name: "Responses & insights" }));
    await waitFor(() => expect(screen.getByText("Responses").previousElementSibling).toHaveTextContent("0"));
    await user.click(screen.getByRole("tab", { name: "Answer preview" }));
    await submitCompleteResponse(user);
    fireEvent.click(screen.getByText("Demo settings & submission testing"));
    await user.click(screen.getByRole("button", { name: "Reset responses" }));
    await user.click(screen.getByRole("button", { name: "Confirm reset" }));
    await screen.findByText("All responses for this form were deleted.");
    await user.click(screen.getByRole("tab", { name: "Surveys" }));
    const originalAgain = (await screen.findByRole("button", { name: "Service satisfaction" })).closest("article");
    if (originalAgain === null) throw new Error("Expected original survey card");
    await user.click(within(originalAgain).getByRole("button", { name: "Use in workspace" }));
    await user.click(screen.getByRole("tab", { name: "Responses & insights" }));
    await waitFor(() => expect(screen.getByText("Responses").previousElementSibling).toHaveTextContent("1"));
    const inbox = within(screen.getByRole("region", { name: "Individual responses" }));
    await user.click(inbox.getByText("Response #1"));
    expect(inbox.getByText("Ada")).toBeVisible();
  });

  it("stores one response when submission is repeated while storage is pending", async () => {
    const user = userEvent.setup();
    const schema: FormSchema = {
      id: "pending-form",
      version: 1,
      title: "Pending form",
      fields: [{ id: "name", type: "text", title: "Name", required: true }]
    };
    const storage = createMemoryStorageAdapter();
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const submit = vi.fn(async (values: FormValues) => {
      await gate;
      await storage.saveSubmission(
        createSubmission(schema, values, { id: "pending-response", locale: "en", submittedAt: "2026-01-01T00:00:00Z" })
      );
    });
    const { container } = render(<FormRenderer schema={schema} onSubmit={submit} />);
    await user.type(screen.getByLabelText(/Name/), "Ada");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    const form = container.querySelector("form");
    if (form === null) throw new Error("Expected a form");
    fireEvent.submit(form);
    expect(submit).toHaveBeenCalledOnce();
    expect(await storage.listSubmissions(schema.id, schema.version)).toHaveLength(0);
    release();
    await waitFor(async () => expect(await storage.listSubmissions(schema.id, schema.version)).toHaveLength(1));
  });

  it("keeps drafts and submissions separate across form versions", async () => {
    const user = userEvent.setup();
    const first: FormSchema = {
      id: "versioned-form",
      version: 1,
      title: "Versioned form",
      fields: [{ id: "name", type: "text", title: "Name", required: true }]
    };
    const second = { ...first, version: 2 };
    const storage = createMemoryStorageAdapter();
    const firstKey = "form-engine-preview-draft:memory:versioned-form:1";
    const secondKey = "form-engine-preview-draft:memory:versioned-form:2";
    const firstView = render(<FormRenderer schema={first} autoSaveKey={firstKey} draftResume={{}} />);
    await user.type(screen.getByLabelText(/Name/), "Version one draft");
    await waitFor(() => expect(localStorage.getItem(firstKey)).toContain("Version one draft"));
    firstView.unmount();

    const secondView = render(
      <FormRenderer
        schema={second}
        autoSaveKey={secondKey}
        draftResume={{}}
        onSubmit={async (values) =>
          storage.saveSubmission(
            createSubmission(second, values, { id: "version-two", locale: "en", submittedAt: "2026-01-01T00:00:00Z" })
          )
        }
      />
    );
    expect(screen.queryByRole("button", { name: "Continue where you left off" })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Name/)).toHaveValue("");
    await user.type(screen.getByLabelText(/Name/), "Version two answer");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(async () => expect(await storage.listSubmissions(second.id, second.version)).toHaveLength(1));
    expect(await storage.listSubmissions(first.id, first.version)).toHaveLength(0);
    expect(aggregateResponses(second, await storage.listSubmissions(second.id, second.version)).submissionCount).toBe(
      1
    );
    secondView.unmount();

    render(<FormRenderer schema={first} autoSaveKey={firstKey} draftResume={{}} />);
    await user.click(screen.getByRole("button", { name: "Continue where you left off" }));
    expect(screen.getByLabelText(/Name/)).toHaveValue("Version one draft");
  });
});
