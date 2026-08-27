import type { FormSchema } from "@form-engine-ts/core";
import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { useFormBuilder } from "../src";

describe("useFormBuilder field constraints", () => {
  it("applies rating defaults when adding a field", () => {
    const initial: FormSchema = {
      id: "builder",
      version: 1,
      title: "Builder",
      fields: [{ id: "first", type: "text", title: "First", required: false }]
    };
    const { result } = renderHook(() => {
      const [schema, setSchema] = useState(initial);
      return useFormBuilder({
        schema,
        onChange: setSchema,
        idFactory: () => "rating",
        policy: { fieldConstraints: { rating: { defaultMin: 1, defaultMax: 5 } } }
      });
    });

    act(() => {
      expect(result.current.addField("rating")).toEqual({ success: true });
    });
    expect(result.current.schema.fields[1]).toMatchObject({ type: "rating", min: 1, max: 5 });
  });

  it("rejects updates to fixed field properties", () => {
    const initial: FormSchema = {
      id: "builder",
      version: 1,
      title: "Builder",
      fields: [{ id: "rating", type: "rating", title: "Rating", required: false, min: 1, max: 5 }]
    };
    const { result } = renderHook(() => {
      const [schema, setSchema] = useState(initial);
      return useFormBuilder({
        schema,
        onChange: setSchema,
        policy: { fieldConstraints: { rating: { fixedMin: 1, fixedMax: 5 } } }
      });
    });

    let action: ReturnType<typeof result.current.updateField> | undefined;
    act(() => {
      action = result.current.updateField("rating", (field) => ({ ...field, min: 0 }));
    });
    expect(action).toEqual({ success: false, error: { type: "field_constraint_immutable" } });
    expect(result.current.schema.fields[0]).toMatchObject({ min: 1, max: 5 });
  });
});
