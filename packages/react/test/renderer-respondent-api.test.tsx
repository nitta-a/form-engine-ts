import type { FormSchema } from "@form-engine-ts/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  FieldComponentProps,
  RespondentButtonProps,
  RespondentRadioProps,
  RespondentTextInputProps
} from "../src";
import { FormRenderer, type SubmissionReceiptStore } from "../src";

const schema: FormSchema = {
  id: "respondent-api",
  version: 1,
  title: "Respondent API",
  fields: [
    { id: "first", type: "text", title: "First", required: true },
    {
      id: "choice",
      type: "radio",
      title: "Choice",
      required: true,
      options: [
        { id: "one", label: "One" },
        { id: "two", label: "Two" }
      ]
    },
    {
      id: "tags",
      type: "multi-select",
      title: "Tags",
      required: false,
      options: [{ id: "a", label: "A" }]
    }
  ],
  pages: [
    { id: "page-one", title: "Page one", questionIds: ["first"] },
    { id: "page-two", title: "Page two", questionIds: ["choice", "tags"] }
  ]
};
const { pages: _pages, ...unpagedSchema } = schema;

describe("respondent renderer APIs", () => {
  it("uses primitives while preserving Field Type override precedence", () => {
    function PrimitiveTextInput({
      field: _field,
      name: _name,
      label: _label,
      description: _description,
      error: _error,
      helperText: _helperText,
      errorText: _errorText,
      onChange,
      value,
      ...props
    }: RespondentTextInputProps) {
      return (
        <input
          {...props}
          data-testid="primitive-text"
          value={value ?? ""}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      );
    }
    function FullField({ field }: FieldComponentProps) {
      return <div data-testid="full-field">{field.title}</div>;
    }

    const { rerender } = render(
      <FormRenderer
        schema={schema}
        primitiveComponents={{ TextInput: PrimitiveTextInput }}
        onSubmit={() => undefined}
      />
    );
    expect(screen.getByTestId("primitive-text")).toBeInTheDocument();
    expect(screen.getByTestId("primitive-text")).toHaveAttribute("aria-required", "true");

    rerender(
      <FormRenderer
        schema={unpagedSchema}
        components={{ text: FullField }}
        primitiveComponents={{ TextInput: PrimitiveTextInput }}
        onSubmit={() => undefined}
      />
    );
    expect(screen.getByTestId("full-field")).toBeInTheDocument();
    expect(screen.queryByTestId("primitive-text")).not.toBeInTheDocument();
  });

  it("passes semantic kinds to respondent navigation buttons", async () => {
    const kinds: string[] = [];
    function PrimitiveButton({ kind, type, children, disabled, onClick }: RespondentButtonProps) {
      if (kind !== undefined) kinds.push(kind);
      return (
        <button type={type} disabled={disabled} onClick={onClick}>
          {children}
        </button>
      );
    }

    render(
      <FormRenderer
        schema={schema}
        initialValues={{ first: "Ada" }}
        primitiveComponents={{ Button: PrimitiveButton }}
        onSubmit={() => undefined}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(kinds).toContain("next");
    expect(kinds).toContain("submit");
  });

  it("covers every built-in button kind through a custom primitive", async () => {
    const user = userEvent.setup();
    const records = new Map<
      string,
      { readonly type: string | undefined; readonly disabled: boolean | undefined; readonly hasOnClick: boolean }
    >();
    function PrimitiveButton({ kind, type, children, disabled, onClick }: RespondentButtonProps) {
      if (kind !== undefined) records.set(kind, { type, disabled, hasOnClick: onClick !== undefined });
      return (
        <button type={type} disabled={disabled} onClick={onClick}>
          {children}
        </button>
      );
    }
    const paged = render(
      <FormRenderer
        schema={schema}
        initialValues={{ first: "Ada" }}
        primitiveComponents={{ Button: PrimitiveButton }}
        submissionConfirmation={{ enabled: true, renderMode: "replace" }}
        onSubmit={async () => undefined}
      />
    );

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("radio", { name: "One" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await user.click(screen.getByRole("button", { name: "Proceed" }));
    paged.unmount();

    const retrySubmit = vi.fn().mockRejectedValue(new Error("failed"));
    const retry = render(
      <FormRenderer
        schema={unpagedSchema}
        initialValues={{ first: "Ada", choice: "one" }}
        primitiveComponents={{ Button: PrimitiveButton }}
        onSubmit={retrySubmit}
      />
    );
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await user.click(await screen.findByRole("button", { name: "Retry" }));
    retry.unmount();

    const draftKey = "respondent-button-kinds-draft";
    const draftStorage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => draftStorage.get(key) ?? null,
      setItem: (key: string, value: string) => draftStorage.set(key, value),
      removeItem: (key: string) => draftStorage.delete(key)
    });
    draftStorage.set(
      draftKey,
      JSON.stringify({
        formId: unpagedSchema.id,
        formVersion: unpagedSchema.version,
        values: { first: "Ada", choice: "one" },
        savedAt: new Date().toISOString()
      })
    );
    const startOver = render(
      <FormRenderer
        schema={unpagedSchema}
        autoSaveKey={draftKey}
        draftResume={{}}
        primitiveComponents={{ Button: PrimitiveButton }}
        onSubmit={async () => undefined}
      />
    );
    await user.click(screen.getByRole("button", { name: "Start over" }));
    startOver.unmount();
    draftStorage.set(
      draftKey,
      JSON.stringify({
        formId: unpagedSchema.id,
        formVersion: unpagedSchema.version,
        values: { first: "Ada", choice: "one" },
        savedAt: new Date().toISOString()
      })
    );
    const resume = render(
      <FormRenderer
        schema={unpagedSchema}
        autoSaveKey={draftKey}
        draftResume={{}}
        primitiveComponents={{ Button: PrimitiveButton }}
        onSubmit={async () => undefined}
      />
    );
    await user.click(screen.getByRole("button", { name: "Continue where you left off" }));
    resume.unmount();
    vi.unstubAllGlobals();

    const receiptStore: SubmissionReceiptStore = {
      get: async () => ({
        formId: unpagedSchema.id,
        formVersion: unpagedSchema.version,
        submissionId: "existing",
        submittedAt: new Date().toISOString()
      }),
      save: async () => undefined,
      remove: async () => undefined
    };
    render(
      <FormRenderer
        schema={unpagedSchema}
        receiptStore={receiptStore}
        primitiveComponents={{ Button: PrimitiveButton }}
        onSubmit={async () => undefined}
      />
    );
    await user.click(await screen.findByRole("button", { name: "Submit another response" }));

    expect([...records.keys()]).toEqual(
      expect.arrayContaining([
        "previous",
        "next",
        "submit",
        "confirm",
        "cancel",
        "retry",
        "draft-resume",
        "draft-start-over",
        "reset"
      ])
    );
    for (const [kind, record] of records) {
      expect(record.type, kind).toBe(kind === "submit" ? "submit" : "button");
      expect(record.hasOnClick, kind).toBe(kind !== "submit");
      if (record.disabled !== undefined) expect(record.disabled, kind).toBe(false);
    }
  });

  it("renders whole choice options without removing the controlled input", async () => {
    render(
      <FormRenderer
        schema={unpagedSchema}
        onSubmit={() => undefined}
        slots={{
          renderChoiceOption: ({ option, inputId, children }) => (
            <label data-testid={`option-${option.id}`} data-option-id={option.id} htmlFor={inputId}>
              {children}
            </label>
          )
        }}
      />
    );

    expect(screen.getByTestId("option-one")).toBeInTheDocument();
    const one = screen.getByLabelText("One");
    fireEvent.click(one);
    expect(one).toBeChecked();
    expect(screen.getByTestId("option-a")).toBeInTheDocument();
  });

  it("passes primitive radio state and preserves arrow navigation", async () => {
    function PrimitiveRadio({
      field: _field,
      name: _name,
      label: _label,
      description: _description,
      error: _error,
      helperText: _helperText,
      errorText: _errorText,
      onChange,
      checked,
      ...props
    }: RespondentRadioProps) {
      return (
        <input {...props} type="radio" checked={checked} onChange={(event) => onChange(event.currentTarget.checked)} />
      );
    }

    render(
      <FormRenderer schema={unpagedSchema} primitiveComponents={{ Radio: PrimitiveRadio }} onSubmit={() => undefined} />
    );
    const one = screen.getByLabelText("One");
    const two = screen.getByLabelText("Two");
    const user = userEvent.setup();
    one.focus();
    await user.keyboard("{ArrowDown}");
    expect(two).toBeChecked();
  });

  it("navigates from a validation summary to a field on another page", async () => {
    const onSubmit = vi.fn().mockRejectedValueOnce({ fieldErrors: { choice: "Choose one" } });
    render(
      <FormRenderer
        schema={schema}
        initialValues={{ first: "Ada" }}
        onSubmit={onSubmit}
        pageTransition={{ scroll: "none", focus: "none" }}
        slots={{
          renderValidationSummary: ({ issues, onIssueSelect }) => (
            <div role="alert">
              {issues.map((issue) => (
                <button type="button" key={issue.fieldId} onClick={() => onIssueSelect(issue)}>
                  {issue.fieldId}
                </button>
              ))}
            </div>
          )
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    const issue = await screen.findByRole("button", { name: "choice" });
    fireEvent.click(issue);
    await waitFor(() => expect(screen.getByLabelText("One")).toHaveFocus());
  });

  it("keeps the validation target focused with the default page transition", async () => {
    const onSubmit = vi.fn().mockRejectedValueOnce({ fieldErrors: { choice: "Choose one" } });
    render(
      <FormRenderer
        schema={schema}
        initialValues={{ first: "Ada" }}
        onSubmit={onSubmit}
        slots={{
          renderValidationSummary: ({ issues, onIssueSelect }) => (
            <div role="alert">
              {issues.map((issue) => (
                <button type="button" key={issue.fieldId} onClick={() => onIssueSelect(issue)}>
                  {issue.fieldId}
                </button>
              ))}
            </div>
          )
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    fireEvent.click(await screen.findByRole("button", { name: "choice" }));
    await waitFor(() => expect(screen.getByLabelText("One")).toHaveFocus());
  });

  it("applies first-field page focus and exposes renderer state attributes", async () => {
    const { container } = render(
      <FormRenderer
        schema={schema}
        pageTransition={{ scroll: "instant", focus: "first-field" }}
        onSubmit={() => undefined}
      />
    );

    await waitFor(() => expect(container.querySelector("form")).toHaveAttribute("data-form-id", "respondent-api"));
    expect(screen.getByText("Page one").closest("section")).toHaveAttribute("data-active", "true");
    expect(screen.getByLabelText(/First/).closest("[data-field-id]")).toHaveAttribute("data-invalid", "false");
  });

  it("uses instant scrolling by default when reduced motion is preferred", async () => {
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    try {
      render(<FormRenderer schema={schema} onSubmit={() => undefined} pageTransition={{ focus: "none" }} />);
      fireEvent.change(screen.getByLabelText(/First/), { target: { value: "Ada" } });
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
      await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" }));
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
      vi.unstubAllGlobals();
    }
  });
});
