import {
  createCloneTransitionPlan,
  createDeleteDraftTransitionPlan,
  decodeTextAnswerCursor,
  encodeTextAnswerCursor,
  type FormSchema,
  type FormSubmission,
  type FormVersionRecord,
  matchesSubmissionFilter
} from "../src";

const schema: FormSchema = {
  id: "versioned",
  version: 2,
  title: "Versioned",
  fields: [{ id: "comment", type: "textarea", title: "Comment", required: false }]
};

const sourceRecord: FormVersionRecord = {
  formId: "versioned",
  version: 2,
  status: "published",
  schema,
  revision: 4,
  createdAt: "2026-08-24T00:00:00.000Z",
  publishedAt: "2026-08-24T01:00:00.000Z"
};

describe("v2.7 version transition plans", () => {
  it("creates a complete clone plan and audit event", () => {
    const result = createCloneTransitionPlan(
      { formId: "versioned", publishedVersion: 2, nextVersion: 3, revision: 5 },
      sourceRecord,
      {
        expectedRevision: 5,
        clonedAt: "2026-08-25T00:00:00.000Z",
        metadata: { actor: "test" }
      }
    );
    expect(result).toEqual({
      success: true,
      value: {
        nextState: {
          formId: "versioned",
          publishedVersion: 2,
          draftVersion: 3,
          nextVersion: 4,
          revision: 6
        },
        plan: {
          formId: "versioned",
          expectedRevision: 5,
          nextRevision: 6,
          draftToCreate: {
            formId: "versioned",
            version: 3,
            status: "draft",
            schema: { ...schema, version: 3 },
            revision: 1,
            createdFromVersion: 2,
            createdAt: "2026-08-25T00:00:00.000Z",
            metadata: { actor: "test" }
          },
          events: [
            {
              type: "draft.created",
              formId: "versioned",
              fromRevision: 5,
              toRevision: 6,
              affectedVersions: [3],
              occurredAt: "2026-08-25T00:00:00.000Z"
            }
          ],
          nextVersion: 4,
          timestamp: "2026-08-25T00:00:00.000Z"
        }
      }
    });
  });

  it("rejects clone and delete plans on revision conflict", () => {
    const state = { formId: "versioned", publishedVersion: 2, draftVersion: 3, nextVersion: 4, revision: 5 };
    const draftRecord: FormVersionRecord = {
      ...sourceRecord,
      version: 3,
      status: "draft",
      schema: { ...schema, version: 3 }
    };
    expect(
      createCloneTransitionPlan(
        { formId: "versioned", publishedVersion: 2, nextVersion: 4, revision: 5 },
        sourceRecord,
        { expectedRevision: 4 }
      )
    ).toEqual({
      success: false,
      error: { type: "revision_conflict", expectedRevision: 4, actualRevision: 5 }
    });
    expect(createDeleteDraftTransitionPlan(state, draftRecord, { expectedRevision: 4 })).toEqual({
      success: false,
      error: { type: "revision_conflict", expectedRevision: 4, actualRevision: 5 }
    });
  });

  it("creates a complete delete plan and audit event", () => {
    const state = { formId: "versioned", publishedVersion: 2, draftVersion: 3, nextVersion: 4, revision: 5 };
    const draftRecord: FormVersionRecord = {
      ...sourceRecord,
      version: 3,
      status: "draft",
      schema: { ...schema, version: 3 }
    };
    const result = createDeleteDraftTransitionPlan(state, draftRecord, {
      expectedRevision: 5,
      deletedAt: "2026-08-25T02:00:00.000Z"
    });
    expect(result).toMatchObject({
      success: true,
      value: {
        nextState: { publishedVersion: 2, nextVersion: 4, revision: 6 },
        plan: {
          expectedRevision: 5,
          nextRevision: 6,
          draftToDeleteVersion: 3,
          events: [{ type: "draft.deleted", affectedVersions: [3] }]
        }
      }
    });
  });
});

describe("v2.7 generic submission filters", () => {
  const submission: FormSubmission = {
    id: "response-1",
    formId: "versioned",
    formVersion: 2,
    locale: "ja",
    values: { comment: "hello", score: 8 },
    submittedAt: "2026-08-25T00:00:00.000Z",
    metadata: { cohort: "a", pii: false }
  };

  it("evaluates nested boolean, range, in, and exists expressions", () => {
    expect(
      matchesSubmissionFilter(submission, {
        op: "and",
        filters: [
          { op: "in", path: "metadata.cohort", values: ["a", "b"] },
          { op: "range", path: "values.score", from: 5, to: 10 },
          {
            op: "or",
            filters: [
              { op: "eq", path: "locale", value: "en" },
              { op: "exists", path: "values.comment", value: true }
            ]
          }
        ]
      })
    ).toBe(true);
    expect(matchesSubmissionFilter(submission, { op: "exists", path: "metadata.missing", value: true })).toBe(false);
  });

  it("round-trips text answer cursors", () => {
    const cursor = encodeTextAnswerCursor({ responseId: "response_with_underscore", fieldId: "field_id" });
    expect(decodeTextAnswerCursor(cursor)).toEqual({ responseId: "response_with_underscore", fieldId: "field_id" });
  });
});
