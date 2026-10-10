import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { customerFeedbackSchema } from "../workspace/schema";
import { SurveySchemaTools } from "./SurveySchemaTools";

afterEach(cleanup);

function showImport(onChange = vi.fn()) {
  render(<SurveySchemaTools schema={customerFeedbackSchema} locale="en" onChange={onChange} />);
  fireEvent.click(screen.getByText("Import questionnaire JSON"));
  return { input: screen.getByLabelText("Questionnaire JSON"), onChange };
}

function importJson(input: HTMLElement, json: string) {
  fireEvent.change(input, { target: { value: json } });
  fireEvent.click(screen.getByRole("button", { name: "Validate and replace questionnaire" }));
}

describe("questionnaire JSON backup", () => {
  it("validates imported JSON and selects the saved questionnaire", async () => {
    const { input, onChange } = showImport();
    const nextSchema = { ...customerFeedbackSchema, id: "imported-survey", title: "Customer experience" };
    importJson(input, JSON.stringify(nextSchema));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(nextSchema));
    expect(await screen.findByRole("status")).toHaveTextContent("Questionnaire imported.");
    expect(input).toHaveValue("");
  });

  it("preserves the current questionnaire when JSON or its schema is invalid", () => {
    const { input, onChange } = showImport();
    importJson(input, "{");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter valid JSON.");
    importJson(input, JSON.stringify({ ...customerFeedbackSchema, fields: [{ id: "q1", type: "unknown" }] }));
    expect(screen.getByRole("alert")).toHaveTextContent("The questionnaire could not be imported.");
    expect(screen.getByRole("alert")).toHaveTextContent("fields[0]");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("reports storage failures without clearing the pasted backup", async () => {
    const onChange = vi.fn().mockRejectedValue(new Error("Storage full"));
    const { input } = showImport(onChange);
    const json = JSON.stringify(customerFeedbackSchema);
    importJson(input, json);
    expect(await screen.findByRole("alert")).toHaveTextContent("The questionnaire could not be saved. Storage full");
    expect(input).toHaveValue(json);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("rejects questionnaires exceeding the editor's question limit", () => {
    const { input, onChange } = showImport();
    const nextSchema = {
      ...customerFeedbackSchema,
      pages: undefined,
      fields: Array.from({ length: 21 }, (_, index) => ({
        id: `question-${index}`,
        type: "text",
        title: `Question ${index + 1}`,
        required: false
      }))
    };
    importJson(input, JSON.stringify(nextSchema));
    expect(screen.getByRole("alert")).toHaveTextContent(/at most 20/i);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("waits for persistence before reporting success", async () => {
    let finish: (() => void) | undefined;
    const onChange = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    const { input } = showImport(onChange);
    importJson(input, JSON.stringify(customerFeedbackSchema));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Validate and replace questionnaire" })).toBeDisabled();
    finish?.();
    expect(await screen.findByRole("status")).toHaveTextContent("Questionnaire imported.");
  });

  it("downloads a JSON backup of the current questionnaire and releases the URL", async () => {
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    const create = vi.fn((_blob: Blob) => "blob:questionnaire-backup");
    const revoke = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: create });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    try {
      render(<SurveySchemaTools schema={customerFeedbackSchema} locale="ja" onChange={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: "アンケートをJSONで保存" }));
      const blob = create.mock.calls[0]?.[0];
      if (blob === undefined) throw new Error("Expected a questionnaire backup blob.");
      expect(blob.type).toBe("application/json;charset=utf-8");
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(blob);
      });
      expect(JSON.parse(text)).toEqual(customerFeedbackSchema);
      expect(click).toHaveBeenCalledOnce();
      expect(revoke).toHaveBeenCalledWith("blob:questionnaire-backup");
    } finally {
      click.mockRestore();
      Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreate });
      Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: originalRevoke });
    }
  });
});
