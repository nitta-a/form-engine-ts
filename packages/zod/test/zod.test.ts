import type { FormSchema, FormValues } from "@form-engine-ts/core";
import type { SafeParseReturnType, ZodIssue } from "zod";
import { createZodFormSchema } from "../src";

const schema = {
  id: "survey",
  version: 1,
  title: "title",
  fields: [
    { id: "text", type: "text", title: "text", required: true, minLength: 2, maxLength: 4, pattern: "^[A-Z]+$" },
    { id: "textarea", type: "textarea", title: "textarea", required: false, maxLength: 5 },
    { id: "number", type: "number", title: "number", required: false, min: 2, max: 10, step: 2 },
    { id: "rating", type: "rating", title: "rating", required: false, min: 1, max: 5 },
    {
      id: "select",
      type: "select",
      title: "select",
      required: false,
      options: [
        { id: "a", label: "a" },
        { id: "b", label: "b" }
      ]
    },
    {
      id: "radio",
      type: "radio",
      title: "radio",
      required: false,
      options: [
        { id: "yes", label: "yes" },
        { id: "no", label: "no" }
      ]
    },
    {
      id: "multi",
      type: "multi-select",
      title: "multi",
      required: false,
      minSelections: 2,
      maxSelections: 2,
      options: [
        { id: "x", label: "x" },
        { id: "y", label: "y" }
      ]
    },
    { id: "checkbox", type: "checkbox", title: "checkbox", required: true }
  ]
} as const satisfies FormSchema;

const validValues: FormValues = {
  text: "AB",
  textarea: "fine",
  number: 4,
  rating: 3,
  select: "a",
  radio: "yes",
  multi: ["x", "y"],
  checkbox: true
};

function issues(result: SafeParseReturnType<Record<string, unknown>, Record<string, unknown>>): ZodIssue[] {
  return result.success ? [] : result.error.issues;
}

function hasCoreIssue(result: SafeParseReturnType<Record<string, unknown>, Record<string, unknown>>, code: string) {
  return issues(result).some(
    (issue) => issue.code === "custom" && issue.params?.formEngineCode === code && issue.path.length > 0
  );
}

describe("createZodFormSchema", () => {
  it("accepts all current field types and preserves the parsed values", () => {
    const result = createZodFormSchema(schema).safeParse(validValues);
    expect(result).toEqual({ success: true, data: validValues });
  });

  it.each([
    [{ ...validValues, text: " " }, "required"],
    [{ ...validValues, text: "A" }, "min_length"],
    [{ ...validValues, text: "ABCDE" }, "max_length"],
    [{ ...validValues, text: "Ab" }, "pattern"],
    [{ ...validValues, textarea: 1 }, "invalid_type"],
    [{ ...validValues, number: 1 }, "min"],
    [{ ...validValues, number: 12 }, "max"],
    [{ ...validValues, number: 3 }, "step"],
    [{ ...validValues, rating: 2.5 }, "step"],
    [{ ...validValues, select: "other" }, "invalid_option"],
    [{ ...validValues, radio: false }, "invalid_type"],
    [{ ...validValues, multi: ["x"] }, "min_selections"],
    [{ ...validValues, multi: ["x", "y", "x"] }, "invalid_option"],
    [{ ...validValues, checkbox: false }, "required"]
  ])("maps Core validation failures into Zod issues", (values, code) => {
    expect(hasCoreIssue(createZodFormSchema(schema).safeParse(values), code)).toBe(true);
  });

  it("reports unknown answer IDs at their paths with translation metadata", () => {
    const result = createZodFormSchema(schema).safeParse({ ...validValues, unknown: "value" });
    const issue = issues(result).find((item) => item.path[0] === "unknown");
    expect(issue).toMatchObject({
      code: "custom",
      path: ["unknown"],
      message: "validation.unknownField",
      params: { formEngineCode: "unknown_field", messageKey: "validation.unknownField", validationParams: {} }
    });
  });

  it("uses chained visibility, ignores hidden invalid values, and does not transform them away", () => {
    const conditional: FormSchema = {
      id: "conditional",
      version: 1,
      title: "title",
      fields: [
        {
          id: "choice",
          type: "select",
          title: "choice",
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
          required: true,
          displayCondition: { questionId: "choice", operator: "equals", value: "yes" }
        },
        {
          id: "nested",
          type: "text",
          title: "nested",
          required: true,
          displayCondition: { questionId: "details", operator: "not_empty" }
        }
      ]
    };
    const validator = createZodFormSchema(conditional);
    const hidden = { choice: "no", details: 42, nested: { stale: true } };
    expect(validator.safeParse(hidden)).toEqual({ success: true, data: hidden });
    expect(hasCoreIssue(validator.safeParse({ choice: "yes", details: "" }), "required")).toBe(true);
    const nested = validator.safeParse({ choice: "yes", details: "shown" });
    expect(issues(nested).some((issue) => issue.path[0] === "nested")).toBe(true);
  });

  it("rejects a malformed FormSchema when creating the validator", () => {
    expect(() => createZodFormSchema({ ...schema, fields: [] })).toThrow(TypeError);
  });

  it("creates a page-scoped validator without rejecting answers from other pages", () => {
    const paged: FormSchema = {
      id: "paged",
      version: 1,
      title: "paged",
      fields: [
        { id: "first", type: "text", title: "first", required: true },
        { id: "second", type: "text", title: "second", required: true }
      ],
      pages: [
        { id: "one", questionIds: ["first"] },
        { id: "two", questionIds: ["second"] }
      ]
    };
    const firstPage = createZodFormSchema(paged, { pageIndex: 0 });
    expect(hasCoreIssue(firstPage.safeParse({ second: "kept" }), "required")).toBe(true);
    expect(firstPage.safeParse({ first: "done", second: "kept", external: true })).toEqual({
      success: true,
      data: { first: "done", second: "kept", external: true }
    });
    expect(createZodFormSchema(paged, { pageIndex: 99 }).safeParse({ external: true })).toEqual({
      success: true,
      data: { external: true }
    });
  });
});
