import {
  type BaseSubmissionMetadata,
  createSubmission,
  exportResponsesToCsv,
  exportResponsesToCsvStream,
  type FormSchema
} from "../src";

interface SurveyMetadata extends BaseSubmissionMetadata {
  readonly deckId: string;
}

const schema: FormSchema = {
  id: "survey",
  version: 1,
  title: "Survey",
  fields: [{ id: "answer", type: "text", title: "Answer", required: false }]
};

describe("generic CSV export", () => {
  it("keeps custom column metadata typed and exports it", () => {
    const submission = createSubmission<SurveyMetadata>({
      formId: schema.id,
      formVersion: schema.version,
      answers: { answer: "yes" },
      metadata: { deckId: "deck-a" },
      submittedAt: "2026-08-30T00:00:00.000Z"
    });
    const csv = exportResponsesToCsv<SurveyMetadata>(schema, [submission], {
      withBom: false,
      customColumns: [{ key: "deck", header: "Deck ID", getValue: (value) => value.metadata.deckId }]
    });
    expect(csv).toContain("Deck ID");
    expect(csv).toContain("deck-a");
  });

  it("also exposes a byte ReadableStream", async () => {
    const stream = exportResponsesToCsvStream(schema, [], { withBom: false });
    await expect(new Response(stream).text()).resolves.toContain("submissionId,submittedAt,locale");
  });
});
