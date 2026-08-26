import type { QuestionType } from "@form-engine-ts/core";
import type { SelectComponentProps } from "../src";

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
});
