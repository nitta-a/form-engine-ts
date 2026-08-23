import type { FormSchema, FormValues } from "@form-engine/core";
import type { SafeParseReturnType, ZodIssue } from "zod";
import { createZodFormSchema } from "../src";

const schema = {
  id: "survey",
  version: 1,
  titleKey: "title",
  fields: [
    { id: "text", type: "text", labelKey: "text", required: true, minLength: 2, maxLength: 4, pattern: "^[A-Z]+$" },
    { id: "textarea", type: "textarea", labelKey: "textarea", maxLength: 5 },
    { id: "number", type: "number", labelKey: "number", min: 2, max: 10, step: 2 },
    { id: "rating", type: "rating", labelKey: "rating", min: 1, max: 5 },
    {
      id: "select",
      type: "select",
      labelKey: "select",
      options: [
        { value: "a", labelKey: "a" },
        { value: "b", labelKey: "b" }
      ]
    },
    {
      id: "radio",
      type: "radio",
      labelKey: "radio",
      options: [
        { value: "yes", labelKey: "yes" },
        { value: "no", labelKey: "no" }
      ]
    },
    {
      id: "multi",
      type: "multi-select",
      labelKey: "multi",
      minSelections: 2,
      maxSelections: 2,
      options: [
        { value: "x", labelKey: "x" },
        { value: "y", labelKey: "y" }
      ]
    },
    { id: "checkbox", type: "checkbox", labelKey: "checkbox", required: true }
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
      titleKey: "title",
      fields: [
        {
          id: "choice",
          type: "select",
          labelKey: "choice",
          options: [
            { value: "yes", labelKey: "yes" },
            { value: "no", labelKey: "no" }
          ]
        },
        {
          id: "details",
          type: "text",
          labelKey: "details",
          required: true,
          displayCondition: { questionId: "choice", operator: "equals", value: "yes" }
        },
        {
          id: "nested",
          type: "text",
          labelKey: "nested",
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
});
