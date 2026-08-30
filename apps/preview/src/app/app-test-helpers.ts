import { screen, waitFor, within } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";

export function clearPreviewStorage() {
  globalThis.localStorage.clear();
}

export async function submitCompleteResponse(user: ReturnType<typeof userEvent.setup>, expectSuccess = true) {
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
