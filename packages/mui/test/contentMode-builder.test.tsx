import { createInitialSchemaByMode, type FormSchema } from "@form-engine-ts/core";
import type { BuilderTextInputProps } from "@form-engine-ts/react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
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
  it("allows the passing score threshold to be enabled and disabled", async () => {
    render(<Editor initial={{ ...quiz, metadata: { mode: "quiz", quiz: { extra: "keep" } } }} />);
    const toggle = screen.getByRole("checkbox", { name: "Set a passing score" });
    expect(toggle).not.toBeChecked();
    expect(screen.getByLabelText("Passing score")).toHaveValue(null);
    await userEvent.click(toggle);
    expect(toggle).toBeChecked();
    expect(screen.getByLabelText("Passing score")).not.toBeDisabled();
    expect(current().metadata?.quiz).toMatchObject({ extra: "keep", passingScore: 0 });
    await userEvent.click(toggle);
    expect(toggle).not.toBeChecked();
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
    expect(screen.getByRole("checkbox", { name: "合格ラインを設定" })).toBeInTheDocument();
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
  it("applies poll policy and a radio default while allowing an explicit policy opt-out", async () => {
    const poll = { ...createInitialSchemaByMode("poll", { title: "Poll", locale: "en" }), fields: [] };
    const { unmount } = render(<Editor initial={poll} />);
    await userEvent.click(screen.getByRole("button", { name: "Add question" }));
    expect(current().fields[0]?.type).toBe("radio");
    expect(screen.getByRole("button", { name: "Add question" })).toBeDisabled();
    unmount();

    render(<Editor initial={poll} contentModeOptions={{ applyPolicy: false }} />);
    await userEvent.click(screen.getByRole("button", { name: "Add question" }));
    expect(screen.getByRole("combobox", { name: "Type" })).toBeInTheDocument();
  });
  it("reports validation state and supports a custom summary", () => {
    const onValidationChange = vi.fn();
    const invalid = {
      ...quiz,
      fields: quiz.fields.map(({ metadata: _metadata, ...field }) => field)
    };
    render(
      <Editor
        initial={invalid}
        contentModeOptions={{
          onValidationChange,
          renderValidationSummary: (state) => <p>Custom validation: {state.issues.length}</p>
        }}
      />
    );
    expect(screen.getByText("Custom validation: 2")).toBeInTheDocument();
    expect(onValidationChange).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "quiz", valid: false, issues: expect.any(Array) })
    );
  });
  it("controls each content setting independently", () => {
    render(
      <Editor
        contentModeOptions={{
          showSelector: true,
          controls: {
            mode: "readOnly",
            showExplanation: "hidden",
            passingScore: "readOnly",
            correctAnswer: "hidden",
            explanation: "readOnly",
            points: "hidden"
          }
        }}
      />
    );
    expect(screen.getByRole("combobox", { name: "Content type" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByLabelText("Explanation timing")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Passing score")).toBeDisabled();
    expect(screen.queryByRole("radio", { name: /Correct answer/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Explanation")).toBeDisabled();
    expect(screen.queryByLabelText("Points")).not.toBeInTheDocument();
  });
  it("controls poll settings independently", () => {
    render(
      <Editor
        initial={createInitialSchemaByMode("poll", { title: "Poll", locale: "en" })}
        contentModeOptions={{
          controls: { resultVisibility: "hidden", strictOneVotePerUser: "readOnly" }
        }}
      />
    );
    expect(screen.queryByLabelText("Result visibility")).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "One vote per user" })).toBeDisabled();
  });
  it("allows controls.mode to enable the selector without showSelector", () => {
    render(<Editor contentModeOptions={{ controls: { mode: "editable" } }} />);
    expect(screen.getByRole("combobox", { name: "Content type" })).toBeInTheDocument();
  });
  it("suppresses policy issues that duplicate content mode diagnostics", async () => {
    const initial = createInitialSchemaByMode("poll", { title: "Poll", locale: "en" });
    const firstField = initial.fields.at(0);
    if (firstField === undefined) throw new Error("Expected an initial poll question.");
    const secondField = { ...firstField, id: "question-2", title: "Question 2" };
    const onValidationChange = vi.fn();
    render(
      <Editor
        initial={{ ...initial, fields: [...initial.fields, secondField] }}
        contentModeOptions={{ onValidationChange }}
      />
    );
    await waitFor(() => expect(onValidationChange).toHaveBeenCalled());
    const state = onValidationChange.mock.lastCall?.[0];
    expect(state.issues.filter((issue: { code: string }) => issue.code === "poll_field_count")).toHaveLength(1);
    expect(state.issues.filter((issue: { code: string }) => issue.code === "max_fields_exceeded")).toHaveLength(0);
  });
  it("reports validation state for survey mode without adding a summary", async () => {
    const onValidationChange = vi.fn();
    render(
      <Editor
        initial={createInitialSchemaByMode("survey", { title: "Survey", locale: "en" })}
        contentModeOptions={{ onValidationChange }}
      />
    );
    await waitFor(() => expect(onValidationChange).toHaveBeenCalledWith(expect.objectContaining({ mode: "survey" })));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("can hide the default validation summary", () => {
    render(<Editor contentModeOptions={{ validation: "hidden" }} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
