import type { FormSchema } from "@form-engine-ts/core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SubmissionAttempt, SubmissionAttemptStore } from "../src";
import { FormRenderer } from "../src";

const schema: FormSchema = {
  id: "renderer-lifecycle",
  version: 1,
  title: "Lifecycle",
  fields: [
    { id: "first", type: "text", title: "First", required: true },
    { id: "second", type: "text", title: "Second", required: false, maxLength: 20 }
  ]
};

function createAttemptStore(): SubmissionAttemptStore & { readonly attempts: SubmissionAttempt[]; cleared: number } {
  let attempt: SubmissionAttempt | null = null;
  let cleared = 0;
  const attempts: SubmissionAttempt[] = [];
  return {
    attempts,
    get cleared() {
      return cleared;
    },
    async getOrCreate(formId, formVersion, idFactory = () => "generated") {
      attempt ??= { attemptId: idFactory(), formId, formVersion, createdAt: new Date().toISOString() };
      attempts.push(attempt);
      return attempt;
    },
    async get() {
      return attempt;
    },
    async clear() {
      cleared += 1;
      attempt = null;
    }
  };
}

describe("FormRenderer submission lifecycle", () => {
  it("passes attempt metadata in context and preserves it for retries", async () => {
    const user = userEvent.setup();
    const attemptStore = createAttemptStore();
    const onSubmit = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined);
    render(
      <FormRenderer
        schema={schema}
        onSubmit={onSubmit}
        attemptIdFactory={() => "attempt-ulid"}
        attemptStore={attemptStore}
      />
    );

    await user.type(screen.getByLabelText(/First/), "Ada");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ first: "Ada" });
    expect(onSubmit.mock.calls[0]?.[1]).toMatchObject({ attemptId: "attempt-ulid", formId: schema.id });

    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(onSubmit.mock.calls[1]?.[0]).toEqual({ first: "Ada" });
    expect(onSubmit.mock.calls[1]?.[1]).toMatchObject({ attemptId: "attempt-ulid" });
    expect(attemptStore.cleared).toBe(1);
  });

  it("uses injected messages and renders the standard character count", async () => {
    const user = userEvent.setup();
    render(
      <FormRenderer
        schema={schema}
        onSubmit={() => undefined}
        messages={{ submitButton: "Send form", requiredField: "Required input" }}
      />
    );

    expect(screen.getByRole("button", { name: "Send form" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Send form" }));
    expect(await screen.findByText("Required input")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Second"), "abc");
    expect(screen.getByText("3 / 20")).toBeInTheDocument();
  });

  it("normalizes server payloads, focuses the first schema field, and allows retry", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValueOnce({
      fieldErrors: { second: "Invalid second answer" },
      formError: "Please correct the form."
    });
    render(<FormRenderer schema={schema} onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(/First/), "Ada");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(screen.getByLabelText("Second")).toHaveFocus());
    expect(screen.getByText("Invalid second answer")).toBeInTheDocument();
    expect(screen.getByText("Please correct the form.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("renders rich sensitive-data findings in the confirmation dialog", async () => {
    const user = userEvent.setup();
    render(
      <FormRenderer
        schema={schema}
        onSubmit={() => undefined}
        submissionConfirmationRenderMode="dialog"
        submissionGuards={[
          () => ({
            status: "confirm" as const,
            findings: [
              {
                fieldId: "first",
                fieldTitle: "First",
                type: "email",
                typeLabel: "Email address",
                maskedText: "ad***@example.com"
              }
            ]
          })
        ]}
      />
    );
    await user.type(screen.getByLabelText(/First/), "ada@example.com");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("First");
    expect(dialog).toHaveTextContent("Email address");
    expect(dialog).toHaveTextContent("ad***@example.com");
  });
});
