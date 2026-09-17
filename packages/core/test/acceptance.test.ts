import { describe, expect, it, vi } from "vitest";
import {
  createSubmission,
  type FormSchema,
  getFormAcceptanceStatus,
  runSubmissionPipeline,
  type UnifiedSubmissionStorageAdapter
} from "../src";

const baseSchema: FormSchema = {
  id: "acceptance",
  version: 1,
  title: "Acceptance",
  fields: [{ id: "answer", type: "text", title: "Answer", required: true }]
};

describe("form acceptance", () => {
  it.each([
    ["not_yet_open", { openAt: "2026-09-18T00:00:00.000Z" }, "2026-09-17T00:00:00.000Z"],
    ["closed", { closeAt: "2026-09-17T00:00:00.000Z" }, "2026-09-17T00:00:00.000Z"],
    ["limit_reached", { maxResponses: 2 }, "2026-09-17T00:00:00.000Z"]
  ])("returns %s", (status, settings, now) => {
    expect(
      getFormAcceptanceStatus(
        { ...baseSchema, submissionSettings: settings },
        {
          now: new Date(now),
          ...(status === "limit_reached" ? { submissionCount: 2 } : {})
        }
      )
    ).toEqual({ status, accepted: false });
  });

  it("accepts a response inside the configured window", () => {
    expect(
      getFormAcceptanceStatus(
        {
          ...baseSchema,
          submissionSettings: { openAt: "2026-09-16T00:00:00.000Z", closeAt: "2026-09-18T00:00:00.000Z" }
        },
        { now: new Date("2026-09-17T00:00:00.000Z") }
      )
    ).toEqual({ status: "open", accepted: true });
  });

  it("rejects non-ISO response window timestamps", async () => {
    const { validateFormSchema } = await import("../src");
    expect(
      validateFormSchema({
        ...baseSchema,
        submissionSettings: { openAt: "September 17, 2026" }
      }).issues
    ).toEqual(expect.arrayContaining([expect.objectContaining({ path: "submissionSettings.openAt" })]));
  });

  it("blocks the pipeline when atomic storage reports a response limit", async () => {
    const countSubmissions = vi.fn(async () => 1);
    const saveSubmissionWithinLimit = vi.fn(async () => ({ status: "limit_reached" as const }));
    const storage = {
      countSubmissions,
      saveSubmission: vi.fn(async () => undefined),
      saveSubmissionWithinLimit,
      listSubmissionPage: vi.fn(async () => ({ items: [], hasMore: false })),
      listTextAnswerPage: vi.fn(),
      aggregateResponses: vi.fn(),
      exportResponsesToCsv: vi.fn(),
      validateSubmission: vi.fn()
    } as unknown as UnifiedSubmissionStorageAdapter;
    await expect(
      runSubmissionPipeline(
        {
          schema: { ...baseSchema, submissionSettings: { maxResponses: 1 } },
          storage,
          id: "submission-1",
          locale: "en",
          now: () => new Date("2026-09-17T00:00:00.000Z")
        },
        { answer: "value" }
      )
    ).rejects.toMatchObject({ payload: { code: "FORM_CLOSED" } });
    expect(countSubmissions).not.toHaveBeenCalled();
    expect(saveSubmissionWithinLimit).toHaveBeenCalledWith(expect.any(Object), 1, { idempotent: true });
  });

  it("delegates concurrent capacity checks to atomic storage", async () => {
    const stored: unknown[] = [];
    const storage = {
      countSubmissions: async () => stored.length,
      saveSubmission: async (submission: unknown) => {
        await Promise.resolve();
        stored.push(submission);
      },
      saveSubmissionWithinLimit: async (submission: unknown, maxResponses: number) => {
        if (stored.length >= maxResponses) return { status: "limit_reached" as const };
        stored.push(submission);
        return undefined;
      },
      listSubmissionPage: async () => ({ items: [], hasMore: false }),
      listTextAnswerPage: async () => ({ items: [], hasMore: false }),
      aggregateResponses: async () => ({
        formId: baseSchema.id,
        formVersion: 1,
        submissionCount: stored.length,
        questions: []
      }),
      exportResponsesToCsv: async () => "",
      validateSubmission: async () => undefined
    } as unknown as UnifiedSubmissionStorageAdapter;
    const schema = { ...baseSchema, submissionSettings: { maxResponses: 1 } };
    const results = await Promise.allSettled([
      runSubmissionPipeline({ schema, storage, id: "first", locale: "en" }, { answer: "one" }),
      runSubmissionPipeline({ schema, storage, id: "second", locale: "en" }, { answer: "two" })
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(stored).toHaveLength(1);
  });

  it("allows an idempotent retry after the response limit is reached", async () => {
    const existing = createSubmission(
      baseSchema,
      { answer: "one" },
      {
        id: "first",
        locale: "en",
        submittedAt: "2026-09-17T00:00:00.000Z"
      }
    );
    const storage = {
      countSubmissions: async () => 1,
      saveSubmission: vi.fn(),
      saveSubmissionWithinLimit: vi.fn(async () => ({
        status: "duplicate" as const,
        submission: existing,
        payloadHash: await import("../src").then(({ hashFormSubmissionPayload }) => hashFormSubmissionPayload(existing))
      })),
      listSubmissionPage: async () => ({ items: [existing], hasMore: false }),
      listTextAnswerPage: vi.fn(),
      aggregateResponses: vi.fn(),
      exportResponsesToCsv: vi.fn(),
      validateSubmission: vi.fn()
    } as unknown as UnifiedSubmissionStorageAdapter;
    const result = await runSubmissionPipeline(
      {
        schema: { ...baseSchema, submissionSettings: { maxResponses: 1 } },
        storage,
        id: "first",
        locale: "en",
        submittedAt: "2026-09-17T00:00:00.000Z"
      },
      { answer: "one" }
    );

    expect(result.status).toBe("duplicate");
    expect(storage.saveSubmission).not.toHaveBeenCalled();
  });
});
