import {
  createPublishTransitionPlan,
  type FormSchema,
  type FormSubmission,
  type FormVersionRecord,
  iterateSubmissionPages,
  type PagedSubmissionStorageAdapter,
  type SubmissionPageQueryOptions
} from "../src";

const schema: FormSchema = {
  id: "v29",
  version: 3,
  title: "Versioned",
  fields: [{ id: "comment", type: "text", title: "Comment", required: false }]
};

const draft: FormVersionRecord = {
  formId: "v29",
  version: 3,
  status: "draft",
  schema,
  revision: 1,
  createdAt: "2026-08-25T00:00:00.000Z"
};

const published: FormVersionRecord = {
  ...draft,
  version: 2,
  status: "published",
  schema: { ...schema, version: 2 }
};

function submission(id: string): FormSubmission {
  return {
    id,
    formId: "v29",
    formVersion: 3,
    locale: "ja",
    values: { comment: id },
    submittedAt: `2026-08-25T00:00:0${id}.000Z`,
    metadata: { source: "test" }
  };
}

function pagedAdapter(
  listSubmissionPage: PagedSubmissionStorageAdapter["listSubmissionPage"]
): PagedSubmissionStorageAdapter {
  return {
    async saveSchema() {},
    async getSchema() {
      return null;
    },
    async listSchemas() {
      return [];
    },
    async deleteSchema() {},
    async saveSubmission() {},
    async listSubmissions() {
      return [];
    },
    async deleteSubmission() {},
    async clear() {},
    listSubmissionPage
  };
}

describe("v2.9 versioning guards", () => {
  const state = { formId: "v29", draftVersion: 3, publishedVersion: 2, nextVersion: 4, revision: 1 };

  it("returns typed errors for mismatched form id and invalid published status", async () => {
    await expect(
      createPublishTransitionPlan(state, draft, {
        currentPublishedRecord: { ...published, formId: "other", version: 99 }
      })
    ).resolves.toEqual({ success: false, error: { type: "form_id_mismatch" } });
    await expect(
      createPublishTransitionPlan(state, draft, { currentPublishedRecord: { ...published, status: "archived" } })
    ).resolves.toEqual({ success: false, error: { type: "invalid_published_status" } });
  });

  it("rejects a published record when state has no published version", async () => {
    await expect(
      createPublishTransitionPlan({ formId: "v29", draftVersion: 3, nextVersion: 4, revision: 1 }, draft, {
        currentPublishedRecord: published
      })
    ).resolves.toEqual({ success: false, error: { type: "unexpected_published_record" } });
  });
});

describe("iterateSubmissionPages", () => {
  it("continues across an empty page and stops exactly at maxItems", async () => {
    const listSubmissionPage = vi.fn(async (_formId: string, options: SubmissionPageQueryOptions = {}) => {
      if (options.cursor === undefined) return { items: [], hasMore: true, nextCursor: "next" };
      return { items: [submission("1"), submission("2"), submission("3")], hasMore: false };
    });
    const adapter = pagedAdapter(listSubmissionPage);
    const pages: Array<readonly unknown[]> = [];
    for await (const page of iterateSubmissionPages(adapter, "v29", {}, { pageSize: 3, maxItems: 2 })) {
      pages.push(page);
    }
    expect(pages).toEqual([
      [
        expect.objectContaining({ responseId: "1", answers: { comment: "1" }, metadata: { source: "test" } }),
        expect.objectContaining({ responseId: "2", answers: { comment: "2" }, metadata: { source: "test" } })
      ]
    ]);
    expect(listSubmissionPage).toHaveBeenNthCalledWith(1, "v29", { pageSize: 2 });
    expect(listSubmissionPage).toHaveBeenNthCalledWith(2, "v29", { pageSize: 2, cursor: "next" });
  });

  it("rejects cursor cycles and honors an aborted signal", async () => {
    const adapter = pagedAdapter(async () => ({ items: [], hasMore: true, nextCursor: "cycle" }));
    await expect(async () => {
      for await (const _page of iterateSubmissionPages(adapter, "v29")) {
        // No pages are emitted before the cursor cycle is detected.
      }
    }).rejects.toThrow(/cursor cycle/i);

    const controller = new AbortController();
    controller.abort();
    await expect(async () => {
      for await (const _page of iterateSubmissionPages(adapter, "v29", {}, { signal: controller.signal })) {
        // Aborted before the adapter is called.
      }
    }).rejects.toMatchObject({ name: "AbortError" });
  });
});
