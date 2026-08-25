import {
  type FormField,
  type FormPolicy,
  type FormSchema,
  type TranslationAdapter,
  validateFormSchema
} from "@form-engine-ts/core";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { FormBuilder, type FormContextValue, FormProvider, FormRenderer, useForm, useFormBuilder } from "../src";

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

  it("rejects empty or duplicate IDs for every node operation without updating", () => {
    const initial: FormSchema = {
      id: "duplicate-ids",
      version: 1,
      title: "IDs",
      fields: [
        {
          id: "seed",
          type: "select",
          title: "Seed",
          required: false,
          options: [{ id: "seed-option", label: "Seed" }]
        },
        textField("other")
      ],
      pages: [{ id: "page-existing", questionIds: ["seed", "other"] }]
    };
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useFormBuilder({
        schema: initial,
        onChange,
        idFactory: (kind) => ({ field: "seed", option: "seed-option", page: "page-existing" })[kind]
      })
    );
    expect(result.current.addField("text")).toEqual({
      success: false,
      error: { type: "invalid_id", kind: "field", id: "seed" }
    });
    expect(result.current.addOption("seed")).toEqual({
      success: false,
      error: { type: "invalid_id", kind: "option", id: "seed-option" }
    });
    expect(result.current.addPage("other")).toEqual({
      success: false,
      error: { type: "invalid_id", kind: "page", id: "page-existing" }
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("uses injected factories and preserves metadata through type and translation actions", () => {
    const initial: FormSchema = {
      id: "headless",
      version: 1,
      title: "Headless",
      defaultLocale: "en",
      supportedLocales: ["en", "ja"],
      fields: [
        {
          id: "seed",
          type: "select",
          title: "Seed",
          required: false,
          translations: { ja: { title: "種" } },
          metadata: { owner: "args" },
          translationMetadata: { ja: { title: { isManual: true } } },
          options: [{ id: "one", label: "One" }]
        }
      ]
    };
    const { result } = renderHook(() => {
      const [schema, setSchema] = useState(initial);
      return useFormBuilder({
        schema,
        onChange: setSchema,
        idFactory: (kind) => `custom-${kind}`,
        factories: {
          createField: (type, id) => ({
            id,
            type: type === "text" ? type : "text",
            title: "Factory field",
            required: false
          }),
          createOption: (_field, id) => ({ id, label: "Factory option" }),
          createPage: (id, questionIds) => ({ id, title: "Factory page", questionIds })
        }
      });
    });
    act(() => expect(result.current.changeFieldType("seed", "textarea").success).toBe(true));
    expect(result.current.schema.fields[0]).toMatchObject({
      type: "textarea",
      translations: initial.fields[0]?.translations,
      metadata: { owner: "args" },
      translationMetadata: initial.fields[0]?.translationMetadata
    });
    act(() =>
      expect(
        result.current.setLocaleTranslation("fr", { kind: "field", id: "seed" }, "title", "Graine", {
          metadata: { isManual: true }
        }).success
      ).toBe(true)
    );
    expect(result.current.schema.fields[0]?.translationMetadata?.fr?.title).toEqual({ isManual: true });
    act(() => expect(result.current.changeFieldType("seed", "select").success).toBe(true));
    const restoredChoice = result.current.schema.fields[0];
    expect(restoredChoice !== undefined && "options" in restoredChoice ? restoredChoice.options[0] : undefined).toEqual(
      {
        id: "custom-option",
        label: "Factory option"
      }
    );
    act(() => expect(result.current.addField("text").success).toBe(true));
    expect(result.current.schema.fields[1]).toMatchObject({ id: "custom-field", title: "Factory field" });
    act(() => expect(result.current.addPage().success).toBe(true));
    expect(result.current.schema.pages?.[0]).toMatchObject({ id: "custom-page", title: "Factory page" });
  });

  it("uses exactly the same Core policy issues as the headless builder", () => {
    const schema: FormSchema = {
      id: "policy-parity",
      version: 1,
      title: "Form",
      completionMessage: "Done",
      defaultLocale: "en",
      supportedLocales: ["en", "ja", "fr"],
      fields: [{ id: "name", type: "text", title: "Name", description: "Description", required: false }]
    };
    const policy: FormPolicy = {
      maxFields: 20,
      maxOptionsPerField: 10,
      maxTextLength: 500,
      requiredLocales: ["en", "ja", "fr", "de"]
    };
    const core = validateFormSchema(schema, { policy });
    if (core.valid) throw new Error("Expected policy issues");
    const { result } = renderHook(() => useFormBuilder({ schema, onChange: vi.fn(), policy }));
    expect(result.current.validationIssues).toEqual(core.issues);
  });

  it("executes the extended option, page, condition, and source-text actions", () => {
    const initial: FormSchema = {
      id: "extended-actions",
      version: 1,
      title: "Actions",
      fields: [
        textField("prior"),
        {
          id: "choice",
          type: "select",
          title: "Choice",
          required: false,
          options: [{ id: "one", label: "One" }]
        }
      ],
      pages: [
        { id: "first", title: "First", questionIds: ["prior"] },
        { id: "second", title: "Second", questionIds: ["choice"] }
      ]
    };
    const { result } = renderHook(() => {
      const [schema, setSchema] = useState(initial);
      return useFormBuilder({ schema, onChange: setSchema });
    });
    act(() =>
      expect(result.current.updateOption("choice", "one", (option) => ({ ...option, label: "Updated" })).success).toBe(
        true
      )
    );
    act(() =>
      expect(result.current.setSourceText({ kind: "page", id: "first" }, "description", "Intro").success).toBe(true)
    );
    act(() =>
      expect(result.current.setDisplayCondition("choice", { questionId: "prior", operator: "not_empty" }).success).toBe(
        true
      )
    );
    act(() => expect(result.current.movePage("second", 0).success).toBe(true));
    expect(result.current.schema.pages?.map((page) => page.id)).toEqual(["second", "first"]);
    act(() => expect(result.current.assignFieldToPage("prior", "second").success).toBe(true));
    expect(result.current.schema.pages).toEqual([
      expect.objectContaining({ id: "second", questionIds: ["prior", "choice"] })
    ]);
    const choice = result.current.schema.fields[1];
    expect(choice !== undefined && "options" in choice ? choice.options[0]?.label : undefined).toBe("Updated");
    expect(choice?.displayCondition).toEqual({ questionId: "prior", operator: "not_empty" });
  });
});

describe("FormBuilder v2.1 UI", () => {
  it("edits source and localized completion messages and forwards translation options and reports", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onTranslationReport = vi.fn();
    const schema: FormSchema = {
      id: "builder-ui",
      version: 1,
      title: "Builder",
      completionMessage: "Done",
      defaultLocale: "en",
      supportedLocales: ["en", "ja"],
      fields: [{ id: "name", type: "text", title: "Name", required: false }]
    };
    const adapter = {
      translateText: vi.fn(async (text: string) => `ja:${text}`),
      translateBatch: vi.fn(async (texts: readonly string[]) => texts.map((text) => `ja:${text}`))
    };
    function ControlledBuilder() {
      const [current, setCurrent] = useState(schema);
      return (
        <FormBuilder
          schema={current}
          onChange={(next) => {
            onChange(next);
            setCurrent(next);
          }}
          translationAdapter={adapter}
          translationOptions={{ overwrite: "missing-only" }}
          onTranslationReport={onTranslationReport}
        />
      );
    }
    render(<ControlledBuilder />);
    await user.clear(screen.getByLabelText("Completion message"));
    await user.type(screen.getByLabelText("Completion message"), "Finished");
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ completionMessage: "Finished" }));
    await user.selectOptions(screen.getByLabelText("Edit locale"), "ja");
    const completionInputs = screen.getAllByLabelText("Completion message");
    expect(completionInputs).toHaveLength(2);
    const localizedCompletion = completionInputs[1];
    if (localizedCompletion === undefined) throw new Error("Expected localized completion editor");
    await user.type(localizedCompletion, "完了");
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        translations: expect.objectContaining({ ja: expect.objectContaining({ completionMessage: "完了" }) })
      })
    );
    await user.click(screen.getByRole("button", { name: "Translate all text" }));
    await waitFor(() => expect(onTranslationReport).toHaveBeenCalled());
    expect(adapter.translateBatch).toHaveBeenCalled();
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
    expect(onSubmit).toHaveBeenCalledWith({ name: "Ada" }, expect.objectContaining({ formId: "renderer-v2" }));
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
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ name: "Grace" }, expect.objectContaining({ formId: "renderer-v2" }))
    );
    expect(screen.getByTestId("slot-completion")).toHaveTextContent("custom:Complete");
  });

  it("replaces page headers and submit errors without rendering their defaults", async () => {
    const user = userEvent.setup();
    const paged: FormSchema = {
      ...schema,
      pages: [{ id: "main", title: "Default page", description: "Default description", questionIds: ["name"] }]
    };
    render(
      <FormRenderer
        schema={paged}
        initialValues={{ name: "Ada" }}
        onSubmit={async () => {
          throw new Error("network unavailable");
        }}
        errorMessageKey="fallback.error"
        slots={{
          renderPageHeader: ({ page, pageIndex, totalPages }) => (
            <div data-testid="page-header-slot">
              {page.id}:{pageIndex + 1}/{totalPages}
            </div>
          ),
          renderSubmitError: ({ error, onRetry }) => (
            <button type="button" data-testid="submit-error-slot" onClick={onRetry}>
              {error.message}
            </button>
          )
        }}
      />
    );
    expect(screen.getByTestId("page-header-slot")).toHaveTextContent("main:1/1");
    expect(screen.queryByText("Default page")).not.toBeInTheDocument();
    expect(document.querySelector(".fe-page-header")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByTestId("submit-error-slot")).toHaveTextContent("network unavailable");
    expect(screen.queryByText("fallback.error")).not.toBeInTheDocument();
  });
});
