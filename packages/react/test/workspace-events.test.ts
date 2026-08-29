import type { FormSchema } from "@form-engine-ts/core";
import { act, renderHook } from "@testing-library/react";
import { useTranslationWorkspace } from "../src";

const schema: FormSchema = {
  id: "workspace-events",
  version: 1,
  title: "Survey",
  defaultLocale: "en",
  supportedLocales: ["en", "ja"],
  fields: [{ id: "name", type: "text", title: "Name", required: false }]
};

describe("useTranslationWorkspace events", () => {
  it("emits translation start and success events with completion counts", async () => {
    const sequence: string[] = [];
    const onTranslationStart = vi.fn(() => sequence.push("start"));
    const onTranslationSuccess = vi.fn(() => sequence.push("success"));
    const { result } = renderHook(() =>
      useTranslationWorkspace({
        schema,
        targetLocale: "ja",
        translationAdapter: {
          translateBatch: async (texts) => texts.map((text) => `${text}-ja`),
          translateText: async (text) => `${text}-ja`
        },
        onTranslationStart,
        onTranslationSuccess
      })
    );

    await act(async () => {
      await result.current.translateAll();
    });

    expect(sequence).toEqual(["start", "success"]);
    expect(onTranslationSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceLocale: "en",
        targetLocale: "ja",
        mode: "automatic",
        updatedSlots: expect.any(Array),
        skippedSlots: expect.any(Array),
        missingSlotsCount: 0
      })
    );
  });

  it("emits manual change metadata when a slot is edited", () => {
    const onTranslationChange = vi.fn();
    const { result } = renderHook(() => useTranslationWorkspace({ schema, targetLocale: "ja", onTranslationChange }));
    const slot = result.current.slots[0];
    if (slot === undefined) throw new Error("Expected a translation slot.");

    act(() => result.current.setTranslation(slot, "調査"));

    expect(onTranslationChange).toHaveBeenCalledWith(
      expect.objectContaining({
        slot,
        nextText: "調査",
        mode: "manual",
        metadata: expect.objectContaining({ sourceLocale: "en", translationSource: "manual" })
      })
    );
  });
});
