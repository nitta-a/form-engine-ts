import type { FormSchema } from "@form-engine-ts/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormRenderer } from "../src";

const schema: FormSchema = {
  id: "progress-renderer",
  version: 1,
  title: "Progress",
  fields: [{ id: "name", type: "text", title: "Name", required: false }],
  pages: [{ id: "page", title: "Page", questionIds: ["name"] }]
};

describe("FormRenderer progress slot", () => {
  it("receives answer progress details", () => {
    render(
      <FormRenderer
        schema={schema}
        initialValues={{ name: "Ada" }}
        estimateSecondsPerQuestion={30}
        onSubmit={() => undefined}
        slots={{
          renderProgress: ({ remainingQuestions, percent, estimatedSecondsRemaining }) => (
            <output data-testid="progress">{`${remainingQuestions}:${percent}:${estimatedSecondsRemaining}`}</output>
          )
        }}
      />
    );
    expect(screen.getByTestId("progress")).toHaveTextContent("0:100:0");
  });

  it("uses renderer messages for progress accessibility text", () => {
    render(
      <FormRenderer
        schema={schema}
        messages={{ progressLabel: "Completion", remainingQuestions: "{{count}} left" }}
        onSubmit={() => undefined}
      />
    );
    expect(screen.getByRole("progressbar", { name: "Completion" })).toHaveAttribute(
      "aria-valuetext",
      "Step 1 / 1 (1 left)"
    );
  });
});
