import type { FormField, FormSchema, TranslationAdapter } from "@form-engine-ts/core";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { type FormContextValue, FormProvider, FormRenderer, useForm, useFormBuilder } from "../src";

function textField(id: string): FormField {
  return { id, type: "text", title: id, required: false };
}

describe("useFormBuilder", () => {
  it("returns typed policy failures without changing a schema at the ARGS limits", () => {
    const maxFieldsSchema: FormSchema = {
      id: "policy",
      version: 2,
      title: "Policy",
      fields: Array.from({ length: 20 }, (_, index) => textField(`q${index + 1}`))
    };
    const { result } = renderHook(() => {
      const [schema, setSchema] = useState(maxFieldsSchema);
      return useFormBuilder({
        schema,
        onChange: setSchema,
        policy: { maxFields: 20, maxOptionsPerField: 10, allowedFieldTypes: ["text", "select"] }
      });
    });
    let fieldResult: ReturnType<typeof result.current.addField> | undefined;
    act(() => {
      fieldResult = result.current.addField("text");
    });
    expect(fieldResult).toEqual({ success: false, error: { type: "max_fields_exceeded", max: 20 } });
    expect(result.current.schema.fields).toHaveLength(20);
    act(() => {
      fieldResult = result.current.addField("rating");
    });
    expect(fieldResult).toEqual({
      success: false,
      error: { type: "disallowed_field_type", fieldType: "rating" }
    });

    const optionSchema: FormSchema = {
      id: "options",
      version: 2,
      title: "Options",
      fields: [
        {
          id: "choice",
          type: "select",
          title: "Choice",
          required: false,
          options: Array.from({ length: 10 }, (_, index) => ({ id: `o${index + 1}`, label: `Option ${index + 1}` }))
        }
      ]
    };
    const options = renderHook(() => {
      const [schema, setSchema] = useState(optionSchema);
      return useFormBuilder({ schema, onChange: setSchema, policy: { maxOptionsPerField: 10 } });
    });
    let optionResult: ReturnType<typeof options.result.current.addOption> | undefined;
    act(() => {
      optionResult = options.result.current.addOption("choice");
    });
    expect(optionResult).toEqual({ success: false, error: { type: "max_options_exceeded", max: 10 } });
    const choice = options.result.current.schema.fields[0];
    expect(choice !== undefined && "options" in choice ? choice.options : []).toHaveLength(10);
  });

  it("uses a custom idFactory for field, option, and page IDs", () => {
    const initial: FormSchema = {
      id: "ids",
      version: 2,
      title: "IDs",
      fields: [
        {
          id: "seed",
          type: "select",
          title: "Seed",
          required: false,
          options: [{ id: "seed-option", label: "Seed" }]
        }
      ]
    };
    const { result } = renderHook(() => {
      const [schema, setSchema] = useState(initial);
      return useFormBuilder({
        schema,
        onChange: setSchema,
        idFactory: (kind, existingIds) => `args_${kind}_${existingIds.size}`
      });
    });
    act(() => {
      expect(result.current.addField("text").success).toBe(true);
    });
    expect(result.current.schema.fields[1]?.id).toBe("args_field_1");
    act(() => {
      expect(result.current.addOption("seed").success).toBe(true);
    });
    const choice = result.current.schema.fields[0];
    expect(choice !== undefined && "options" in choice ? choice.options[1]?.id : undefined).toBe("args_option_1");
    act(() => result.current.addPage());
    expect(result.current.schema.pages?.[0]?.id).toBe("args_page_0");
  });
});

describe("FormRenderer v2 lifecycle and slots", () => {
  const schema: FormSchema = {
    id: "renderer-v2",
    version: 2,
    title: "Renderer",
    completionMessage: "Complete",
    fields: [{ id: "name", type: "text", title: "Name", required: true }]
  };

  beforeEach(() => localStorage.clear());

  it("returns every typed submit lifecycle result", async () => {
    const translator: TranslationAdapter = { translate: (key) => key };
    const onSubmit = vi.fn();
    let formApi: FormContextValue | undefined;
    function Capture() {
      formApi = useForm();
      return null;
    }
    render(
      <FormProvider schema={schema} locale="en" translator={translator} onSubmit={onSubmit}>
        <Capture />
      </FormProvider>
    );
    if (formApi === undefined) throw new Error("Expected the form API");
    let result: Awaited<ReturnType<FormContextValue["submit"]>> | undefined;
    await act(async () => {
      result = await formApi?.submit();
    });
    expect(result).toMatchObject({ status: "invalid", issues: [expect.objectContaining({ fieldId: "name" })] });
    act(() => formApi?.restoreValues({ name: "Ada" }));
    await act(async () => {
      result = await formApi?.submit(() => "cancel");
    });
    expect(result).toEqual({ status: "cancelled" });
    expect(onSubmit).not.toHaveBeenCalled();
    await act(async () => {
      result = await formApi?.submit();
    });
    expect(result).toEqual({ status: "success" });
    expect(onSubmit).toHaveBeenCalledWith({ name: "Ada" });
    onSubmit.mockRejectedValueOnce(new Error("boom"));
    await act(async () => {
      result = await formApi?.submit();
    });
    expect(result).toMatchObject({ status: "error", error: expect.objectContaining({ message: "boom" }) });
  });

  it("cancels before submit while preserving the input and draft", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const beforeSubmit = vi.fn(async () => "cancel" as const);
    const onDraftSave = vi.fn();
    render(
      <FormRenderer
        schema={schema}
        onSubmit={onSubmit}
        beforeSubmit={beforeSubmit}
        onDraftSave={onDraftSave}
        autoSaveKey="renderer-v2-draft"
      />
    );
    await user.type(screen.getByLabelText(/Name/), "Ada");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(beforeSubmit).toHaveBeenCalledWith({ name: "Ada" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Name/)).toHaveValue("Ada");
    await waitFor(() => expect(onDraftSave).toHaveBeenCalledWith({ name: "Ada" }), { timeout: 1500 });
    expect(localStorage.getItem("renderer-v2-draft")).toContain('"name":"Ada"');
  });

  it("replaces every default UI region with slots and renders completion", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <FormRenderer
        schema={schema}
        initialValues={{ name: "Ada" }}
        onSubmit={onSubmit}
        slots={{
          renderHeader: ({ title }) => <div data-testid="slot-header">custom:{title}</div>,
          renderField: ({ question, value, onChange }) => (
            <button type="button" data-testid="slot-field" onClick={() => onChange("Grace")}>
              {question.id}:{String(value)}
            </button>
          ),
          renderNavigation: ({ totalPages }) => <div data-testid="slot-navigation">pages:{totalPages}</div>,
          renderSubmitButton: ({ onSubmit: submit }) => (
            <button type="button" data-testid="slot-submit" onClick={submit}>
              custom-submit
            </button>
          ),
          renderValidationSummary: ({ issues }) => <div data-testid="slot-summary">issues:{issues.length}</div>,
          renderCompletion: ({ message }) => <div data-testid="slot-completion">custom:{message}</div>
        }}
      />
    );
    expect(screen.queryByRole("heading", { name: "Renderer" })).not.toBeInTheDocument();
    expect(document.querySelector(".fe-field")).toBeNull();
    expect(screen.getByTestId("slot-header")).toHaveTextContent("custom:Renderer");
    expect(screen.getByTestId("slot-navigation")).toHaveTextContent("pages:1");
    await user.click(screen.getByTestId("slot-field"));
    await user.click(screen.getByTestId("slot-submit"));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: "Grace" }));
    expect(screen.getByTestId("slot-completion")).toHaveTextContent("custom:Complete");
  });
});
