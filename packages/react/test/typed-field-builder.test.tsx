import type { FormSchema } from "@form-engine-ts/core";
import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { conditionOperators } from "../src/builderConditions";
import { useFormBuilder } from "../src/hooks/useFormBuilder";

describe("typed field builder support", () => {
  it("creates typed string fields without choice options", () => {
    const schema: FormSchema = { id: "typed-builder", version: 1, title: "Typed", fields: [] };
    const { result } = renderHook(() => {
      const [current, setCurrent] = useState(schema);
      return useFormBuilder({ schema: current, onChange: setCurrent });
    });
    act(() => {
      result.current.addField("email");
    });
    act(() => {
      result.current.addField("date");
    });
    expect(result.current.schema.fields.map((field) => field.type)).toEqual(["email", "date"]);
    expect(result.current.schema.fields.every((field) => !("options" in field))).toBe(true);
  });

  it("offers range operators for date and time conditions", () => {
    expect(conditionOperators({ id: "date", type: "date", title: "Date", required: false })).toContain("greater_than");
    expect(conditionOperators({ id: "time", type: "time", title: "Time", required: false })).toContain("less_than");
  });
});
