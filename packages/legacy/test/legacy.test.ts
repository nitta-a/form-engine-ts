import type { FormSubmission } from "@form-engine-ts/core";
import { createLegacyArrayAzureTableCodec, createLegacyAzureTableCodec, fromLegacyFormSubmission } from "../src";

describe("legacy submission boundary", () => {
  it("converts an answers payload to canonical values", () => {
    const legacy = {
      id: "legacy-1",
      formId: "form",
      formVersion: 1,
      answers: { name: "Ada" },
      metadata: { source: "migration" },
      submittedAt: "2026-08-30T00:00:00.000Z"
    };
    const submission: FormSubmission = fromLegacyFormSubmission(legacy);

    expect(submission.values).toEqual({ name: "Ada" });
    expect("answers" in submission).toBe(false);
  });

  it("keeps the legacy Azure answers codecs outside standard storage", () => {
    const codec = createLegacyArrayAzureTableCodec<{ readonly tenantId: string }>({
      metadataExtractor: (entity) => ({ tenantId: String(entity.tenantId) })
    });
    const submission = {
      id: "response-1",
      formId: "form",
      formVersion: 2,
      values: { first: "Ada", score: 5 },
      locale: "en-US",
      metadata: { tenantId: "tenant-1" },
      submittedAt: "2026-08-29T00:00:00.000Z"
    } as const;

    expect(codec.decode(codec.encode(submission))).toEqual(submission);
    expect(
      createLegacyAzureTableCodec().decode({
        PartitionKey: "form",
        RowKey: "submission",
        answers: JSON.stringify({ name: "Ada" }),
        answeredAt: "2026-08-29T00:00:00.000Z",
        surveyVersion: 3
      })
    ).toMatchObject({ formId: "form", formVersion: 3, values: { name: "Ada" } });
  });
});
