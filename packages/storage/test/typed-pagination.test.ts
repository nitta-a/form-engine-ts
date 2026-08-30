import type { BaseSubmissionMetadata, FormSubmission } from "@form-engine-ts/core";
import { iterateTypedSubmissionPages, type TypedPagedSubmissionStorageAdapter } from "../src";

interface SurveyMetadata extends BaseSubmissionMetadata {
  readonly deckId: string;
}

const submission = (id: string, deckId: string): FormSubmission<SurveyMetadata> => ({
  id,
  formId: "survey",
  formVersion: 1,
  values: {},
  metadata: { deckId },
  submittedAt: "2026-08-30T00:00:00.000Z"
});

describe("typed submission pagination", () => {
  it("retains metadata types while visiting every page", async () => {
    const pages = [[submission("one", "deck-a")], [submission("two", "deck-b")]];
    const adapter: TypedPagedSubmissionStorageAdapter<SurveyMetadata> = {
      fetchPage: async (_formId, options) =>
        pages[options?.cursor === "next" ? 1 : 0] === undefined
          ? { items: [] }
          : {
              items: pages[options?.cursor === "next" ? 1 : 0] ?? [],
              ...(options?.cursor === undefined ? { nextCursor: "next" } : {})
            }
    };
    const values: string[] = [];
    for await (const page of iterateTypedSubmissionPages(adapter, "survey")) {
      values.push(page[0]?.metadata.deckId ?? "missing");
    }
    expect(values).toEqual(["deck-a", "deck-b"]);
  });
});
