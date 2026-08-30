import type { FormSchema, UnifiedSubmissionStorageAdapter } from "../src";
import { createSubmissionPipeline, FormSubmissionError, runSubmissionPipeline, type SubmissionCodec } from "../src";

const schema: FormSchema = {
  id: "pipeline",
  version: 1,
  title: "Pipeline",
  fields: [{ id: "name", type: "text", title: "Name", required: true }]
};

function storage(saveSubmission: UnifiedSubmissionStorageAdapter["saveSubmission"]): UnifiedSubmissionStorageAdapter {
  return {
    saveSubmission,
    listSubmissionPage: async () => ({ items: [], hasMore: false }),
    listTextAnswerPage: async () => ({ items: [], hasMore: false }),
    aggregateResponses: async () => ({ formId: "pipeline", formVersion: 1, submissionCount: 0, questions: [] }),
    exportResponsesToCsv: async () => "",
    validateSubmission: async () => undefined
  };
}

describe("submission pipeline", () => {
  it("normalizes with a codec and saves the validated value idempotently", async () => {
    const saveSubmission = vi.fn(async () => undefined);
    const codec: SubmissionCodec<unknown, { readonly name: string }> = {
      safeParse(input) {
        if (typeof input !== "object" || input === null || !("name" in input)) {
          return { success: false, error: { issues: [] } };
        }
        return { success: true, data: { name: String(input.name).trim() } };
      }
    };
    const pipeline = createSubmissionPipeline({
      schema,
      storage: storage(saveSubmission),
      codec,
      id: "submission-1",
      locale: "ja"
    });

    const result = await pipeline.submit({ name: " Ada " });

    expect(result.status).toBe("created");
    expect(saveSubmission).toHaveBeenCalledWith(expect.objectContaining({ locale: "ja", values: { name: "Ada" } }), {
      idempotent: true
    });
  });

  it("requires PII confirmation before persistence", async () => {
    const saveSubmission = vi.fn(async () => undefined);
    const privacyEngine = {
      detect: () => [{ fieldId: "name", type: "email", matchedText: "ada@example.com" }]
    };
    const options = {
      schema,
      storage: storage(saveSubmission),
      privacyEngine,
      id: "submission-2",
      locale: "en"
    };

    await expect(runSubmissionPipeline(options, { name: "ada@example.com" })).rejects.toMatchObject({
      payload: expect.objectContaining({ code: "PII_CONFIRMATION_REQUIRED", piiWarningAcknowledged: false })
    });
    expect(saveSubmission).not.toHaveBeenCalled();

    await runSubmissionPipeline({ ...options, piiWarningAcknowledged: true }, { name: "ada@example.com" });
    expect(saveSubmission).toHaveBeenCalledOnce();
  });

  it("returns typed validation and storage errors", async () => {
    const validationStorage = storage(vi.fn(async () => undefined));
    await expect(
      runSubmissionPipeline({ schema, storage: validationStorage, id: "submission-3", locale: "en" }, { name: "" })
    ).rejects.toBeInstanceOf(FormSubmissionError);

    await expect(
      runSubmissionPipeline(
        {
          schema,
          storage: storage(vi.fn(async () => Promise.reject(new Error("offline")))),
          id: "submission-4",
          locale: "en"
        },
        { name: "Ada" }
      )
    ).rejects.toMatchObject({ payload: { code: "STORAGE_ERROR" } });
  });
});
