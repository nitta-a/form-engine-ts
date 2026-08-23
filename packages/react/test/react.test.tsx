import type { FormSchema, FormValues, TranslationAdapter } from "@form-engine-ts/core";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { FormBuilder, FormProvider, FormRenderer, useField } from "../src";

const schema = {
  id: "test",
  version: 1,
  title: "Test form",
  description: "A natural-language form description.",
  submitLabelKey: "submit",
  fields: [
    {
      id: "name",
      type: "text",
      title: "Name",
      description: "Enter your full name.",
      required: true,
      minLength: 2
    },
    { id: "age", type: "number", title: "Age", required: false, min: 1 },
    { id: "rating", type: "rating", title: "Rating", required: false },
    { id: "team", type: "select", title: "Team", required: false, options: [{ id: "a", label: "Team A" }] },
    { id: "tags", type: "multi-select", title: "Tags", required: false, options: [{ id: "x", label: "Tag X" }] },
    { id: "agree", type: "checkbox", title: "Agree", required: false },
    { id: "choice", type: "radio", title: "Choice", required: false, options: [{ id: "yes", label: "Yes" }] },
    { id: "notes", type: "textarea", title: "Notes", required: false }
  ]
} as const satisfies FormSchema;

const translator: TranslationAdapter = {
  translate: (key, locale, params) => `${locale}:${key}${params?.min === undefined ? "" : `:${params.min}`}`
};

function Harness({
  onSubmit,
  resetOnSuccess = false
}: {
  readonly onSubmit: (values: FormValues) => void | Promise<void>;
  readonly resetOnSuccess?: boolean;
}) {
  const [locale, setLocale] = useState("en");
  return (
    <>
      <button type="button" onClick={() => setLocale("ja")}>
        Japanese
      </button>
      <FormProvider
        schema={schema}
        locale={locale}
        translator={translator}
        onSubmit={onSubmit}
        resetOnSuccess={resetOnSuccess}
      >
        <FormRenderer successMessageKey="success" errorMessageKey="error" />
      </FormProvider>
    </>
  );
}

describe("React form engine", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders every control with accessible labels", () => {
    render(<Harness onSubmit={() => undefined} />);
    expect(screen.getByRole("heading", { name: "Test form" })).toBeInTheDocument();
    expect(screen.getByText("A natural-language form description.")).toBeInTheDocument();
    expect(screen.getByText("Enter your full name.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Name/)).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Age")).toHaveAttribute("type", "number");
    expect(screen.getByLabelText("1")).toHaveAttribute("type", "radio");
    expect(screen.getByLabelText("Team").tagName).toBe("SELECT");
    expect(screen.getByLabelText("Tag X")).toHaveAttribute("type", "checkbox");
    expect(screen.getByLabelText("Agree")).toHaveAttribute("type", "checkbox");
    expect(screen.getByLabelText("Yes")).toHaveAttribute("type", "radio");
    expect(screen.getByLabelText("Notes").tagName).toBe("TEXTAREA");
  });

  it("preserves answers across controlled locale changes", async () => {
    const user = userEvent.setup();
    render(<Harness onSubmit={() => undefined} />);
    await user.type(screen.getByLabelText(/Name/), "Ada");
    await user.click(screen.getByText("Japanese"));
    expect(screen.getByLabelText(/Name/)).toHaveValue("Ada");
  });

  it("validates, associates errors, focuses the first failure, and revalidates on change", async () => {
    const user = userEvent.setup();
    render(<Harness onSubmit={() => undefined} />);
    await user.click(screen.getByRole("button", { name: "en:submit" }));
    const input = screen.getByLabelText(/Name/);
    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("en:validation.required")).toBeInTheDocument();
    await user.type(input, "Ada");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("handles async success, resets values, and handles submit errors", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);
    const { unmount } = render(<Harness onSubmit={onSubmit} resetOnSuccess />);
    await user.type(screen.getByLabelText(/Name/), "Ada");
    await user.click(screen.getByRole("button", { name: "en:submit" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("en:success"));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: "Ada" }));
    expect(screen.getByLabelText(/Name/)).toHaveValue("");
    unmount();

    render(<Harness onSubmit={() => Promise.reject(new Error("nope"))} />);
    await user.type(screen.getByLabelText(/Name/), "Ada");
    const form = screen.getByRole("button", { name: "en:submit" }).closest("form");
    if (form === null) throw new Error("Expected a form element.");
    fireEvent.submit(form);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("en:error"));
  });

  it("supports field component overrides and hooks", () => {
    function NameOverride() {
      const field = useField("name");
      return (
        <button type="button" onClick={() => field.setValue("Custom")}>
          Custom {String(field.value ?? "")}
        </button>
      );
    }
    render(
      <FormProvider schema={schema} locale="en" translator={translator} onSubmit={() => undefined}>
        <FormRenderer components={{ text: NameOverride }} />
      </FormProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Custom" }));
    expect(screen.getByRole("button", { name: "Custom Custom" })).toBeInTheDocument();
  });

  it("renders conditional chains, restores hidden answers, and excludes them from submission", async () => {
    const user = userEvent.setup();
    const conditional = {
      id: "conditional",
      version: 1,
      title: "title",
      fields: [
        {
          id: "show",
          type: "select",
          title: "show",
          required: false,
          options: [
            { id: "yes", label: "yes" },
            { id: "no", label: "no" }
          ]
        },
        {
          id: "details",
          type: "text",
          title: "details",
          required: false,
          displayCondition: { questionId: "show", operator: "equals", value: "yes" }
        },
        {
          id: "nested",
          type: "text",
          title: "nested",
          required: false,
          displayCondition: { questionId: "details", operator: "not_empty" }
        }
      ]
    } as const satisfies FormSchema;
    const onSubmit = vi.fn();
    render(
      <FormProvider schema={conditional} locale="en" translator={translator} onSubmit={onSubmit}>
        <FormRenderer />
      </FormProvider>
    );
    expect(screen.queryByLabelText("details")).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("show"), "yes");
    await user.type(screen.getByLabelText("details"), "kept");
    expect(screen.getByLabelText("nested")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("show"), "no");
    expect(screen.queryByLabelText("details")).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("show"), "yes");
    expect(screen.getByLabelText("details")).toHaveValue("kept");
    await user.selectOptions(screen.getByLabelText("show"), "no");
    await user.click(screen.getByRole("button", { name: "en:form.submit" }));
    expect(onSubmit).toHaveBeenCalledWith({ show: "no" });
  });

  it("edits schema through the accessible builder controls", async () => {
    const user = userEvent.setup();
    function BuilderHarness() {
      const [current, setCurrent] = useState<FormSchema>({
        id: "builder",
        version: 1,
        title: "title",
        fields: [{ id: "q_12345678", type: "text", title: "first.label", required: false }]
      });
      return (
        <>
          <FormBuilder schema={current} onChange={setCurrent} />
          <output>{JSON.stringify(current)}</output>
        </>
      );
    }
    vi.spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce("12345678-1234-1234-1234-123456789012")
      .mockReturnValue("87654321-1234-1234-1234-123456789012");
    render(<BuilderHarness />);
    expect(screen.getByRole("button", { name: "Delete first.label" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Add question" }));
    expect(screen.getByRole("button", { name: "Move New question up" })).toBeEnabled();
    expect(screen.getByText(/"q_87654321"/)).toBeInTheDocument();
    const typeSelects = screen.getAllByLabelText("Type");
    const secondType = typeSelects[1];
    if (secondType === undefined) throw new Error("Expected second type selector");
    await user.selectOptions(secondType, "select");
    expect(screen.getByRole("button", { name: "Add option" })).toBeInTheDocument();
    expect(screen.getByText(/"opt_87654321"/)).toBeInTheDocument();
    const secondCondition = screen.getAllByLabelText("Display condition")[1];
    if (secondCondition === undefined) throw new Error("Expected second condition selector");
    await user.selectOptions(secondCondition, "q_12345678");
    expect(screen.getByLabelText("Condition operator")).toBeInTheDocument();
    expect(screen.getByText(/displayCondition/)).toBeInTheDocument();
  });

  it("hides generated IDs and keeps them stable while natural-language labels change", () => {
    function BuilderHarness() {
      const [current, setCurrent] = useState<FormSchema>({
        id: "builder-ids",
        version: 1,
        title: "title",
        fields: [
          {
            id: "q_aaaaaaaa",
            type: "select",
            title: "Satisfaction",
            required: false,
            options: [{ id: "opt_bbbbbbbb", label: "Satisfied" }]
          }
        ]
      });
      return (
        <>
          <FormBuilder schema={current} onChange={setCurrent} />
          <output data-testid="builder-schema">{JSON.stringify(current)}</output>
        </>
      );
    }
    render(<BuilderHarness />);
    const builder = screen.getByRole("region", { name: "Form builder" });
    expect(within(builder).queryByLabelText(/ID/)).not.toBeInTheDocument();
    expect(within(builder).queryByText("q_aaaaaaaa")).not.toBeInTheDocument();
    expect(within(builder).queryByText("opt_bbbbbbbb")).not.toBeInTheDocument();
    const questionTitle = screen.getByLabelText("質問文 / Question Title");
    fireEvent.change(questionTitle, { target: { value: "Overall satisfaction" } });
    const optionLabel = screen.getByLabelText("選択肢 / Option Label 1");
    fireEvent.change(optionLabel, { target: { value: "Very satisfied" } });
    expect(screen.getByTestId("builder-schema")).toHaveTextContent('"id":"q_aaaaaaaa"');
    expect(screen.getByTestId("builder-schema")).toHaveTextContent('"id":"opt_bbbbbbbb"');
    expect(screen.getByTestId("builder-schema")).toHaveTextContent('"title":"Overall satisfaction"');
    expect(screen.getByTestId("builder-schema")).toHaveTextContent('"label":"Very satisfied"');
  });

  it("offers only prior condition sources and removes conditions made forward by reordering", async () => {
    const user = userEvent.setup();
    function BuilderHarness() {
      const [current, setCurrent] = useState<FormSchema>({
        id: "builder-order",
        version: 1,
        title: "title",
        fields: [
          { id: "first", type: "text", title: "first", required: false },
          {
            id: "second",
            type: "text",
            title: "second",
            required: false,
            displayCondition: { questionId: "first", operator: "not_empty" }
          },
          { id: "third", type: "text", title: "third", required: false }
        ]
      });
      return (
        <>
          <FormBuilder schema={current} onChange={setCurrent} />
          <output data-testid="ordered-schema">{JSON.stringify(current)}</output>
        </>
      );
    }
    render(<BuilderHarness />);
    const conditionSelects = screen.getAllByLabelText("Display condition") as HTMLSelectElement[];
    const firstCondition = conditionSelects[0];
    const secondCondition = conditionSelects[1];
    const thirdCondition = conditionSelects[2];
    if (firstCondition === undefined || secondCondition === undefined || thirdCondition === undefined) {
      throw new Error("Expected three condition selectors");
    }
    expect([...firstCondition.options].map((option) => option.value)).toEqual([""]);
    expect([...secondCondition.options].map((option) => option.value)).toEqual(["", "first"]);
    expect([...thirdCondition.options].map((option) => option.value)).toEqual(["", "first", "second"]);
    await user.click(screen.getByRole("button", { name: "Move second up" }));
    expect(screen.getByTestId("ordered-schema")).not.toHaveTextContent("displayCondition");
  });
});
