import type { FormSchema } from "@form-engine-ts/core";
import { act, renderHook } from "@testing-library/react";
import { useTranslationComparison } from "../src";

const schema: FormSchema = {
  id: "comparison",
  version: 1,
  title: "Customer survey",
  description: "Tell us what you think.",
  completionMessage: "Thank you.",
  defaultLocale: "en",
  supportedLocales: ["en", "ja"],
  fields: [
    {
      id: "satisfaction",
      type: "select",
      title: "Satisfaction",
      required: true,
      options: [{ id: "great", label: "Great" }]
    }
  ],
  pages: [{ id: "main", title: "Main page", questionIds: ["satisfaction"] }]
};

describe("useTranslationComparison", () => {
  it("collects form, page, field, and option items in a stable order", () => {
    const { result } = renderHook(() => useTranslationComparison({ schema, targetLocale: "ja" }));

    expect(result.current.items.map((item) => item.path)).toEqual([
      "form.title",
      "form.description",
      "form.completionMessage",
      "fields.satisfaction.title",
      "fields.satisfaction.options.great.label",
      "pages.main.title"
    ]);
    expect(result.current.items.every((item) => item.translatedText === "")).toBe(true);
  });

  it("updates a translation and records canonical manual metadata", () => {
    const onChange = vi.fn();
    const onTranslationChange = vi.fn();
    const { result } = renderHook(() =>
      useTranslationComparison({ schema, targetLocale: "ja", onChange, onTranslationChange })
    );

    act(() => result.current.updateTranslation("fields.satisfaction.options.great.label", "最高"));

    const nextSchema = onChange.mock.calls[0]?.[0] as FormSchema | undefined;
    const option =
      nextSchema?.fields[0] && "options" in nextSchema.fields[0] ? nextSchema.fields[0].options[0] : undefined;
    expect(option).toMatchObject({ translations: { ja: "最高" } });
    expect(option?.translationMetadata?.ja?.label).toMatchObject({
      sourceLocale: "en",
      translationSource: "manual"
    });
    expect(onTranslationChange).toHaveBeenCalledWith(
      expect.objectContaining({ nextText: "最高", mode: "manual", metadata: expect.any(Object) })
    );
  });

  it("preserves provider metadata extensions when a translation is written", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useTranslationComparison({
        schema,
        targetLocale: "ja",
        onChange,
        createTranslationMetadata: ({ mode }) => ({
          provider: "gcp",
          model: "gemini-translate",
          translationSource: mode
        })
      })
    );

    act(() => result.current.updateTranslation("form.title", "顧客アンケート"));

    expect(onChange.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        translationMetadata: {
          ja: {
            title: expect.objectContaining({ provider: "gcp", model: "gemini-translate" })
          }
        }
      })
    );
  });

  it("distinguishes the source locale from an already registered locale", () => {
    const { result } = renderHook(() => useTranslationComparison({ schema, targetLocale: "ja" }));

    let sourceResult: ReturnType<typeof result.current.addLocale> | undefined;
    act(() => {
      sourceResult = result.current.addLocale("en");
    });

    expect(sourceResult).toEqual({ success: false, error: { type: "source_locale", locale: "en" } });
  });
});
