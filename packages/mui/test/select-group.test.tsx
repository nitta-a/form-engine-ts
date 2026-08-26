import { fireEvent, render, screen } from "@testing-library/react";
import { MuiSelectAdapter } from "../src";

describe("MUI grouped select options", () => {
  it("renders an accessible subheader for grouped options", () => {
    render(
      <MuiSelectAdapter
        id="field-type"
        label="Type"
        value="select"
        onChange={() => undefined}
        options={[
          { value: "text", label: "Text", group: "text", groupLabel: "テキスト形式" },
          { value: "select", label: "Select", group: "choice", groupLabel: "選択形式" }
        ]}
      />
    );

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Type" }));
    const header = screen.getByText("選択形式");
    expect(header.tagName).toBe("LI");
    expect(screen.getByRole("option", { name: "Select" })).toBeInTheDocument();
  });
});
