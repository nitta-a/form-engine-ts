import type { FormSchema, FormValues, TranslationAdapter } from "@form-engine/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { FormBuilder, FormProvider, FormRenderer, useField } from "../src";

const schema = {
  id: "test",
  version: 1,
  titleKey: "title",
  submitLabelKey: "submit",
  fields: [
    { id: "name", type: "text", labelKey: "name", required: true, minLength: 2 },
    { id: "age", type: "number", labelKey: "age", min: 1 },
    { id: "rating", type: "rating", labelKey: "rating" },
    { id: "team", type: "select", labelKey: "team", options: [{ value: "a", labelKey: "option.a" }] },
    { id: "tags", type: "multi-select", labelKey: "tags", options: [{ value: "x", labelKey: "option.x" }] },
    { id: "agree", type: "checkbox", labelKey: "agree" },
    { id: "choice", type: "radio", labelKey: "choice", options: [{ value: "yes", labelKey: "yes" }] },
    { id: "notes", type: "textarea", labelKey: "notes" }
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
  it("renders every control with accessible labels", () => {
    render(<Harness onSubmit={() => undefined} />);
    expect(screen.getByRole("heading", { name: "en:title" })).toBeInTheDocument();
    expect(screen.getByLabelText(/en:name/)).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("en:age")).toHaveAttribute("type", "number");
    expect(screen.getByLabelText("1")).toHaveAttribute("type", "radio");
    expect(screen.getByLabelText("en:team").tagName).toBe("SELECT");
    expect(screen.getByLabelText("en:option.x")).toHaveAttribute("type", "checkbox");
    expect(screen.getByLabelText("en:agree")).toHaveAttribute("type", "checkbox");
    expect(screen.getByLabelText("en:yes")).toHaveAttribute("type", "radio");
    expect(screen.getByLabelText("en:notes").tagName).toBe("TEXTAREA");
  });

  it("preserves answers across controlled locale changes", async () => {
    const user = userEvent.setup();
    render(<Harness onSubmit={() => undefined} />);
    await user.type(screen.getByLabelText(/en:name/), "Ada");
    await user.click(screen.getByText("Japanese"));
    expect(screen.getByLabelText(/ja:name/)).toHaveValue("Ada");
  });

  it("validates, associates errors, focuses the first failure, and revalidates on change", async () => {
    const user = userEvent.setup();
    render(<Harness onSubmit={() => undefined} />);
    await user.click(screen.getByRole("button", { name: "en:submit" }));
    const input = screen.getByLabelText(/en:name/);
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
    await user.type(screen.getByLabelText(/en:name/), "Ada");
    await user.click(screen.getByRole("button", { name: "en:submit" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("en:success"));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: "Ada" }));
    expect(screen.getByLabelText(/en:name/)).toHaveValue("");
    unmount();

    render(<Harness onSubmit={() => Promise.reject(new Error("nope"))} />);
    await user.type(screen.getByLabelText(/en:name/), "Ada");
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
      titleKey: "title",
      fields: [
        {
          id: "show",
          type: "select",
          labelKey: "show",
          options: [
            { value: "yes", labelKey: "yes" },
            { value: "no", labelKey: "no" }
          ]
        },
        {
          id: "details",
          type: "text",
          labelKey: "details",
          displayCondition: { questionId: "show", operator: "equals", value: "yes" }
        },
        {
          id: "nested",
          type: "text",
          labelKey: "nested",
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
    expect(screen.queryByLabelText("en:details")).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("en:show"), "yes");
    await user.type(screen.getByLabelText("en:details"), "kept");
    expect(screen.getByLabelText("en:nested")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("en:show"), "no");
    expect(screen.queryByLabelText("en:details")).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("en:show"), "yes");
    expect(screen.getByLabelText("en:details")).toHaveValue("kept");
    await user.selectOptions(screen.getByLabelText("en:show"), "no");
    await user.click(screen.getByRole("button", { name: "en:form.submit" }));
    expect(onSubmit).toHaveBeenCalledWith({ show: "no" });
  });

  it("edits schema through the accessible builder controls", async () => {
    const user = userEvent.setup();
    function BuilderHarness() {
      const [current, setCurrent] = useState<FormSchema>({
        id: "builder",
        version: 1,
        titleKey: "title",
        fields: [{ id: "first", type: "text", labelKey: "first.label" }]
      });
      return (
        <>
          <FormBuilder schema={current} onChange={setCurrent} />
          <output>{JSON.stringify(current)}</output>
        </>
      );
    }
    render(<BuilderHarness />);
    expect(screen.getByRole("button", { name: "Delete first" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Add question" }));
    expect(screen.getByRole("button", { name: "Move question-2 up" })).toBeEnabled();
    const typeSelects = screen.getAllByLabelText("Type");
    const secondType = typeSelects[1];
    if (secondType === undefined) throw new Error("Expected second type selector");
    await user.selectOptions(secondType, "select");
    expect(screen.getByRole("button", { name: "Add option" })).toBeInTheDocument();
    const secondCondition = screen.getAllByLabelText("Display condition")[1];
    if (secondCondition === undefined) throw new Error("Expected second condition selector");
    await user.selectOptions(secondCondition, "first");
    expect(screen.getByLabelText("Condition operator")).toBeInTheDocument();
    expect(screen.getByText(/displayCondition/)).toBeInTheDocument();
  });

  it("commits valid question IDs, sanitizes dependents, and rejects duplicate IDs", async () => {
    const user = userEvent.setup();
    function BuilderHarness() {
      const [current, setCurrent] = useState<FormSchema>({
        id: "builder-ids",
        version: 1,
        titleKey: "title",
        fields: [
          { id: "first", type: "text", labelKey: "first" },
          {
            id: "second",
            type: "text",
            labelKey: "second",
            displayCondition: { questionId: "first", operator: "not_empty" }
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
    const firstId = screen.getAllByLabelText("Question ID")[0];
    if (firstId === undefined) throw new Error("Expected first ID input");
    await user.clear(firstId);
    await user.type(firstId, "renamed{Enter}");
    expect(screen.getByTestId("builder-schema")).toHaveTextContent('"id":"renamed"');
    expect(screen.getByTestId("builder-schema")).not.toHaveTextContent("displayCondition");

    const secondId = screen.getAllByLabelText("Question ID")[1];
    if (secondId === undefined) throw new Error("Expected second ID input");
    await user.clear(secondId);
    await user.type(secondId, "renamed");
    await user.tab();
    expect(screen.getByText(/already in use/)).toBeInTheDocument();
    expect(screen.getByTestId("builder-schema")).toHaveTextContent('"id":"second"');
  });

  it("offers only prior condition sources and removes conditions made forward by reordering", async () => {
    const user = userEvent.setup();
    function BuilderHarness() {
      const [current, setCurrent] = useState<FormSchema>({
        id: "builder-order",
        version: 1,
        titleKey: "title",
        fields: [
          { id: "first", type: "text", labelKey: "first" },
          {
            id: "second",
            type: "text",
            labelKey: "second",
            displayCondition: { questionId: "first", operator: "not_empty" }
          },
          { id: "third", type: "text", labelKey: "third" }
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
