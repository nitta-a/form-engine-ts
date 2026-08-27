import type { QuestionType } from "@form-engine-ts/core";
import { resolveFieldEditorControls, resolveFieldTypeSelectOptions, type SelectComponentProps } from "../src";

describe("generic Select props", () => {
  it("keeps QuestionType on the change callback", () => {
    const props: SelectComponentProps<QuestionType> = {
      value: "text",
      onChange: (value) => {
        const nextType: QuestionType = value;
        expect(nextType).toBe("text");
      },
      options: [{ value: "text", label: "Text" }]
    };

    props.onChange("text");
    expect(props.options).toHaveLength(1);
  });

  it("resolves field editor defaults and transforms type choices without mutating the input", () => {
    const controls = resolveFieldEditorControls({ title: "hidden" });
    expect(controls.title).toBe("hidden");
    expect(controls.description).toBe("editable");

    const options = [
      { value: "text" as const, label: "Text" },
      { value: "rating" as const, label: "Rating" }
    ];
    const resolved = resolveFieldTypeSelectOptions(
      options,
      {
        order: ["rating", "text"],
        transform: (items) => items.map((item) => ({ ...item, label: `Type: ${item.label}` }))
      },
      { currentType: "text", allowedTypes: ["text", "rating"] }
    );

    expect(resolved.map((item) => item.value)).toEqual(["rating", "text"]);
    expect(resolved[0]?.label).toBe("Type: Rating");
    expect(options[0]?.label).toBe("Text");
  });
});
