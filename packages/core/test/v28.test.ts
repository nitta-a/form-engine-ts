import { createPublishTransitionPlan, type FormSchema, type FormVersionRecord } from "../src";

const schema = (version: number): FormSchema => ({
  id: "versioned",
  version,
  title: `Version ${version}`,
  fields: []
});

const draft: FormVersionRecord = {
  formId: "versioned",
  version: 3,
  status: "draft",
  schema: schema(3),
  revision: 1,
  createdFromVersion: 2,
  createdAt: "2026-08-25T00:00:00.000Z"
};

describe("v2.8 publish transition invariants", () => {
  it("requires the current published record when state has a published version", async () => {
    const state = {
      formId: "versioned",
      draftVersion: 3,
      publishedVersion: 2,
      nextVersion: 4,
      revision: 5
    };
    await expect(createPublishTransitionPlan(state, draft)).resolves.toEqual({
      success: false,
      error: { type: "missing_published_record", expectedVersion: 2 }
    });
    await expect(
      createPublishTransitionPlan(state, draft, {
        currentPublishedRecord: {
          ...draft,
          version: 1,
          status: "published",
          schema: schema(1)
        }
      })
    ).resolves.toEqual({
      success: false,
      error: { type: "missing_published_record", expectedVersion: 2 }
    });
  });

  it("archives the complete published record without replacing its original data", async () => {
    const published: FormVersionRecord = {
      formId: "versioned",
      version: 2,
      status: "published",
      schema: { ...schema(2), metadata: { schemaSource: "kept" } },
      revision: 4,
      createdAt: "2026-08-20T00:00:00.000Z",
      publishedAt: "2026-08-21T00:00:00.000Z",
      metadata: { owner: "ARGS" }
    };
    const result = await createPublishTransitionPlan(
      { formId: "versioned", draftVersion: 3, publishedVersion: 2, nextVersion: 4, revision: 5 },
      draft,
      { currentPublishedRecord: published, publishedAt: "2026-08-25T05:00:00.000Z" }
    );
    expect(result).toMatchObject({
      success: true,
      value: {
        plan: {
          archivedRecordsToSave: [
            {
              ...published,
              status: "archived",
              revision: 5,
              archivedAt: "2026-08-25T05:00:00.000Z"
            }
          ]
        }
      }
    });
  });
});
