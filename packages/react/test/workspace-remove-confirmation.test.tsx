import type { FormSchema } from "@form-engine-ts/core";
import { renderHook } from "@testing-library/react";
import { useTranslationWorkspace } from "../src";

const schema: FormSchema = {
  id: "remove-confirmation",
  version: 1,
  title: "Survey",
  defaultLocale: "en",
  supportedLocales: ["en", "ja"],
  translations: { ja: { title: "調査" } },
  fields: [{ id: "name", type: "text", title: "Name", required: false }]
};

describe("useTranslationWorkspace beforeRemoveLocale", () => {
  it("waits for approval and supplies the locale slot count", async () => {
    const onChange = vi.fn();
    const beforeRemoveLocale = vi.fn(async (_locale: string, context: { slotCount: number }) => {
      expect(context.slotCount).toBe(2);
      return true;
    });
    const { result } = renderHook(() => useTranslationWorkspace({ schema, onChange, beforeRemoveLocale }));

    await result.current.removeLocale("ja");

    expect(beforeRemoveLocale).toHaveBeenCalledWith("ja", { slotCount: 2 });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ supportedLocales: ["en"] }));
  });

  it("does not remove a locale when the hook denies it", async () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useTranslationWorkspace({ schema, onChange, beforeRemoveLocale: () => false }));

    const removed = await result.current.removeLocale("ja");

    expect(removed).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });
});
