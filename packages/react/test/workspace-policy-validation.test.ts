import type { FormSchema } from "@form-engine-ts/core";
import { act, renderHook } from "@testing-library/react";
import { useTranslationWorkspace, validateLocalePipeline } from "../src";

const schema: FormSchema = {
  id: "workspace-policy-validation",
  version: 1,
  title: "Survey",
  defaultLocale: "ja",
  supportedLocales: ["en"],
  fields: [{ id: "name", type: "text", title: "Name", required: false }]
};

describe("useTranslationWorkspace locale validation pipeline", () => {
  it("runs built-in format, duplicate, and policy validation before custom validation", () => {
    const customValidator = vi.fn(() => ({ valid: true }));
    const policy = { allowedLocales: ["ja", "en"], maxLocales: 2 } as const;

    expect(validateLocalePipeline("invalid-locale-format", schema, policy, customValidator).error?.type).toBe(
      "invalid_locale_format"
    );
    expect(validateLocalePipeline("fr", schema, policy, customValidator).error?.type).toBe("locale_not_allowed");
    expect(validateLocalePipeline("en", schema, policy, customValidator).error?.type).toBe("locale_already_exists");
    expect(customValidator).not.toHaveBeenCalled();
  });

  it("passes policy-approved locales to the custom validator and returns its rejection", () => {
    const customValidator = vi.fn((locale: string) =>
      locale === "en"
        ? { valid: false, error: { type: "custom_validation_failed" as const, message: "Tenant constraint" } }
        : { valid: true }
    );
    const { result } = renderHook(() =>
      useTranslationWorkspace({
        schema: { ...schema, supportedLocales: [] },
        policy: { maxLocales: 2 },
        validateLocale: customValidator
      })
    );

    let addResult: { readonly success: boolean; readonly error?: string } | undefined;
    act(() => {
      addResult = result.current.addLocale("en");
    });

    expect(addResult).toEqual({ success: false, error: "Tenant constraint" });
    expect(customValidator).toHaveBeenCalledWith(
      "en",
      expect.objectContaining({ locale: "en", defaultLocale: "ja", currentLocales: [] })
    );
  });
});
