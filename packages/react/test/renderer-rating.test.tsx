import type { FormSchema } from "@form-engine-ts/core";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FormRenderer } from "../src";

const schema: FormSchema = {
  id: "rating-form",
  version: 1,
  title: "Rating form",
  fields: [{ id: "rating", type: "rating", title: "Rating", required: false, min: 2, max: 4 }]
};

describe("rating field", () => {
  it("uses accessible stars and fills through the selected value", async () => {
    const user = userEvent.setup();
    render(<FormRenderer schema={schema} onSubmit={() => undefined} />);

    const ratingGroup = screen.getByRole("group", { name: "Rating" });
    const firstRating = within(ratingGroup).getByRole("radio", { name: "2" });
    const secondRating = within(ratingGroup).getByRole("radio", { name: "3" });

    expect(ratingGroup.querySelectorAll(".fe-rating-label > span")).toHaveLength(3);
    expect(ratingGroup.querySelectorAll(".fe-rating-label > span")[0]).toHaveTextContent("★");
    firstRating.focus();
    await user.keyboard("{ArrowRight}");

    expect(secondRating).toBeChecked();
    expect(ratingGroup.querySelector('[data-option-id="2"]')).toHaveAttribute("data-filled", "true");
    expect(ratingGroup.querySelector('[data-option-id="3"]')).toHaveAttribute("data-filled", "true");
    expect(ratingGroup.querySelector('[data-option-id="4"]')).toHaveAttribute("data-filled", "false");
  });
});
