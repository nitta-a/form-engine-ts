import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

async function submitCompleteResponse(user: ReturnType<typeof userEvent.setup>, expectSuccess = true) {
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
  if (expectSuccess)
    await waitFor(() => expect(respondent.getByRole("status")).toHaveTextContent(/Response saved|Thank you/));
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
    expect(screen.getByLabelText("完了メッセージ")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add question" })).not.toBeInTheDocument();
  });

  it("opens the MUI mode preview with MUI controls", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("tab", { name: "MUI Mode" }));

    const panel = screen.getByRole("tabpanel", { name: "MUI Mode" });
    expect(panel).toBeVisible();
    expect(panel.querySelector("#builder-form-title")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Add question" })).toBeInTheDocument();
  });

  it("opens the source and translation comparison workspace", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("tab", { name: "Translation Comparison" }));

    const panel = screen.getByRole("tabpanel", { name: "Translation Comparison" });
    expect(panel).toBeVisible();
    expect(
      within(panel).getByRole("heading", { name: "Translation comparison workspace", level: 6 })
    ).toBeInTheDocument();
    expect(within(panel).getAllByRole("textbox").length).toBeGreaterThan(0);
  });

  it("runs the translation overwrite policy and displays its report", async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Overwrite"), { target: { value: "all" } });
    const runTranslation = screen.getByRole("button", { name: "Run translation policy" });
    await waitFor(() => expect(runTranslation).toBeEnabled());
    fireEvent.click(runTranslation);
    await waitFor(() =>
      expect(document.querySelector(".translation-policy-demo output")).toHaveTextContent(
        /updated \/ 0 skipped \(all\)/
      )
    );
    await waitFor(() => expect(document.querySelector(".json-card code")).toHaveTextContent('"translationMetadata"'));
  });

  it("demonstrates headless factory actions with Core and React policy parity", async () => {
    const user = userEvent.setup();
    render(<App />);
    const parity = screen.getByTestId("policy-parity");
    const match = parity.textContent?.match(/Core (\d+) \/ React (\d+)/);
    expect(match?.[1]).toBe(match?.[2]);
    await user.click(screen.getByRole("button", { name: "Add via headless factory" }));
    expect(await screen.findByRole("group", { name: "Headless-created question" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Set completion via headless action" }));
    await waitFor(() =>
      expect(document.querySelector(".json-card code")).toHaveTextContent("Updated via headless action")
    );
  });

  it("simulates draft publication and incremental analytics", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByText("Incremental submissions: 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clone published version to draft" }));
    expect(screen.getByText("Draft v2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Publish draft" }));
    expect(await screen.findByText("Published v2; archived v1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Run concurrent CAS simulation" }));
    expect(await screen.findByText("CAS: 1 success / 1 revision_conflict")).toBeInTheDocument();
  });

  it("demonstrates Visual Builder defaults and manual translation metadata", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Add question" }));
    const added = screen.getByRole("group", { name: "New question" });
    expect(within(added).getByLabelText("Type")).toHaveValue("textarea");

    await user.selectOptions(screen.getByLabelText("Edit locale"), "en");
    const localizedCompletion = screen.getAllByLabelText("Completion message")[1];
    if (localizedCompletion === undefined) throw new Error("Expected localized completion editor");
    await user.type(localizedCompletion, "!");
    await waitFor(() => expect(document.querySelector(".json-card code")).toHaveTextContent("preview-manual"));
  });

  it("demonstrates read-only and feature-scoped builder modes", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText("Read-only builder"));
    expect(screen.getByRole("button", { name: "Add question" })).toBeDisabled();
    await user.click(screen.getByLabelText("Pages feature"));
    await user.click(screen.getByLabelText("Localization feature"));
    await user.click(screen.getByLabelText("Conditions feature"));
    expect(screen.queryByRole("heading", { name: "Page manager" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Localization" })).not.toBeInTheDocument();
    expect(screen.queryAllByLabelText("Display condition")).toHaveLength(0);
  });

  it("demonstrates injected Builder primitives and the ARGS translation action slot", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText("Use custom Builder UI"));
    expect(screen.getByRole("button", { name: "Add question" })).toHaveClass("preview-mui-button");
    expect(screen.getAllByLabelText("Page title")[0]).toHaveClass("preview-mui-input");
    expect(screen.queryByRole("button", { name: "Translate all text" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run ARGS AI translation" })).toBeInTheDocument();
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
