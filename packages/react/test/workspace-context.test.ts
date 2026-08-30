import type { FormSchema } from "@form-engine-ts/core";
import { act, renderHook } from "@testing-library/react";
import { type CustomLocaleValidator, useTranslationWorkspace } from "../src";

const schema: FormSchema = {
  id: "workspace-context",
  version: 1,
  title: "Survey",
  defaultLocale: "JA",
  supportedLocales: ["en"],
  fields: [{ id: "name", type: "text", title: "Name", required: false }]
};

describe("useTranslationWorkspace locale context", () => {
  it("passes a plain object context with canonical locale values", () => {
    const customValidator: CustomLocaleValidator = (locale, context) => {
      expect(locale).toBe("en-US");
      expect(Array.isArray(context)).toBe(false);
      expect(Object.getPrototypeOf(context)).toBe(Object.prototype);
      expect(Object.keys(context)).toEqual(["locale", "defaultLocale", "currentLocales", "policy"]);
      expect(context).toEqual({
        locale: "en-US",
        defaultLocale: "ja",
        currentLocales: ["en"],
        policy: { allowedLocales: ["en-US", "ja-JP"] }
      });
      expect(Object.isFrozen(context.currentLocales)).toBe(true);
      return true;
    };
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useTranslationWorkspace({
        schema,
        onChange,
        policy: { allowedLocales: ["en-US", "ja-JP"] },
        validateLocale: customValidator
      })
    );

    let addResult: ReturnType<typeof result.current.addLocale> | undefined;
    act(() => {
      addResult = result.current.addLocale("EN_us");
    });

    expect(addResult).toEqual({ success: true });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ supportedLocales: ["en", "en-US"] }));
  });

  it("normalizes allowed-locale comparisons and duplicate detection", () => {
    const allowed = renderHook(() =>
      useTranslationWorkspace({
        schema: { ...schema, supportedLocales: [] },
        policy: { allowedLocales: ["en-US", "ja"] }
      })
    );
    let allowedResult: ReturnType<typeof allowed.result.current.addLocale> | undefined;
    act(() => {
      allowedResult = allowed.result.current.addLocale("en-us");
    });
    expect(allowedResult).toEqual({ success: true });

    const duplicate = renderHook(() => useTranslationWorkspace({ schema: { ...schema, supportedLocales: ["en-US"] } }));
    let duplicateResult: ReturnType<typeof duplicate.result.current.addLocale> | undefined;
    act(() => {
      duplicateResult = duplicate.result.current.addLocale("EN-US");
    });
    expect(duplicateResult).toEqual({
      success: false,
      error: { type: "locale_already_exists", locale: "en-US" }
    });
  });
});
