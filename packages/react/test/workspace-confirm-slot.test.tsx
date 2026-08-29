import type { FormSchema } from "@form-engine-ts/core";
import { act, renderHook } from "@testing-library/react";
import { type ConfirmRemoveLocaleSlotProps, useTranslationWorkspace } from "../src";

const schema: FormSchema = {
  id: "confirm-slot",
  version: 1,
  title: "Survey",
  defaultLocale: "en",
  supportedLocales: ["en", "ja"],
  translations: { ja: { title: "調査" } },
  fields: [{ id: "name", type: "text", title: "Name", required: false }]
};

describe("useTranslationWorkspace confirmRemoveLocale slot", () => {
  it("waits for the slot confirmation before removing a locale", async () => {
    const confirmRemoveLocale = vi.fn((props: ConfirmRemoveLocaleSlotProps) => {
      void props;
      return null;
    });
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useTranslationWorkspace({ schema, onChange, confirmRemoveLocale, targetLocale: "ja" })
    );

    let removal: Promise<boolean> | undefined;
    act(() => {
      removal = result.current.removeLocale("ja") as Promise<boolean>;
    });

    expect(onChange).not.toHaveBeenCalled();
    const props = confirmRemoveLocale.mock.calls.at(-1)?.[0];
    expect(props).toEqual(expect.objectContaining({ locale: "ja", translatedSlotsCount: 1, isOpen: true }));
    if (props === undefined || removal === undefined) throw new Error("Expected confirmation state.");

    act(() => props.onConfirm());

    await expect(removal).resolves.toBe(true);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ supportedLocales: ["en"] }));
  });
});
