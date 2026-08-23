import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

async function submitCompleteResponse(user: ReturnType<typeof userEvent.setup>) {
  const respondent = within(screen.getByRole("tabpanel"));
  await user.type(respondent.getByLabelText(/^Your name/), "Ada");
  await user.type(respondent.getByLabelText(/^Reference code/), "ABC123");
  await user.type(respondent.getByLabelText(/^Age/), "36");
  await user.click(respondent.getByRole("button", { name: "Next" }));
  await user.selectOptions(respondent.getByLabelText(/^Team/), "opt_a1b2c3d4");
  await user.click(respondent.getByLabelText("Email"));
  await user.click(respondent.getByLabelText("Yes"));
  await user.click(respondent.getByLabelText("5"));
  await user.click(respondent.getByRole("button", { name: "Next" }));
  await user.click(respondent.getByLabelText(/I agree that this response/));
  await user.click(respondent.getByRole("button", { name: "Send response" }));
  await waitFor(() => expect(respondent.getByRole("status")).toHaveTextContent("Response saved"));
}

describe("preview application", () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it("localizes form builder controls when Japanese is selected", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "日本語" }));

    expect(screen.getByRole("region", { name: "フォームビルダー" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "質問を追加" })).toBeInTheDocument();
    expect(screen.getAllByLabelText("種類")).not.toHaveLength(0);
    expect(screen.getAllByText("必須")).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Add question" })).not.toBeInTheDocument();
  });

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
      expect(capturedBlob).toBeDefined();
      expect(capturedBlob?.type).toBe("text/csv;charset=utf-8;");
      const bytes = await new Promise<Uint8Array>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error);
        reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
        reader.readAsArrayBuffer(capturedBlob as Blob);
      });
      expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
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
