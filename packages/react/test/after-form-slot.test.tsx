import type { FormSchema } from "@form-engine-ts/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FormRenderer } from "../src/renderer";

const schema: FormSchema = {
  id: "after-form",
  version: 1,
  title: "After form slot",
  fields: [{ id: "answer", type: "text", title: "Answer", required: false }]
};

describe("FormRenderer renderAfterForm slot", () => {
  it("receives live answers and submission status after the form", async () => {
    render(
      <FormRenderer
        schema={schema}
        onSubmit={async () => undefined}
        slots={{
          renderAfterForm: ({ answers, submitStatus }) => (
            <output data-testid="after-form">{`${submitStatus}:${String(answers.answer ?? "")}`}</output>
          )
        }}
      />
    );

    expect(screen.getByTestId("after-form")).toHaveTextContent("idle:");
    await userEvent.type(screen.getByRole("textbox", { name: "Answer" }), "value");
    expect(screen.getByTestId("after-form")).toHaveTextContent("idle:value");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByTestId("after-form")).toHaveTextContent("success:value");
    expect(screen.getByText("Submitted.")).toBeInTheDocument();
  });
});
