import {
  aggregateResponses,
  createChallengeGuard,
  createHoneypotGuard,
  type FormSchema,
  type FormValues,
  runSubmissionPipeline,
  type UnifiedSubmissionStorageAdapter
} from "@form-engine-ts/core";
import { FormRenderer, type SubmitContext } from "@form-engine-ts/react";
import { createMemoryStorageAdapter } from "@form-engine-ts/storage-memory";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const schema: FormSchema = {
  id: "guard-integration",
  version: 1,
  title: "Protected form",
  fields: [{ id: "answer", type: "text", title: "Answer", required: true }]
};
const submittedAt = "2026-01-01T12:00:00.000Z";

function createStorage() {
  const memory = createMemoryStorageAdapter();
  const unused = async (): Promise<never> => {
    throw new Error("This test does not use this storage operation");
  };
  const storage: UnifiedSubmissionStorageAdapter = {
    saveSubmission: async (submission) => {
      await memory.saveSubmission(submission);
      return undefined;
    },
    saveSubmissionWithinLimit: (submission, limit, options) => {
      if (memory.saveSubmissionWithinLimit === undefined) throw new Error("Response limits unavailable");
      return memory.saveSubmissionWithinLimit(submission, limit, options);
    },
    countSubmissions: memory.countSubmissions,
    listSubmissionPage: unused,
    listTextAnswerPage: unused,
    aggregateResponses: unused,
    exportResponsesToCsv: unused,
    validateSubmission: unused
  };
  return { memory, storage };
}

describe("submission pipeline integration", () => {
  it("enforces the last response slot during concurrent submissions", async () => {
    const { memory, storage } = createStorage();
    const limited = { ...schema, submissionSettings: { maxResponses: 2 } };
    const options = { schema: limited, storage, locale: "en", submittedAt };
    await runSubmissionPipeline({ ...options, id: "existing" }, { answer: "First" });
    const results = await Promise.allSettled([
      runSubmissionPipeline({ ...options, id: "second" }, { answer: "Second" }),
      runSubmissionPipeline({ ...options, id: "third" }, { answer: "Third" })
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({
      reason: { payload: { code: "FORM_CLOSED", messageKey: "form.responseLimitReached" } }
    });
    const saved = await memory.listSubmissions(schema.id, schema.version);
    expect(saved).toHaveLength(2);
    expect(aggregateResponses(schema, saved).submissionCount).toBe(2);
  });

  it("rejects a form closed after it was displayed", async () => {
    const user = userEvent.setup();
    const { memory, storage } = createStorage();
    let closed = false;
    const submit = vi.fn(async (values: FormValues) => {
      await runSubmissionPipeline(
        {
          schema,
          storage,
          id: "closed-response",
          locale: "en",
          submittedAt,
          now: () => new Date(submittedAt),
          runtimeSettings: () => ({
            formId: schema.id,
            updatedAt: submittedAt,
            ...(closed ? { closeAt: submittedAt } : {})
          })
        },
        values
      );
    });
    render(<FormRenderer schema={schema} onSubmit={submit} />);
    await user.type(screen.getByLabelText(/Answer/), "Ada");
    closed = true;
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await screen.findByRole("alert");
    await expect(submit.mock.results[0]?.value).rejects.toMatchObject({ payload: { code: "FORM_CLOSED" } });
    expect(await memory.listSubmissions(schema.id)).toHaveLength(0);
  });

  it("requires personal information confirmation before saving", async () => {
    const user = userEvent.setup();
    const { memory, storage } = createStorage();
    const privacyEngine = { detect: () => [{ fieldId: "answer", type: "email", matchedText: "ada@example.com" }] };
    const options = { schema, storage, id: "pii", locale: "en", submittedAt, privacyEngine };
    const values = { answer: "ada@example.com" };
    const submit = vi.fn(async (answers: FormValues, context: SubmitContext) => {
      await runSubmissionPipeline(
        { ...options, piiWarningAcknowledged: context.piiWarningAcknowledged === true },
        answers
      );
    });
    render(<FormRenderer schema={schema} onSubmit={submit} />);
    await user.type(screen.getByLabelText(/Answer/), values.answer);
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await screen.findByRole("dialog");
    await expect(submit.mock.results[0]?.value).rejects.toMatchObject({
      payload: { code: "PII_CONFIRMATION_REQUIRED", piiWarningAcknowledged: false }
    });
    expect(await memory.listSubmissions(schema.id)).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Proceed" }));
    await waitFor(async () => expect(await memory.listSubmissions(schema.id)).toHaveLength(1));
    expect((await memory.listSubmissions(schema.id))[0]?.values).toEqual(values);
  });

  it("blocks honeypot and invalid challenge submissions while allowing valid ones", async () => {
    const user = userEvent.setup();
    const { memory, storage } = createStorage();
    const options = {
      schema,
      storage,
      locale: "en",
      submittedAt,
      guards: [createHoneypotGuard(), createChallengeGuard(async (token) => token === "valid")]
    };
    let honeypotValue = "spam";
    let challengeToken = "valid";
    const submit = vi.fn(async (values: FormValues) => {
      await runSubmissionPipeline({ ...options, id: "guarded", honeypotValue, challengeToken }, values);
    });
    render(<FormRenderer schema={schema} onSubmit={submit} />);
    await user.type(screen.getByLabelText(/Answer/), "Ada");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await screen.findByRole("alert");
    await expect(submit.mock.results[0]?.value).rejects.toMatchObject({ payload: { code: "SUBMISSION_BLOCKED" } });
    honeypotValue = "";
    challengeToken = "invalid";
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(2));
    await expect(submit.mock.results[1]?.value).rejects.toMatchObject({ payload: { code: "SUBMISSION_BLOCKED" } });
    expect(await memory.listSubmissions(schema.id)).toHaveLength(0);
    challengeToken = "valid";
    await user.click(await screen.findByRole("button", { name: "Retry" }));
    await waitFor(async () => expect(await memory.listSubmissions(schema.id)).toHaveLength(1));
  });
});
