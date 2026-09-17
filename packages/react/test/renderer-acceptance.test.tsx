import type { FormSchema } from "@form-engine-ts/core";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FormRenderer } from "../src";

const schema: FormSchema = {
  id: "closed-form",
  version: 1,
  title: "Closed form",
  submissionSettings: { closeAt: "2026-09-17T00:00:00.000Z" },
  fields: [{ id: "answer", type: "text", title: "Answer", required: true }]
};

describe("FormRenderer acceptance", () => {
  afterEach(cleanup);

  it("renders a closed state instead of the submission form", () => {
    render(
      <FormRenderer
        schema={schema}
        acceptance={{ now: () => new Date("2026-09-17T00:00:00.000Z") }}
        onSubmit={() => undefined}
      />
    );
    expect(screen.getByRole("status")).toHaveTextContent("This form is closed.");
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
  });

  it("supports an asynchronous submission count loader", async () => {
    const { findByRole } = render(
      <FormRenderer
        schema={{ ...schema, submissionSettings: { maxResponses: 1 } }}
        acceptance={{ submissionCount: async () => 1 }}
        onSubmit={() => undefined}
      />
    );
    expect(await findByRole("status")).toHaveTextContent("This form has reached its response limit.");
  });

  it("shows submission count loader failures with a retry action", async () => {
    const submissionCount = vi.fn().mockRejectedValueOnce(new Error("Count failed")).mockResolvedValueOnce(1);
    render(
      <FormRenderer
        schema={{ ...schema, submissionSettings: { maxResponses: 1 } }}
        acceptance={{ submissionCount }}
        onSubmit={() => undefined}
      />
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Submission failed");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("response limit"));
    expect(submissionCount).toHaveBeenCalledTimes(2);
  });

  it("rechecks acceptance immediately before submission", async () => {
    const onSubmit = vi.fn();
    const submissionCount = vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    render(
      <FormRenderer
        schema={{
          ...schema,
          submissionSettings: { maxResponses: 1 },
          fields: [{ id: "answer", type: "text", title: "Answer", required: false }]
        }}
        acceptance={{ submissionCount }}
        onSubmit={onSubmit}
      />
    );
    await screen.findByRole("button", { name: "Submit" });

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("response limit"));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(submissionCount).toHaveBeenCalledTimes(2);
  });

  it("shows submit-time submission count loader failures", async () => {
    const onSubmit = vi.fn();
    const submissionCount = vi.fn().mockResolvedValueOnce(0).mockRejectedValueOnce(new Error("Count failed"));
    render(
      <FormRenderer
        schema={{
          ...schema,
          submissionSettings: { maxResponses: 1 },
          fields: [{ id: "answer", type: "text", title: "Answer", required: false }]
        }}
        acceptance={{ submissionCount }}
        onSubmit={onSubmit}
      />
    );
    await screen.findByRole("button", { name: "Submit" });

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Submission failed");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(submissionCount).toHaveBeenCalledTimes(2);
  });
});
