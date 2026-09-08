import { createInitialSchemaByMode, type FormSchema } from "@form-engine-ts/core";
import type { BuilderTextInputProps } from "@form-engine-ts/react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { MuiTextInputAdapter } from "../src/adapters/TextInput";
import { MuiFormBuilder, type MuiFormBuilderProps } from "../src/MuiFormBuilder";

const quiz = createInitialSchemaByMode("quiz", { title: "Quiz", locale: "en" });
function Editor({
  initial = quiz,
  ...props
}: Omit<MuiFormBuilderProps, "schema" | "onChange"> & { initial?: FormSchema }) {
  const [schema, setSchema] = useState(initial);
  return (
    <>
      <MuiFormBuilder
        schema={schema}
        onChange={setSchema}
        features={{ pages: false, localization: false }}
        {...props}
      />
      <output data-testid="schema">{JSON.stringify(schema)}</output>
    </>
  );
}
function current(): FormSchema {
  return JSON.parse(screen.getByTestId("schema").textContent ?? "{}");
}
async function select(label: string, option: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox", { name: label }));
  await user.click(screen.getByRole("option", { name: option }));
}

describe("MuiFormBuilder content integration", () => {
  it.each([undefined, { mode: "survey" }])("preserves survey UI with metadata %j", (metadata) => {
    const { metadata: _metadata, ...base } = quiz;
    render(<Editor initial={{ ...base, ...(metadata === undefined ? {} : { metadata }) }} />);
    expect(screen.getByRole("textbox", { name: "Form title" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Content type")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Passing score")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Result visibility")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Points")).not.toBeInTheDocument();
  });
  it("updates every poll setting and preserves unknown metadata", async () => {
    render(<Editor initial={{ ...quiz, metadata: { mode: "poll", extra: "keep", poll: { extra: "nested" } } }} />);
    for (const [label, value] of [
      ["Always", "always"],
      ["After closing", "closed_only"],
      ["Private", "private"],
      ["After submission", "after_submit"]
    ]) {
      await select("Result visibility", label ?? "");
      expect(current().metadata?.poll).toMatchObject({ resultVisibility: value, extra: "nested" });
    }
    await userEvent.click(screen.getByRole("checkbox", { name: "One vote per user" }));
    expect(current().metadata).toMatchObject({ extra: "keep", poll: { strictOneVotePerUser: true } });
    expect(screen.queryByLabelText("Points")).not.toBeInTheDocument();
  });
  it("automatically edits quiz settings, answers, points and explanation without losing focus", async () => {
    render(
      <Editor
        initial={{
          ...quiz,
          metadata: { mode: "quiz", quiz: { extra: "keep" } },
          fields: quiz.fields.map((field) => ({ ...field, metadata: { quiz: { extra: "field" } } }))
        }}
      />
    );
    await select("Explanation timing", "Immediately");
    await userEvent.click(screen.getByRole("radio", { name: "Correct answer: Option 1" }));
    await userEvent.click(screen.getByRole("radio", { name: "Correct answer: Option 2" }));
    expect(screen.getByRole("radio", { name: "Correct answer: Option 1" })).not.toBeChecked();
    const explanation = screen.getByLabelText("Explanation");
    await userEvent.type(explanation, "Helpful fact");
    expect(explanation).toHaveFocus();
    fireEvent.change(screen.getByLabelText("Points"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Passing score"), { target: { value: "8" } });
    expect(current().metadata?.quiz).toMatchObject({ extra: "keep", showExplanation: "immediate", passingScore: 8 });
    expect(current().fields[0]?.metadata?.quiz).toMatchObject({
      extra: "field",
      correctOptionId: "option-2",
      explanation: "Helpful fact",
      points: 10
    });
    await userEvent.clear(screen.getByLabelText("Passing score"));
    expect(current().metadata?.quiz).not.toHaveProperty("passingScore");
  });
  it("switches modes without replacing questions or inactive settings", async () => {
    render(
      <Editor
        contentModeOptions={{ showSelector: true }}
        initial={{
          ...quiz,
          metadata: { mode: "quiz", extra: "keep", quiz: { passingScore: 4 }, poll: { resultVisibility: "private" } }
        }}
      />
    );
    const before = current();
    await select("Content type", "Poll");
    expect(screen.queryByLabelText("Points")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Result visibility" })).toHaveTextContent("Private");
    await select("Content type", "Survey");
    expect(screen.queryByLabelText("Result visibility")).not.toBeInTheDocument();
    await select("Content type", "Quiz");
    expect(current()).toEqual(before);
    expect(screen.getByLabelText("Passing score")).toHaveValue(4);
  });
  it("respects custom slots including explicit suppression", () => {
    render(
      <Editor
        contentModeOptions={{ showSelector: true }}
        slots={{
          basicSettingsAfter: () => <p>Custom settings</p>,
          fieldEditorAfter: () => <p>Custom field</p>,
          optionEditorAfter: () => null
        }}
      />
    );
    expect(screen.getByText("Custom settings")).toBeInTheDocument();
    expect(screen.getByText("Custom field")).toBeInTheDocument();
    expect(screen.queryByLabelText("Content type")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Points")).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /Correct answer/ })).not.toBeInTheDocument();
  });
  it("passes automatic extensions to a custom field editor", () => {
    render(
      <Editor
        slots={{
          fieldEditor: (props) => {
            const After = props.fieldEditorAfter;
            return (
              <>
                <p>Custom question</p>
                {After === undefined ? null : <After {...props} />}
              </>
            );
          }
        }}
      />
    );
    expect(screen.getByText("Custom question")).toBeInTheDocument();
    expect(screen.getByLabelText("Points")).toBeInTheDocument();
  });
  it("uses explicit Japanese UI locale independently of schema locale", () => {
    render(<Editor locale="ja" />);
    expect(screen.getByLabelText("配点")).toBeInTheDocument();
    expect(screen.getByLabelText("合格ライン点数")).toBeInTheDocument();
  });
  it("honors components, MUI options and slotProps", () => {
    function Input(props: BuilderTextInputProps) {
      return (
        <div data-testid={`custom-${props.label}`}>
          <MuiTextInputAdapter {...props} />
        </div>
      );
    }
    render(
      <Editor
        components={{ TextInput: Input }}
        muiOptions={{ variant: "filled", size: "small", dense: true }}
        muiSlotProps={{
          textField: { variant: "standard" },
          radio: { className: "custom-radio", color: "secondary" }
        }}
      />
    );
    expect(screen.getByTestId("custom-Points")).toBeInTheDocument();
    expect(screen.getByTestId("custom-Passing score")).toBeInTheDocument();
    expect(screen.getByLabelText("Points").closest(".MuiInputBase-root")).toHaveClass(
      "MuiInput-root",
      "MuiInputBase-sizeSmall"
    );
    expect(screen.getByRole("radio", { name: "Correct answer: Option 1" }).closest(".MuiRadio-root")).toHaveClass(
      "custom-radio",
      "MuiRadio-colorSecondary"
    );
  });
  it("uses Japanese labels and custom catalog overrides", () => {
    render(
      <Editor
        i18n={{ locale: "ja", messages: { "builder.content.points": "得点設定" } }}
        contentModeOptions={{ showSelector: true }}
      />
    );
    expect(screen.getByLabelText("フォーム種別")).toBeInTheDocument();
    expect(screen.getByLabelText("合格ライン点数")).toBeInTheDocument();
    expect(screen.getByLabelText("得点設定")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "正解: Option 1" })).toBeInTheDocument();
  });
  it.each(["poll", "quiz"] as const)("disables %s controls in readOnly mode", (mode) => {
    render(
      <Editor
        initial={createInitialSchemaByMode(mode, { title: "Read only", locale: "en" })}
        readOnly
        contentModeOptions={{ showSelector: true }}
      />
    );
    const before = current();
    expect(screen.getByRole("combobox", { name: "Content type" })).toHaveAttribute("aria-disabled", "true");
    if (mode === "quiz") {
      expect(screen.getByLabelText("Points")).toBeDisabled();
      expect(screen.getByLabelText("Explanation")).toBeDisabled();
      expect(screen.getByRole("radio", { name: "Correct answer: Option 1" })).toBeDisabled();
      fireEvent.change(screen.getByLabelText("Passing score"), { target: { value: "9" } });
    } else expect(screen.getByRole("checkbox", { name: "One vote per user" })).toBeDisabled();
    expect(current()).toEqual(before);
  });
  it("allows keyboard selection of a correct answer", async () => {
    render(<Editor />);
    const answer = screen.getByRole("radio", { name: "Correct answer: Option 1" });
    answer.focus();
    await userEvent.keyboard(" ");
    expect(answer).toBeChecked();
  });
});
