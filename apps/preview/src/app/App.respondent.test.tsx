import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { clearPreviewStorage, submitCompleteResponse } from "./app-test-helpers";

describe("preview application respondent and analytics workspaces", () => {
  beforeEach(clearPreviewStorage);

  it("switches locale and completes submission-to-analytics flow", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole("tab", { name: "Form Builder" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("tab", { name: "Respondent Preview" }));
    await user.click(screen.getByRole("button", { name: "日本語" }));
    expect(screen.getByRole("heading", { name: "サービスの満足度" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "EN" }));
    await submitCompleteResponse(user);
    await user.click(screen.getByRole("tab", { name: "Analytics dashboard" }));
    expect(screen.getByText("Responses").previousElementSibling).toHaveTextContent("1");
    await user.click(screen.getByRole("button", { name: "Reset responses" }));
    expect(screen.getByRole("group", { name: /Delete every response/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Responses").previousElementSibling).toHaveTextContent("1");
    await user.click(screen.getByRole("button", { name: "Reset responses" }));
    await user.click(screen.getByRole("button", { name: "Confirm reset" }));
    await waitFor(() => expect(screen.getByText("Responses").previousElementSibling).toHaveTextContent("0"));
    expect(screen.getByRole("status")).toHaveTextContent("All responses");
    await user.click(screen.getByRole("tab", { name: "Respondent Preview" }));
    expect(within(screen.getByRole("tabpanel")).getByLabelText(/^Your name/)).toHaveValue("");
  });

  it("switches storage and keeps builder JSON synchronized", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByText(/"customer-feedback"/)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Respondent Preview" }));
    await user.click(screen.getByLabelText("LocalStorage"));
    await waitFor(() => expect(screen.getByLabelText("LocalStorage")).toBeChecked());
    await user.click(screen.getByRole("tab", { name: "Form Builder" }));
    await user.click(screen.getByRole("button", { name: "Add question" }));
    expect(screen.getByRole("group", { name: "New question" })).toBeInTheDocument();
  });

  it("downloads an Excel-compatible BOM CSV blob", async () => {
    const user = userEvent.setup();
    let capturedBlob: Blob | undefined;
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn((blob: Blob) => {
        capturedBlob = blob;
        return "blob:test";
      })
    });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    try {
      render(<App />);
      await user.click(screen.getByRole("tab", { name: "Analytics dashboard" }));
      await user.click(screen.getByRole("button", { name: "Download CSV" }));
      await waitFor(() => expect(capturedBlob).toBeDefined());
      expect(capturedBlob?.type).toBe("text/csv;charset=utf-8;");
      const bytes = await new Promise<Uint8Array>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error);
        reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
        reader.readAsArrayBuffer(capturedBlob as Blob);
      });
      expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
      expect(new TextDecoder().decode(bytes)).toContain("asyncReview");
    } finally {
      Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreateObjectUrl });
      Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: originalRevokeObjectUrl });
    }
  });

  it("renders cross-tabulation controls and simulates a webhook without network access", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("tab", { name: "Analytics dashboard" }));
    expect(screen.getByRole("heading", { name: "Cross tabulation" })).toBeInTheDocument();
    expect(screen.getByLabelText("Row question")).toBeInTheDocument();
    expect(screen.getByLabelText("Column question")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Send simulated event" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("simulated webhook was accepted"));
  });

  it("demonstrates custom UI slots and cancellation without losing entered values", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("tab", { name: "Respondent Preview" }));
    await user.click(screen.getByLabelText("Use custom UI slots"));
    expect(screen.getByTestId("preview-slot-header")).toHaveTextContent("UI SLOT");
    expect(screen.getByRole("navigation", { name: "Custom step navigation" })).toBeInTheDocument();
    await user.click(screen.getByLabelText("Use custom UI slots"));
    await user.click(screen.getByLabelText("Cancel next submission in beforeSubmit"));
    await submitCompleteResponse(user, false);
    await waitFor(() => expect(screen.getByText(/Submission cancelled/)).toBeInTheDocument());
    expect(screen.getByLabelText(/I agree that this response/)).toBeChecked();
  }, 30000);

  it("round-trips schema and response metadata through LocalStorage", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByText(/"release": "v2.9.0"/)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Respondent Preview" }));
    await user.click(screen.getByLabelText("LocalStorage"));
    await waitFor(() => expect(screen.getByLabelText("LocalStorage")).toBeChecked());
    await submitCompleteResponse(user);
    const stored = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
      .filter((key): key is string => key !== null)
      .map((key) => localStorage.getItem(key) ?? "");
    expect(stored.some((value) => value.includes('"owner":"ARGS"'))).toBe(true);
    expect(stored.some((value) => value.includes('"source":"preview"'))).toBe(true);
  });

  it("clears LocalStorage responses from the respondent tab", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("tab", { name: "Respondent Preview" }));
    await user.click(screen.getByLabelText("LocalStorage"));
    await waitFor(() => expect(screen.getByLabelText("LocalStorage")).toBeChecked());
    await submitCompleteResponse(user);
    await user.click(screen.getByRole("button", { name: "Reset responses" }));
    await user.click(screen.getByRole("button", { name: "Confirm reset" }));
    await waitFor(() => expect(screen.getByText("All responses for this form were deleted.")).toBeInTheDocument());
    await user.click(screen.getByRole("tab", { name: "Analytics dashboard" }));
    expect(screen.getByText("Responses").previousElementSibling).toHaveTextContent("0");
  });

  it("restores responses and reports an error when LocalStorage reset fails", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("tab", { name: "Respondent Preview" }));
    await user.click(screen.getByLabelText("LocalStorage"));
    await waitFor(() => expect(screen.getByLabelText("LocalStorage")).toBeChecked());
    await submitCompleteResponse(user);
    globalThis.localStorage.setItem("form-engine-preview_submission:corrupt", "{");
    await user.click(screen.getByRole("button", { name: "Reset responses" }));
    await user.click(screen.getByRole("button", { name: "Confirm reset" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("invalid"));
    globalThis.localStorage.removeItem("form-engine-preview_submission:corrupt");
    await user.click(screen.getByRole("tab", { name: "Analytics dashboard" }));
    expect(screen.getByText("Responses").previousElementSibling).toHaveTextContent("1");
  });
});
