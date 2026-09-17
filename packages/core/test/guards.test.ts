import { describe, expect, it } from "vitest";
import {
  createChallengeGuard,
  createHoneypotGuard,
  createMemoryRateLimiter,
  createRateLimitGuard,
  type FormSchema,
  runSubmissionPipeline,
  type UnifiedSubmissionStorageAdapter
} from "../src";

const schema: FormSchema = {
  id: "guards",
  version: 1,
  title: "Guards",
  fields: [{ id: "answer", type: "text", title: "Answer", required: true }]
};

const storage = (): UnifiedSubmissionStorageAdapter =>
  ({
    saveSubmission: async () => undefined,
    listSubmissionPage: async () => ({ items: [], hasMore: false }),
    listTextAnswerPage: async () => ({ items: [], hasMore: false }),
    aggregateResponses: async () => ({ submissionCount: 0, fields: [] }),
    exportResponsesToCsv: async () => "",
    validateSubmission: async () => undefined
  }) as unknown as UnifiedSubmissionStorageAdapter;

describe("submission guards", () => {
  it("blocks a filled honeypot", async () => {
    await expect(
      runSubmissionPipeline(
        {
          schema,
          storage: storage(),
          id: "one",
          locale: "en",
          honeypotValue: "spam",
          guards: [createHoneypotGuard()]
        },
        { answer: "ok" }
      )
    ).rejects.toMatchObject({ payload: { code: "SUBMISSION_BLOCKED" } });
  });

  it("keeps the configured honeypot out of the saved answers", async () => {
    let savedValues: unknown;
    const configuredSchema = {
      ...schema,
      submissionSettings: { honeypotFieldId: "website" }
    };
    const configuredStorage = {
      ...storage(),
      saveSubmission: async (submission: { values: unknown }) => {
        savedValues = submission.values;
      }
    } as unknown as UnifiedSubmissionStorageAdapter;

    await runSubmissionPipeline(
      {
        schema: configuredSchema,
        storage: configuredStorage,
        id: "without-honeypot",
        locale: "en",
        guards: [createHoneypotGuard("website")]
      },
      { answer: "ok", website: "" }
    );

    expect(savedValues).toEqual({ answer: "ok" });
  });

  it("enforces a memory rate limit and resets after the window", async () => {
    const limiter = createMemoryRateLimiter({ limit: 1, windowMs: 1_000 });
    const guard = createRateLimitGuard(limiter, (context) => context.clientKey ?? "anonymous");
    const first = await guard({
      schema,
      values: {},
      context: {
        formId: schema.id,
        formVersion: 1,
        locale: "en",
        submittedAt: "2026-09-17T00:00:00.000Z",
        clientKey: "client"
      }
    });
    const second = await guard({
      schema,
      values: {},
      context: {
        formId: schema.id,
        formVersion: 1,
        locale: "en",
        submittedAt: "2026-09-17T00:00:00.500Z",
        clientKey: "client"
      }
    });
    const third = await guard({
      schema,
      values: {},
      context: {
        formId: schema.id,
        formVersion: 1,
        locale: "en",
        submittedAt: "2026-09-17T00:00:01.000Z",
        clientKey: "client"
      }
    });
    expect(first.status).toBe("allow");
    expect(second.status).toBe("block");
    expect(third.status).toBe("allow");
  });

  it("verifies a challenge token", async () => {
    const guard = createChallengeGuard(async (token) => token === "valid");
    const context = { formId: schema.id, formVersion: 1, locale: "en", submittedAt: "2026-09-17T00:00:00.000Z" };
    expect((await guard({ schema, values: {}, context: { ...context, challengeToken: "valid" } })).status).toBe(
      "allow"
    );
    expect((await guard({ schema, values: {}, context: { ...context, challengeToken: "invalid" } })).status).toBe(
      "block"
    );
  });
});
