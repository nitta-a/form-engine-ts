import type { AsyncTranslationAdapter, FormSchema } from "../src";
import { populateSchemaTranslations } from "../src";

const schema: FormSchema = {
  id: "async-translation",
  version: 1,
  title: "Survey",
  defaultLocale: "en",
  supportedLocales: ["en", "ja"],
  fields: [
    { id: "good", type: "text", title: "Good", required: false },
    { id: "bad", type: "text", title: "Bad", required: false }
  ]
};

describe("async translation workspace contract", () => {
  it("forwards AbortSignal and reports partial failures", async () => {
    const controller = new AbortController();
    const progress: number[] = [];
    const adapter: AsyncTranslationAdapter = {
      translateBatch: async () => {
        throw new Error("batch unavailable");
      },
      translateText: async (text, _target, _source, signal) => {
        expect(signal).toBe(controller.signal);
        if (text === "Bad") throw new Error("bad text");
        return `${text}:ja`;
      }
    };

    const result = await populateSchemaTranslations(schema, ["ja"], adapter, {
      continueOnError: true,
      signal: controller.signal,
      onProgress: (value) => progress.push(value.percentage)
    });

    expect(result.report.succeeded).toBe(2);
    expect(result.report.failed).toBe(1);
    expect(result.report.failures).toHaveLength(1);
    expect(result.schema.translations?.ja?.title).toBe("Survey:ja");
    expect(progress.at(-1)).toBe(100);
  });
});
