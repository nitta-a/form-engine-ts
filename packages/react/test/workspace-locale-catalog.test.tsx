import type { FormSchema } from "@form-engine-ts/core";
import { act, renderHook } from "@testing-library/react";
import { useTranslationWorkspace } from "../src";

const schema: FormSchema = {
  id: "locale-catalog",
  version: 1,
  title: "Survey",
  defaultLocale: "ja",
  supportedLocales: ["ja"],
  fields: [{ id: "name", type: "text", title: "Name", required: false }]
};

describe("useTranslationWorkspace locale catalog", () => {
  it("canonicalizes locales and emits lifecycle callbacks", () => {
    const onChange = vi.fn();
    const onLocaleAdded = vi.fn();
    const onLocaleChange = vi.fn();
    const { result } = renderHook(() =>
      useTranslationWorkspace({
        schema,
        onChange,
        availableLocales: [{ locale: "en-US", label: "English (US)" }],
        onLocaleAdded,
        onLocaleChange
      })
    );

    act(() => {
      expect(result.current.addLocale("en_us")).toEqual({ success: true });
      result.current.setTargetLocale("en_us");
    });

    expect(onLocaleAdded).toHaveBeenCalledWith("en-US");
    expect(onLocaleChange).toHaveBeenCalledWith("en-US");
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ supportedLocales: ["ja", "en-US"] }));
  });

  it("does not invoke automatic translation for a manual-only locale", async () => {
    const translateBatch = vi.fn(async (texts: readonly string[]) => texts.map((text) => `translated:${text}`));
    const { result } = renderHook(() =>
      useTranslationWorkspace({
        schema: { ...schema, supportedLocales: ["ja", "en"] },
        targetLocale: "en",
        availableLocales: [{ locale: "en", label: "English", translatable: false }],
        translationAdapter: { translateText: vi.fn(), translateBatch }
      })
    );

    await act(async () => {
      await expect(result.current.translateAll()).resolves.toMatchObject({ success: true });
    });
    expect(translateBatch).not.toHaveBeenCalled();
  });
});
