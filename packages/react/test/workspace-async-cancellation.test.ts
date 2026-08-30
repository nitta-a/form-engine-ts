import type { FormSchema } from "@form-engine-ts/core";
import { act, renderHook } from "@testing-library/react";
import { useTranslationWorkspace } from "../src";

const schema: FormSchema = {
  id: "cancellable-workspace",
  version: 1,
  title: "Survey",
  defaultLocale: "en",
  supportedLocales: ["en", "ja"],
  fields: [{ id: "name", type: "text", title: "Name", required: false }]
};

describe("useTranslationWorkspace cancellation", () => {
  it("returns a typed cancelled error when the external signal aborts", async () => {
    const controller = new AbortController();
    const { result } = renderHook(() =>
      useTranslationWorkspace({
        schema,
        targetLocale: "ja",
        signal: controller.signal,
        translationAdapter: {
          translateBatch: async (_texts, _target, _source, signal) =>
            new Promise<readonly string[]>((_resolve, reject) => {
              signal?.addEventListener("abort", () => reject(new DOMException("cancelled", "AbortError")), {
                once: true
              });
            }),
          translateText: async () => "never"
        }
      })
    );

    let operation: Promise<unknown> | undefined;
    await act(async () => {
      operation = result.current.translateAll();
      controller.abort();
      await operation;
    });

    await expect(operation).resolves.toEqual(expect.objectContaining({ success: false, error: { type: "cancelled" } }));
  });
});
