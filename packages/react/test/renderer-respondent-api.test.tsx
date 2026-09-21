import type { FormSchema } from "@form-engine-ts/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FieldComponentProps, RespondentRadioProps, RespondentTextInputProps } from "../src";
import { FormRenderer } from "../src";

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
});
