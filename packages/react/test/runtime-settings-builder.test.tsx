import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FormBuilder } from "../src";

describe("FormBuilder runtime settings", () => {
  it("edits current settings without changing the versioned schema", () => {
    const onChange = vi.fn();
    const onRuntimeSettingsChange = vi.fn();
    const schema = { id: "runtime-form", version: 4, title: "Versioned title", fields: [] };
    render(
      <FormBuilder
        schema={schema}
        onChange={onChange}
        runtimeSettings={{ formId: schema.id, updatedAt: "2026-09-01T00:00:00.000Z" }}
        onRuntimeSettingsChange={onRuntimeSettingsChange}
        runtimeSettingsOptions={{
          enabled: true,
          iconOptions: [{ value: "event", label: "Event" }],
          colorOptions: [{ value: "blue", label: "Blue" }]
        }}
        features={{ pages: false, localization: false, conditions: false }}
      />
    );

    expect(document.getElementById("builder-open-at")).toBeNull();
    fireEvent.change(screen.getByLabelText("Maximum responses"), { target: { value: "20" } });
    expect(onRuntimeSettingsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ formId: schema.id, maxResponses: 20 })
    );
    fireEvent.change(screen.getByLabelText("Icon"), { target: { value: "event" } });
    expect(onRuntimeSettingsChange).toHaveBeenLastCalledWith(expect.objectContaining({ iconKey: "event" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(schema.version).toBe(4);
  });
});
