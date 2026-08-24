import { Writable } from "node:stream";
import {
  aggregateResponses,
  assertVersionMutable,
  cloneVersionToDraft,
  createResponseAccumulator,
  deleteDraft,
  exportResponsesToCsvStream,
  type FormSchema,
  type FormSubmission,
  type FormVersionState,
  pipeResponsesToCsvStream,
  publishDraft
} from "../src";

const schema: FormSchema = {
  id: "analytics",
  version: 3,
  title: "Analytics",
  fields: [
    { id: "comment", type: "text", title: "Comment", required: false },
    { id: "score", type: "number", title: "Score", required: false },
    {
      id: "choice",
      type: "multi-select",
      title: "Choice",
      required: false,
      options: [
        { id: "a", label: "A" },
        { id: "b", label: "B" }
      ]
    },
    { id: "approved", type: "checkbox", title: "Approved", required: false },
    {
      id: "conditional",
      type: "text",
      title: "Conditional",
      required: false,
      displayCondition: { questionId: "approved", operator: "equals", value: true }
    }
  ]
};

function submission(id: string, values: FormSubmission["values"], version = 3): FormSubmission {
  return {
    id,
    formId: "analytics",
    formVersion: version,
    locale: "en",
    values,
    submittedAt: `2026-01-01T00:00:0${id}.000Z`
  };
}

describe("form version transitions", () => {
  const state: FormVersionState = {
    formId: "analytics",
    publishedVersion: 2,
    nextVersion: 3,
    revision: 7
  };

  it("clones one draft, rejects another, and enforces the maximum version", () => {
    const cloned = cloneVersionToDraft(state, { ...schema, version: 2 }, { maxVersions: 3 });
    expect(cloned).toEqual({
      success: true,
      value: {
        nextState: { ...state, draftVersion: 3, nextVersion: 4, revision: 8 },
        draftSchema: schema
      }
    });
    if (!cloned.success) throw new Error("Expected a draft");
    expect(cloneVersionToDraft(cloned.value.nextState, schema)).toEqual({
      success: false,
      error: { type: "draft_already_exists", currentDraftVersion: 3 }
    });
    expect(cloneVersionToDraft({ ...state, nextVersion: 4 }, { ...schema, version: 2 }, { maxVersions: 3 })).toEqual({
      success: false,
      error: { type: "max_version_exceeded", max: 3 }
    });
  });

  it("checks clone revisions and rejects unpublished source versions", () => {
    expect(cloneVersionToDraft(state, { ...schema, version: 2 }, { expectedRevision: 6 })).toEqual({
      success: false,
      error: { type: "revision_conflict", expectedRevision: 6, actualRevision: 7 }
    });
    expect(cloneVersionToDraft(state, schema, { expectedRevision: 7 })).toEqual({
      success: false,
      error: { type: "invalid_source_version", requestedVersion: 3, publishedVersion: 2 }
    });
    expect(cloneVersionToDraft(state, schema, { allowedSourceVersions: [3] }).success).toBe(true);
  });

  it("detects revision conflicts and records the replaced published version", () => {
    const draftState = { ...state, draftVersion: 3 };
    expect(publishDraft(draftState, schema, { expectedRevision: 6 })).toEqual({
      success: false,
      error: { type: "revision_conflict", expectedRevision: 6, actualRevision: 7 }
    });
    const published = publishDraft(draftState, schema, {
      expectedRevision: 7,
      timestamp: "2026-08-24T09:00:00.000Z"
    });
    expect(published).toMatchObject({
      success: true,
      value: {
        nextState: { formId: "analytics", publishedVersion: 3, nextVersion: 3, revision: 8 },
        archivedVersion: 2,
        archivedRecords: [
          {
            version: 2,
            status: "archived",
            archivedAt: "2026-08-24T09:00:00.000Z"
          }
        ],
        publishedRecord: { version: 3, status: "published", publishedAt: "2026-08-24T09:00:00.000Z" }
      }
    });
  });

  it("returns typed validation failures without throwing", () => {
    const issue = { path: "fields[0]", code: "invalid", message: "Invalid draft" };
    expect(publishDraft({ ...state, draftVersion: 3 }, schema, { validate: () => [issue] })).toEqual({
      success: false,
      error: { type: "validation_failed", issues: [issue] }
    });
    expect(publishDraft({ ...state, draftVersion: 3 }, schema, { validate: () => false })).toEqual({
      success: false,
      error: { type: "validation_failed", issues: [] }
    });
  });

  it("deletes drafts and prevents mutation of immutable statuses", () => {
    expect(deleteDraft(state)).toEqual({ success: false, error: { type: "draft_not_found" } });
    expect(deleteDraft({ ...state, draftVersion: 3 })).toEqual({
      success: true,
      value: { nextState: { ...state, revision: 8 } }
    });
    expect(deleteDraft({ ...state, draftVersion: 3 }, { expectedRevision: 6 })).toEqual({
      success: false,
      error: { type: "revision_conflict", expectedRevision: 6, actualRevision: 7 }
    });
    expect(() => assertVersionMutable("draft")).not.toThrow();
    expect(() => assertVersionMutable("published")).toThrow(/immutable/);
    expect(() => assertVersionMutable("archived")).toThrow(/immutable/);
  });
});

describe("incremental response analytics", () => {
  const submissions = [
    submission("1", { comment: "first", score: 2, choice: ["a"], approved: true, conditional: "shown" }),
    submission("2", { comment: "second", score: 6, choice: ["a", "b"], approved: false, conditional: "hidden" }),
    submission("3", { score: 4, approved: true })
  ];

  it("matches batch aggregation for incremental and merged results", () => {
    const expected = aggregateResponses(schema, submissions);
    const incremental = createResponseAccumulator(schema);
    incremental.addMany(submissions);
    expect(incremental.finalize()).toEqual(expected);

    const left = createResponseAccumulator(schema);
    const right = createResponseAccumulator(schema);
    left.addMany(submissions.slice(0, 2));
    right.addMany(submissions.slice(2));
    expect(left.merge(right).finalize()).toEqual(expected);
  });

  it("rejects mismatched submissions in strict mode without changing the result", () => {
    const accumulator = createResponseAccumulator(schema);
    expect(accumulator.add(submission("9", { score: 1 }, 4))).toEqual({
      success: false,
      error: "Submission 9 does not match analytics@3."
    });
    expect(accumulator.finalize().submissionCount).toBe(0);
    expect(createResponseAccumulator(schema, { mode: "lenient" }).add(submission("9", { score: 1 }, 4))).toEqual({
      success: true,
      skipped: true
    });
  });

  it("reports lenient form and version mismatches without aggregating them", () => {
    const accumulator = createResponseAccumulator(schema, { mode: "lenient" });
    const otherForm = { ...submission("other", { score: 100 }), formId: "other" };
    const report = accumulator.addMany([
      submission("1", { comment: "first", score: 2 }),
      otherForm,
      submission("v4", {}, 4)
    ]);
    expect(report).toEqual({
      processedCount: 1,
      skippedCount: 2,
      skipReasons: [
        { responseId: "other", reason: "form_id_mismatch" },
        { responseId: "v4", reason: "version_mismatch" }
      ]
    });
    expect(accumulator.finalize().submissionCount).toBe(1);
    expect(accumulator.getReport()).toEqual(report);
  });

  it("reports malformed runtime input without throwing in lenient mode", () => {
    const accumulator = createResponseAccumulator(schema, { mode: "lenient" });
    const malformed = null as unknown as FormSubmission;
    expect(accumulator.add(malformed)).toEqual({ success: true, skipped: true });
    expect(accumulator.getReport()).toEqual({
      processedCount: 0,
      skippedCount: 1,
      skipReasons: [{ responseId: "<unknown>", reason: "invalid_structure" }]
    });
  });
});

describe("streaming CSV export", () => {
  it("streams default and custom columns and neutralizes formulas in every column", async () => {
    async function* responses() {
      yield submission("=id", { comment: "+formula", approved: false });
    }
    const chunks: string[] = [];
    for await (const chunk of exportResponsesToCsvStream(schema, responses(), {
      columns: [{ header: "=custom", getValue: () => "@unsafe" }]
    })) {
      chunks.push(chunk);
    }
    expect(chunks).toHaveLength(2);
    expect(chunks.join("")).toBe(
      "\uFEFFsubmissionId,submittedAt,locale,comment,score,choice,approved,conditional,'=custom\r\n" +
        "'=id,2026-01-01T00:00:0=id.000Z,en,'+formula,,,false,,'@unsafe"
    );
  });

  it("supports custom-only output from legacy FormResponse values", async () => {
    async function* responses() {
      yield {
        responseId: "response",
        formId: "analytics",
        sourceLocale: "ja",
        submittedAt: "2026-08-24T00:00:00.000Z",
        answers: { comment: "kept" }
      };
    }
    const chunks: string[] = [];
    for await (const chunk of exportResponsesToCsvStream(schema, responses(), {
      includeDefaultColumns: false,
      withBom: false,
      columns: [{ header: "locale", getValue: ({ submission }) => submission.sourceLocale }]
    })) {
      chunks.push(chunk);
    }
    expect(chunks.join("")).toBe("locale\r\nja");
  });

  it("provides custom-column context and pipes encoded chunks to a WritableStream", async () => {
    async function* responses() {
      yield submission("1", { comment: "value" });
    }
    const chunks: Uint8Array[] = [];
    const writable = new WritableStream<Uint8Array>({
      write(chunk) {
        chunks.push(chunk);
      }
    });
    await pipeResponsesToCsvStream(schema, responses(), writable, {
      withBom: false,
      includeDefaultColumns: false,
      columns: [
        {
          header: "context",
          getValue: ({ submission: current, formVersion, schema: currentSchema }) =>
            `${current.responseId}:${formVersion}:${currentSchema.id}`
        }
      ]
    });
    expect(chunks.map((chunk) => new TextDecoder().decode(chunk)).join("")).toBe("context\r\n1:3:analytics");
  });

  it("honors Node writable backpressure and ends the destination", async () => {
    async function* responses() {
      yield submission("1", { comment: "value" });
    }
    const chunks: Buffer[] = [];
    const writable = new Writable({
      highWaterMark: 1,
      write(chunk: Buffer, _encoding, callback) {
        chunks.push(Buffer.from(chunk));
        setImmediate(callback);
      }
    });
    await pipeResponsesToCsvStream(schema, responses(), writable, { withBom: false });
    expect(Buffer.concat(chunks).toString("utf8")).toContain("submissionId,submittedAt,locale");
    expect(writable.writableEnded).toBe(true);
  });
});
