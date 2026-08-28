import type { FormSchema } from "@form-engine-ts/core";
import { act, renderHook } from "@testing-library/react";
import { useTranslationWorkspace } from "../src";

const schema: FormSchema = {
  id: "workspace-policy",
  version: 1,
  title: "Survey",
  defaultLocale: "en",
  supportedLocales: ["en"],
  fields: [{ id: "name", type: "text", title: "Name", required: false }]
};

describe("useTranslationWorkspace locale policy", () => {
  it("rejects disallowed locales without changing the schema", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useTranslationWorkspace({ schema, onChange, policy: { allowedLocales: ["ja", "en"], maxLocales: 2 } })
    );

    let addResult: { success: boolean; error?: string } | undefined;
    act(() => {
      addResult = result.current.addLocale("fr");
    });
    expect(addResult).toEqual({ success: false, error: 'Locale "fr" is not allowed by the form policy.' });
    expect(result.current.isAddLocaleAllowed("fr")).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("blocks additions at maxLocales and removes all locale data", () => {
    const onChange = vi.fn();
    const current: FormSchema = {
      ...schema,
      supportedLocales: ["en", "ja"],
      translations: { ja: { title: "調査" } },
      translationMetadata: { ja: { title: { source: "human" } } }
    };
    const { result } = renderHook(() =>
      useTranslationWorkspace({ schema: current, onChange, policy: { maxLocales: 2 }, targetLocale: "ja" })
    );

    expect(result.current.addLocale("fr")).toEqual({
      success: false,
      error: "At most 2 locales are allowed by the form policy."
    });
    expect(result.current.isAddLocaleAllowed("fr")).toBe(false);
    act(() => result.current.removeLocale("ja"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ supportedLocales: ["en"] }));
    const removed = onChange.mock.calls[0]?.[0] as FormSchema | undefined;
    expect(removed?.translations).toBeUndefined();
    expect(removed?.translationMetadata).toBeUndefined();
  });

  it("uses a custom locale validator when provided", () => {
    const validateLocale = vi.fn((locale: string) =>
      locale === "ja"
        ? { valid: true }
        : { valid: false, error: { type: "locale_not_allowed" as const, message: "Custom rejection" } }
    );
    const { result } = renderHook(() => useTranslationWorkspace({ schema, validateLocale }));
    expect(result.current.addLocale("fr")).toEqual({ success: false, error: "Custom rejection" });
    expect(result.current.addLocale("ja")).toEqual({ success: true });
    expect(validateLocale).toHaveBeenCalledWith("fr", expect.arrayContaining(["en"]));
  });
});
