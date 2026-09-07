import type { FormSchema } from "@form-engine-ts/core";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import {
  createMuiBuilderSlots,
  MuiFormBuilder,
  type MuiFormBuilderProps,
  MuiPagesEditor,
  MuiPagesEditorSlot,
  muiBuilderSlots
} from "../src";

const schema: FormSchema = {
  id: "pages",
  version: 1,
  title: "Survey",
  defaultLocale: "en",
  supportedLocales: ["en", "ja"],
  fields: [
    { id: "name", type: "text", title: "Name", required: false },
    { id: "age", type: "number", title: "Age", required: false },
    { id: "comment", type: "textarea", title: "Comment", required: false }
  ],
  pages: [
    { id: "basic", title: "Basic", questionIds: ["name", "age"] },
    { id: "feedback", title: "Feedback", questionIds: ["comment"] }
  ]
};
function Harness({ initial = schema, ...props }: Partial<MuiFormBuilderProps> & { readonly initial?: FormSchema }) {
  const [current, setCurrent] = useState(initial);
  return (
    <>
      <MuiFormBuilder schema={current} onChange={setCurrent} {...props} />
      <output data-testid="state">{JSON.stringify(current)}</output>
    </>
  );
}
function elementAt(elements: HTMLElement[], index: number): HTMLElement {
  const element = elements[index];
  if (element === undefined) throw new Error(`Missing element ${index}`);
  return element;
}
function state(): FormSchema {
  return JSON.parse(screen.getByTestId("state").textContent ?? "{}");
}
async function choose(control: HTMLElement, option: string) {
  await userEvent.click(control);
  await userEvent.click(screen.getByRole("option", { name: option }));
}

describe("MUI pages editor", () => {
  it("registers public slots and preserves custom overrides", () => {
    expect(muiBuilderSlots.pages).toBe(MuiPagesEditor);
    expect(MuiPagesEditorSlot).toBe(MuiPagesEditor);
    const Custom = () => <div>Custom pages</div>;
    expect(createMuiBuilderSlots({}, { pages: Custom }).pages).toBe(Custom);
    render(<Harness slots={{ pages: Custom }} />);
    expect(screen.getByText("Custom pages")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Page title" })).toBeNull();
  });
  it("enables pages, splits a chosen question, and returns to single-page mode without losing fields", async () => {
    const { pages: _pages, ...single } = schema;
    render(<Harness initial={single} />);
    await userEvent.click(screen.getByRole("button", { name: "Enable multi-step pages" }));
    expect(state().pages?.[0]?.questionIds).toEqual(["name", "age", "comment"]);
    await choose(screen.getByRole("combobox", { name: "Question to move to the new page" }), "Age");
    await userEvent.click(screen.getByRole("button", { name: "Add page" }));
    expect(state().pages?.map((page) => page.questionIds)).toEqual([["name", "comment"], ["age"]]);
    const titles = screen.getAllByRole("textbox", { name: "Page title" });
    fireEvent.change(elementAt(titles, 0), { target: { value: "First" } });
    fireEvent.change(elementAt(titles, 1), { target: { value: "Second" } });
    await userEvent.click(screen.getByRole("button", { name: "Delete Second" }));
    expect(state().pages?.[0]?.questionIds).toEqual(["name", "comment", "age"]);
    await userEvent.click(screen.getByRole("button", { name: "Delete First" }));
    expect(state().pages).toBeUndefined();
    expect(state().fields).toEqual(schema.fields);
  });
  it("edits source text without remounting and reorders and assigns through headless actions", async () => {
    render(<Harness muiOptions={{ dense: true, size: "small" }} />);
    const basic = within(screen.getByRole("group", { name: "Basic" }));
    const input = basic.getByRole("textbox", { name: "Page title" });
    await userEvent.type(input, " info");
    expect(input).toHaveFocus();
    expect(input).toHaveValue("Basic info");
    fireEvent.change(basic.getByRole("textbox", { name: "Page description" }), { target: { value: "Description" } });
    expect(state().pages?.[0]?.description).toBe("Description");
    fireEvent.change(basic.getByRole("textbox", { name: "Page description" }), { target: { value: "" } });
    expect(state().pages?.[0]?.description).toBeUndefined();
    await choose(basic.getByRole("combobox", { name: "Age" }), "Feedback");
    expect(state().pages?.map((page) => page.questionIds)).toEqual([["name"], ["age", "comment"]]);
    await userEvent.click(screen.getByRole("button", { name: "Move Feedback up" }));
    expect(state().pages?.map((page) => page.id)).toEqual(["feedback", "basic"]);
    expect(screen.getByRole("button", { name: "Move Feedback up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Basic info down" })).toBeDisabled();
  });
  it("limits conditions to preceding questions, edits values, clears conditions on reorder", async () => {
    render(<Harness />);
    const feedback = within(screen.getByRole("group", { name: "Feedback" }));
    await userEvent.click(feedback.getByRole("combobox", { name: "Page display condition" }));
    expect(screen.queryByRole("option", { name: "Comment" })).toBeNull();
    await userEvent.click(screen.getByRole("option", { name: "Name" }));
    fireEvent.change(feedback.getByRole("textbox", { name: "Condition value" }), { target: { value: "Ada" } });
    expect(state().pages?.[1]?.displayCondition).toEqual({ questionId: "name", operator: "equals", value: "Ada" });
    await choose(feedback.getByRole("combobox", { name: "Page display condition" }), "Always visible");
    expect(state().pages?.[1]?.displayCondition).toBeUndefined();
    await choose(feedback.getByRole("combobox", { name: "Page display condition" }), "Age");
    fireEvent.change(feedback.getByRole("spinbutton", { name: "Condition value" }), { target: { value: "18" } });
    expect(state().pages?.[1]?.displayCondition?.value).toBe(18);
    await userEvent.click(screen.getByRole("button", { name: "Move Feedback up" }));
    expect(state().pages?.[0]?.displayCondition).toBeUndefined();
  });
  it("preserves manual translation metadata", async () => {
    render(
      <Harness createManualTranslationMetadata={(context) => ({ sourceText: context.sourceText, manual: true })} />
    );
    await userEvent.click(screen.getByRole("tab", { name: "ja" }));
    const basic = within(screen.getByRole("group", { name: "Basic" }));
    fireEvent.change(elementAt(basic.getAllByRole("textbox", { name: "Page title" }), 1), {
      target: { value: "基本" }
    });
    fireEvent.change(elementAt(basic.getAllByRole("textbox", { name: "Page description" }), 1), {
      target: { value: "説明" }
    });
    expect(state().pages?.[0]?.translations?.ja).toEqual({ title: "基本", description: "説明" });
    expect(state().pages?.[0]?.translationMetadata?.ja?.title).toEqual({ sourceText: "Basic", manual: true });
  });
  it("disables all editing in read-only mode, including conditional selects and values", () => {
    render(
      <Harness
        readOnly
        initial={{
          ...schema,
          pages: (schema.pages ?? []).map((page, index) =>
            index === 1 ? { ...page, displayCondition: { questionId: "age", operator: "equals", value: 18 } } : page
          )
        }}
      />
    );
    const manager = within(screen.getByRole("heading", { name: "Page manager" }).parentElement ?? document.body);
    for (const role of ["textbox", "spinbutton", "button"] as const) {
      for (const input of manager.queryAllByRole(role)) expect(input).toBeDisabled();
    }
    for (const select of manager.getAllByRole("combobox")) expect(select).toHaveAttribute("aria-disabled", "true");
    expect(state().pages?.[1]?.displayCondition?.value).toBe(18);
  });
  it("honors feature flags and prevents empty page creation", () => {
    const { rerender } = render(
      <Harness
        features={{ conditions: false, localization: false }}
        initial={{ ...schema, fields: schema.fields.slice(0, 1), pages: [{ id: "only", questionIds: ["name"] }] }}
      />
    );
    expect(screen.getByRole("button", { name: "Add page" })).toBeDisabled();
    expect(screen.queryByRole("combobox", { name: "Page display condition" })).toBeNull();
    rerender(<Harness features={{ pages: false }} />);
    expect(screen.queryByRole("heading", { name: "Page manager" })).toBeNull();
  });
  it("reports policy failures without applying a rejected title", () => {
    const onActionError = vi.fn();
    render(<Harness policy={{ maxTextLength: 5 }} onActionError={onActionError} />);
    fireEvent.change(
      within(screen.getByRole("group", { name: "Basic" })).getByRole("textbox", { name: "Page title" }),
      { target: { value: "Much too long" } }
    );
    expect(state().pages?.[0]?.title).toBe("Basic");
    expect(onActionError).toHaveBeenCalled();
  });
});
