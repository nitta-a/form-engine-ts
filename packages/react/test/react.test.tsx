import type { FormSchema, FormValues, TranslationAdapter } from "@form-engine/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { FormProvider, FormRenderer, useField } from "../src";

const schema = {
  id: "test",
  version: 1,
  titleKey: "title",
  submitLabelKey: "submit",
  fields: [
    { id: "name", type: "text", labelKey: "name", required: true, minLength: 2 },
    { id: "age", type: "number", labelKey: "age", min: 1 },
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
});
