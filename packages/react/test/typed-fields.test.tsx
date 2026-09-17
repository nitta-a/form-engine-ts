import type { FormSchema } from "@form-engine-ts/core";
import { render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormRenderer } from "../src";

const schema: FormSchema = {
  id: "typed-fields",
  version: 1,
  title: "Typed fields",
  fields: [
    { id: "date", type: "date", title: "Date", required: false },
    { id: "time", type: "time", title: "Time", required: false },
    { id: "email", type: "email", title: "Email", required: false },
    { id: "tel", type: "tel", title: "Phone", required: false },
    { id: "url", type: "url", title: "URL", required: false }
  ]
};

describe("typed field rendering", () => {
  it.each([
    ["date", "date"],
    ["time", "time"],
    ["email", "email"],
    ["tel", "tel"],
    ["url", "url"]
  ])("renders %s with its native input type", (fieldId, inputType) => {
    const { container } = render(<FormRenderer schema={schema} onSubmit={() => undefined} />);
    const labels = { date: "Date", time: "Time", email: "Email", tel: "Phone", url: "URL" } as const;
    const label = labels[fieldId as keyof typeof labels];
    expect(within(container).getByLabelText(label)).toHaveAttribute("type", inputType);
  });
});
