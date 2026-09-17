import { type FormSchema, shuffleOptions } from "@form-engine-ts/core";
import { render, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormRenderer } from "../src";

const schema: FormSchema = {
  id: "shuffle-form",
  version: 1,
  title: "Shuffle form",
  fields: [
    {
      id: "choice",
      type: "radio",
      title: "Choice",
      required: false,
      shuffleOptions: true,
      options: [
        { id: "a", label: "A" },
        { id: "pinned", label: "Pinned", pinned: true },
        { id: "b", label: "B" },
        { id: "c", label: "C" }
      ]
    }
  ]
};

describe("choice option shuffling", () => {
  it("keeps a seeded order stable and preserves pinned positions", () => {
    const { container } = render(
      <>
        <FormRenderer schema={schema} optionOrderSeed="respondent-1" onSubmit={() => undefined} />
        <FormRenderer schema={schema} optionOrderSeed="respondent-1" onSubmit={() => undefined} />
      </>
    );
    const forms = Array.from(container.querySelectorAll("form"));
    expect(forms).toHaveLength(2);
    const first = within(forms[0] as HTMLElement)
      .getAllByRole("radio")
      .map((input) => input.parentElement?.textContent);
    const second = within(forms[1] as HTMLElement)
      .getAllByRole("radio")
      .map((input) => input.parentElement?.textContent);
    expect(first).toEqual(second);
    expect(first?.[1]).toContain("Pinned");
  });

  it("uses the submission attempt as a fallback seed", async () => {
    const field = schema.fields[0];
    if (field === undefined || !("options" in field)) throw new Error("Expected a choice field");
    const { container } = render(
      <FormRenderer schema={schema} attemptIdFactory={() => "attempt-seed"} onSubmit={() => undefined} />
    );
    const expected = shuffleOptions(field.options, "attempt-seed").map((option) => option.label);

    await waitFor(() => {
      const labels = within(container)
        .getAllByRole("radio")
        .map((input) => input.parentElement?.textContent?.trim());
      expect(labels).toEqual(expected);
    });
  });
});
