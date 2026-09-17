import type { FormSchema } from "@form-engine-ts/core";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FormRenderer, type SubmissionGuardResult } from "../src";

const schema: FormSchema = {
  id: "protection-form",
  version: 1,
  title: "Protection form",
  submissionSettings: { honeypotFieldId: "website" },
  fields: [{ id: "answer", type: "text", title: "Answer", required: false }]
};

describe("FormRenderer submission protection", () => {
  it("passes honeypot values to existing submission guards", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const guard = vi.fn(
      (_: FormSchema, values: Record<string, unknown>): SubmissionGuardResult =>
        values.website === "spam" ? { status: "block", findings: [], message: "Blocked" } : { status: "allow" }
    );
    render(<FormRenderer schema={schema} submissionGuards={[guard]} onSubmit={onSubmit} />);
    const honeypot = document.querySelector('input[name="website"]');
    expect(honeypot).not.toBeNull();
    await user.type(honeypot as HTMLInputElement, "spam");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(guard).toHaveBeenCalledWith(schema, expect.objectContaining({ website: "spam" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("passes challenge and client identity through SubmitContext", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const openSchema: FormSchema = {
      id: schema.id,
      version: schema.version,
      title: schema.title,
      fields: schema.fields
    };
    const { container } = render(
      <FormRenderer
        schema={openSchema}
        challengeToken={async () => "challenge-token"}
        clientKey="client-1"
        onSubmit={onSubmit}
      />
    );
    await user.click(within(container).getByRole("button", { name: "Submit" }));
    expect(onSubmit).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ challengeToken: "challenge-token", clientKey: "client-1" })
    );
  });
});
