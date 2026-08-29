import type { BaseSubmissionMetadata } from "@form-engine-ts/core";
import { createSubmissionController } from "../src";

describe("submission controller", () => {
  it("prevents duplicate requests and exposes completion state", async () => {
    let resolve: (() => void) | undefined;
    const submit = vi.fn(
      () =>
        new Promise<void>((finish) => {
          resolve = finish;
        })
    );
    const controller = createSubmissionController({ submit });
    const context = { attemptId: "attempt-1", formId: "form", formVersion: 1, submittedAt: "2026-01-01" };

    const first = controller.submit({ answer: "yes" }, context);
    await Promise.resolve();
    expect(await controller.submit({ answer: "yes" }, context)).toEqual({ status: "cancelled" });
    resolve?.();

    expect(await first).toEqual({ status: "success" });
    expect(controller.getState()).toMatchObject({ status: "success", canRetry: false, attemptCount: 1 });
    expect(submit).toHaveBeenCalledOnce();
  });

  it("allows retry after failure and preserves typed metadata", async () => {
    interface Metadata extends BaseSubmissionMetadata {
      readonly deckId: string;
      readonly sessionId: string;
    }
    const submit = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce({ submissionId: "submission-1" });
    const controller = createSubmissionController<{ readonly submissionId: string }, Metadata>({ submit });
    const context = {
      attemptId: "attempt-1",
      formId: "form",
      formVersion: 1,
      submittedAt: "2026-01-01",
      metadata: { deckId: "deck-1", sessionId: "session-1" }
    };

    expect(await controller.submit({ answer: "yes" }, context)).toMatchObject({ status: "error" });
    expect(controller.getState().canRetry).toBe(true);
    expect(await controller.retry()).toEqual({ status: "success", response: { submissionId: "submission-1" } });
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit).toHaveBeenLastCalledWith({ answer: "yes" }, context);
  });
});
