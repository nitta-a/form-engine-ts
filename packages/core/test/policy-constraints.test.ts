import { describe, expect, it } from "vitest";
import { type FormSchema, sanitizeSchema, validateFormSchema } from "../src";

const schema: FormSchema = {
  id: "constraints",
  version: 1,
  title: "Constraints",
  fields: [
    { id: "rating", type: "rating", title: "Rating", required: false, min: 0, max: 10 },
    { id: "text", type: "text", title: "Text", required: false, maxLength: 100 }
  ]
};

describe("field constraint policy", () => {
  it("reports fixed rating bounds and text length violations", () => {
    const result = validateFormSchema(schema, {
      policy: {
        fieldConstraints: {
          rating: { fixedMin: 1, fixedMax: 5 },
          text: { maxMaxLength: 20 }
        }
      }
    });

    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "field_constraint_violation",
          fieldId: "rating",
          property: "min",
          expected: 1
        }),
        expect.objectContaining({
          code: "field_constraint_violation",
          fieldId: "rating",
          property: "max",
          expected: 5
        }),
        expect.objectContaining({
          code: "field_constraint_violation",
          fieldId: "text",
          property: "maxLength",
          expected: 20
        })
      ])
    );
  });

  it("corrects fixed bounds, required state, and maximum text length", () => {
    expect(
      sanitizeSchema(schema, {
        policy: {
          fieldConstraints: {
            rating: { fixedMin: 1, fixedMax: 5, fixedRequired: true },
            text: { maxMaxLength: 20 }
          }
        }
      })
    ).toEqual({
      ...schema,
      fields: [
        { id: "rating", type: "rating", title: "Rating", required: true, min: 1, max: 5 },
        { id: "text", type: "text", title: "Text", required: false, maxLength: 20 }
      ]
    });
  });
});
