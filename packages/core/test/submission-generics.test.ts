import type { BaseSubmissionMetadata, TypedPagedSubmissionStorageAdapter } from "../src";
import { createSubmission } from "../src";

describe("generic submission metadata", () => {
  it("propagates the metadata type through the input factory", () => {
    const submission = createSubmission<{ deckId: string; piiConfirmed: boolean }>({
      formId: "guide",
      formVersion: 1,
      answers: { title: "Welcome" },
      metadata: { deckId: "deck_123", piiConfirmed: false },
      submittedAt: "2026-08-29T00:00:00.000Z"
    });

    expectTypeOf(submission.metadata.deckId).toEqualTypeOf<string>();
    expect(submission.metadata).toEqual({ deckId: "deck_123", piiConfirmed: false });
  });

  it("propagates metadata types through paged storage contracts", () => {
    interface Metadata extends BaseSubmissionMetadata {
      readonly deckId: string;
      readonly sessionId: string;
    }

    const adapter: TypedPagedSubmissionStorageAdapter<Metadata> = {
      saveSchema: async () => undefined,
      getSchema: async () => null,
      listSchemas: async () => [],
      deleteSchema: async () => undefined,
      saveSubmission: async (submission) => {
        expectTypeOf(submission.metadata.deckId).toEqualTypeOf<string>();
      },
      listSubmissions: async () => [],
      deleteSubmission: async () => undefined,
      clear: async () => undefined,
      listSubmissionPage: async (_formId, options) => {
        options?.filter;
        return { items: [], hasMore: false };
      }
    };

    expectTypeOf(adapter).toMatchTypeOf<TypedPagedSubmissionStorageAdapter<Metadata>>();
  });
});
