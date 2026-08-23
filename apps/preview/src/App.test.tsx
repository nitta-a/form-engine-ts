import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

describe("preview application", () => {
  it("switches locale and completes submission-to-analytics flow", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole("tab", { name: "Form Builder" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("tab", { name: "Respondent Preview" }));
    await user.click(screen.getByRole("button", { name: "日本語" }));
    expect(screen.getByRole("heading", { name: "お客様アンケート" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "EN" }));
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
    await user.click(screen.getByRole("tab", { name: "Analytics dashboard" }));
    expect(screen.getByText("Responses").previousElementSibling).toHaveTextContent("1");
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
});
