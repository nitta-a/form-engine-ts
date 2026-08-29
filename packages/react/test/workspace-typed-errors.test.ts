import type { FormSchema } from "@form-engine-ts/core";
import { act, renderHook } from "@testing-library/react";
import { useTranslationWorkspace } from "../src";

const schema: FormSchema = {
  id: "typed-errors",
  version: 1,
  title: "Survey",
  defaultLocale: "en",
  supportedLocales: ["en", "ja"],
  fields: [{ id: "name", type: "text", title: "Name", required: false }]
};

describe("typed translation workspace errors", () => {
  it("returns structured max-locale errors", () => {
    const { result } = renderHook(() =>
      useTranslationWorkspace({ schema, policy: { maxLocales: 2 }, targetLocale: "ja" })
    );

    let response: ReturnType<typeof result.current.addLocale> | undefined;
    act(() => {
      response = result.current.addLocale("fr");
    });

    expect(response).toEqual({
      success: false,
      error: { type: "max_locales_exceeded", max: 2, current: 2 }
    });
  });

  it("returns an adapter error instead of throwing", async () => {
    const { result } = renderHook(() => useTranslationWorkspace({ schema, targetLocale: "ja" }));

    await expect(result.current.translateAll()).resolves.toEqual({
      success: false,
      error: { type: "adapter_not_configured" }
    });
  });
});
