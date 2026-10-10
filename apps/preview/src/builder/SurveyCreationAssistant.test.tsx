import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SurveyCreationAssistant } from "./SurveyCreationAssistant";

afterEach(cleanup);

describe("customer survey creation", () => {
  it("keeps the reviewed draft open when storage fails, then allows retry", async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockRejectedValueOnce(new Error("Storage full")).mockResolvedValue(undefined);
    render(<SurveyCreationAssistant locale="en" onComplete={save} />);
    await user.click(screen.getByRole("button", { name: "Create survey with AI" }));
    const dialog = screen.getByRole("dialog", { name: "Create survey with AI" });
    expect(within(dialog).getByText("Survey theme: Customer experience and service improvement")).toBeInTheDocument();
    expect(within(dialog).getByText(/This demo uses fixed AI suggestions/)).toBeInTheDocument();
    const assistant = within(dialog).getByRole("region", { name: "AI survey creation assistant" });
    const input = within(assistant).getByLabelText("Tell us what you want to learn");
    await user.type(input, "Customer satisfaction");
    await user.click(within(assistant).getByRole("button", { name: "Send" }));
    await user.click(await within(assistant).findByRole("button", { name: "Customers" }));
    await user.type(input, "Service quality and improvement needs");
    await user.click(within(assistant).getByRole("button", { name: "Send" }));
    await user.click(await within(assistant).findByRole("button", { name: "Create with this information" }));
    const review = await within(dialog).findByRole("region", { name: "Draft review" });
    await user.click(within(review).getByRole("button", { name: "Open in editor" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Storage full");
    expect(dialog).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Retry saving questionnaire" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save.mock.calls[0]?.[0]).toMatchObject({ id: expect.stringMatching(/^survey-/) });
    expect(save.mock.calls[1]?.[0]).toEqual(save.mock.calls[0]?.[0]);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
