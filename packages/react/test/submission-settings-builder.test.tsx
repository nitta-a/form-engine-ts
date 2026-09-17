import type { FormSchema } from "@form-engine-ts/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { FormBuilder } from "../src";

const schema: FormSchema = {
  id: "settings-builder",
  version: 1,
  title: "Settings",
  fields: []
};

describe("submission settings builder", () => {
  it("writes acceptance settings into the schema", () => {
    function ControlledBuilder() {
      const [current, setCurrent] = useState(schema);
      return <FormBuilder schema={current} onChange={setCurrent} submissionSettingsOptions={{ enabled: true }} />;
    }
    render(<ControlledBuilder />);
    fireEvent.change(screen.getByLabelText("Open at (ISO timestamp)"), {
      target: { value: "2026-09-17T00:00" }
    });
    fireEvent.change(screen.getByLabelText("Maximum responses"), { target: { value: "25" } });
    fireEvent.change(screen.getByLabelText("Closed message"), { target: { value: "Closed for now" } });
    fireEvent.change(screen.getByLabelText("Anti-spam hidden field ID"), { target: { value: "website" } });
    expect(screen.getByLabelText("Open at (ISO timestamp)")).toHaveValue("2026-09-17T00:00");
    expect(screen.getByLabelText("Maximum responses")).toHaveValue(25);
    expect(screen.getByLabelText("Closed message")).toHaveValue("Closed for now");
    expect(screen.getByLabelText("Anti-spam hidden field ID")).toHaveValue("website");
  });
});
