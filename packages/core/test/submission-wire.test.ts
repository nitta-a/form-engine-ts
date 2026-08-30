import { z } from "zod";
import {
  createFormSubmissionSchema,
  type FormSubmission,
  FormSubmissionWireSchema,
  fromFormSubmissionWire,
  toFormSubmissionWire
} from "../src";

describe("submission wire conversion", () => {
  it("round-trips locale and canonical values through runtime validation", () => {
    const submission: FormSubmission = {
      id: "submission-1",
      formId: "form-1",
      formVersion: 1,
      values: { name: "Ada" },
      locale: "en-US",
      metadata: { source: "test" },
      submittedAt: "2026-08-29T00:00:00.000Z"
    };

    const wire = toFormSubmissionWire(submission);
    const parsed = FormSubmissionWireSchema.parse(wire);

    expect(fromFormSubmissionWire(parsed)).toEqual(submission);
    expect("answers" in fromFormSubmissionWire(parsed)).toBe(false);
  });

  it("keeps locale optional for older wire payloads", () => {
    const wire = FormSubmissionWireSchema.parse({
      id: "submission-1",
      formId: "form-1",
      formVersion: 1,
      values: {},
      metadata: {},
      submittedAt: "2026-08-29T00:00:00.000Z"
    });

    expect(fromFormSubmissionWire(wire).locale).toBeUndefined();
  });

  it("keeps application metadata typed in generated schemas", () => {
    const metadata = z.object({ surveyId: z.string(), attempt: z.number().int() });
    const schema = createFormSubmissionSchema({ metadata });
    const parsed = schema.parse({
      id: "submission-1",
      formId: "survey",
      formVersion: 1,
      values: { answer: "yes" },
      metadata: { surveyId: "survey-1", attempt: 2 },
      submittedAt: "2026-08-30T00:00:00.000Z"
    });

    expectTypeOf(parsed.metadata.surveyId).toEqualTypeOf<string>();
    expect(parsed.metadata.attempt).toBe(2);
    expect(schema.safeParse({ ...parsed, metadata: { surveyId: "survey-1" } }).success).toBe(false);
  });
});
