import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

async function submitCompleteResponse(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Your name/), "Ada");
  await user.type(screen.getByLabelText(/Reference code/), "ABC123");
  await user.type(screen.getByLabelText(/Your age/), "36");
  await user.selectOptions(screen.getByLabelText(/Team/), "product");
  await user.click(screen.getByLabelText("Email"));
  await user.click(screen.getByLabelText(/I agree/));
  await user.click(screen.getByLabelText("Yes"));
  await user.click(screen.getByLabelText("5"));
  await user.click(screen.getByRole("button", { name: "Send response" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Response saved"));
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
    expect(screen.getByRole("heading", { name: "お客様アンケート" })).toBeInTheDocument();
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
    expect(screen.getByLabelText(/Your name/)).toHaveValue("");
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
    expect(screen.getByText(/"question-11"/)).toBeInTheDocument();
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
