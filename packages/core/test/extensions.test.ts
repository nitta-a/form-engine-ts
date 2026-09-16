import { describe, expect, expectTypeOf, it } from "vitest";
import {
  aggregateForms,
  createFormLifecycleAdapter,
  createInitialSchemaByMode,
  createSchemaDomainCodec,
  evaluateQuizLocally,
  type FormPolicy,
  type FormResource,
  type FormSchema,
  type FormSubmission,
  getContentModeDiagnostics,
  getContentModePolicy,
  mapField,
  mapOption,
  mapPage,
  mapSchema,
  type TypedFormSchema,
  validateFormSchema
} from "../src";

const poll = createInitialSchemaByMode("poll", { id: "poll", title: "Poll", locale: "en" });
const firstField = poll.fields[0];
if (firstField === undefined || !("options" in firstField)) throw new Error("Missing field fixture");
const twoQuestions = {
  ...poll,
  fields: [
    firstField,
    {
      ...firstField,
      id: "second",
      options: firstField.options.map((option) => ({ ...option, id: `${option.id}-second` }))
    }
  ]
};
const response: FormSubmission = {
  id: "r",
  formId: "poll",
  formVersion: 1,
  locale: "en",
  submittedAt: "2026-01-01T00:00:00.000Z",
  values: { "question-1": "option-1" }
};

describe("shared content mode settings", () => {
  it("removes the poll upper bound while enforcing configured limits everywhere", () => {
    expect(validateFormSchema(twoQuestions).valid).toBe(true);
    expect(getContentModeDiagnostics(twoQuestions)).toEqual([]);
    expect(getContentModePolicy("poll", { maxFields: 10 }).maxFields).toBe(10);
    const policy: FormPolicy = { maxFields: 1, contentMode: { maxFields: 10 } };
    expect(getContentModePolicy("poll", policy).maxFields).toBe(1);
    expect(validateFormSchema(twoQuestions, { policy }).valid).toBe(false);
    expect(getContentModeDiagnostics(twoQuestions, policy)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "poll_field_count" })])
    );
    expect(() => getContentModePolicy("poll", { maxFields: -1 })).toThrow();
    expect(() => getContentModePolicy("poll", { maxFields: Number.POSITIVE_INFINITY })).toThrow();
  });
  it("supports host-selected types and checks option limits", () => {
    const textPoll: FormSchema = { ...poll, fields: [{ id: "q", title: "Q", type: "text", required: false }] };
    const policy: FormPolicy = { contentMode: { allowedFieldTypes: ["text"] } };
    expect(validateFormSchema(textPoll, { policy }).valid).toBe(true);
    expect(getContentModeDiagnostics(textPoll, policy)).toEqual([]);
    expect(getContentModeDiagnostics(poll, { contentMode: { minOptionsPerField: 3 } })[0]?.code).toBe(
      "options_minimum"
    );
    expect(getContentModeDiagnostics(poll, { maxOptionsPerField: 1 })[0]?.code).toBe("options_maximum");
    expect(getContentModePolicy("poll", { ...policy, allowedFieldTypes: ["radio"] }).allowedFieldTypes).toEqual([]);
  });
  it("requires and validates a custom quiz evaluator for non-radio fields", () => {
    const schema: FormSchema = {
      ...poll,
      metadata: { mode: "quiz" },
      fields: [{ id: "q", title: "Q", type: "text", required: false }]
    };
    const policy: FormPolicy = {
      contentMode: {
        allowedFieldTypes: ["text"],
        evaluateQuiz: () => ({ totalScore: 2, maxPossibleScore: 2, isPassed: true, questions: [] })
      }
    };
    expect(validateFormSchema(schema, { policy }).valid).toBe(true);
    expect(evaluateQuizLocally(schema, { q: "answer" }, policy).totalScore).toBe(2);
    expect(() => evaluateQuizLocally(schema, {}, { contentMode: { allowedFieldTypes: ["text"] } })).toThrow();
    expect(() =>
      evaluateQuizLocally(
        schema,
        {},
        {
          contentMode: {
            ...policy.contentMode,
            evaluateQuiz: () => ({ totalScore: NaN, maxPossibleScore: 1, questions: [] })
          }
        }
      )
    ).toThrow();
  });
});

describe("lossless node and domain mapping", () => {
  it("retains unknown properties, nested settings, page references and translation metadata", () => {
    const original = {
      ...twoQuestions,
      supportedLocales: ["en", "ja"],
      unknownExtension: { flags: [1, 2] },
      translationMetadata: { ja: { title: { provider: "custom", extra: [true] } } },
      pages: [
        { id: "one", questionIds: ["question-1"] },
        {
          id: "two",
          questionIds: ["second"],
          displayCondition: { questionId: "question-1", operator: "equals" as const, value: "option-1" }
        }
      ]
    };
    const mapped = mapSchema(original, (schema) => ({
      title: "Updated",
      fields: schema.fields.map((field) => mapField(field, () => ({ title: "Question" })))
    }));
    expect(mapped.unknownExtension).toEqual(original.unknownExtension);
    expect(mapped.unknownExtension).not.toBe(original.unknownExtension);
    expect(mapped.pages).toEqual(original.pages);
    expect(mapped.translationMetadata).toEqual(original.translationMetadata);
    expect(original.title).toBe("Poll");
    expect(mapPage(original.pages[0] ?? { id: "one", questionIds: [] }, () => ({ title: "Page" })).questionIds).toEqual(
      ["question-1"]
    );
    expect(mapOption({ id: "o", label: "O", config: { color: "red" } }, () => ({ label: "New" })).config).toEqual({
      color: "red"
    });
    expect(() => mapSchema({ ...original, invalid: new Date() }, () => ({}))).toThrow();
    expect(() => mapField({ ...firstField, extension: undefined }, () => ({}))).toThrow();
  });
  it("preserves metadata inference and domain-owned data via the original value", () => {
    type Metadata = { owner: string };
    type TranslationMetadata = { source: "manual" | "machine" };
    const typed: TypedFormSchema<Metadata, TranslationMetadata> = {
      id: "typed",
      version: 1,
      title: "Typed",
      fields: [],
      metadata: { owner: "a" },
      translationMetadata: { ja: { title: { source: "manual" } } }
    };
    expectTypeOf(typed.metadata?.owner).toEqualTypeOf<string | undefined>();
    expectTypeOf(typed.translationMetadata?.ja?.title?.source).toEqualTypeOf<"manual" | "machine" | undefined>();
    const codec = createSchemaDomainCodec({
      toFormSchema: (domain: { name: string; privateCode: number }) => ({ ...poll, title: domain.name }),
      fromFormSchema: (schema: FormSchema, original: { name: string; privateCode: number }) => ({
        ...original,
        name: schema.title
      })
    });
    const domain = { name: "Before", privateCode: 42 };
    expect(
      codec.fromFormSchema(
        mapSchema(codec.toFormSchema(domain), () => ({ title: "After" })),
        domain
      )
    ).toEqual({ name: "After", privateCode: 42 });
  });
});

describe("cross-form aggregation", () => {
  it("groups versions, modes, locales and metadata without counting skips as zero scores", () => {
    const quiz = createInitialSchemaByMode("quiz", { id: "quiz", title: "Quiz", locale: "en" });
    const graded = { ...quiz, metadata: { mode: "quiz", quiz: { passingScore: 1 } } };
    const result = aggregateForms(
      [poll, { ...poll, version: 2 }, graded],
      [
        response,
        { ...response, id: "v2", formVersion: 2, locale: "ja", metadata: { segment: "paid" } },
        { ...response, id: "pass", formId: "quiz" },
        { ...response, id: "fail", formId: "quiz", values: { "question-1": "option-2" } },
        { ...response, id: "missing", formVersion: 3 },
        { ...response, id: "invalid", values: { "question-1": "missing" } }
      ],
      {
        byLocale: true,
        byContentMode: true,
        metadata: { segment: (submission) => (submission.metadata?.segment === "paid" ? "paid" : undefined) },
        scores: true,
        includeSkipDetails: true
      }
    );
    expect(result.aggregatedCount).toBe(4);
    expect(result.groups.contentMode?.map(({ key, count }) => ({ key, count }))).toEqual([
      { key: "poll", count: 2 },
      { key: "quiz", count: 2 }
    ]);
    expect(result.groups["metadata:segment"]?.map(({ key, count }) => ({ key, count }))).toEqual([
      { key: null, count: 3 },
      { key: "paid", count: 1 }
    ]);
    expect(result.scores).toEqual({
      evaluatedCount: 2,
      averageScore: 0.5,
      scoreRate: 0.5,
      passCount: 1,
      passEligibleCount: 2,
      passRate: 0.5
    });
    expect(result.skipCounts).toMatchObject({ schema_missing: 1, invalid_answers: 1, not_quiz: 2 });
    expect(aggregateForms([], [], { scores: true }).scores?.passRate).toBeNull();
    expect(aggregateForms([quiz], [{ ...response, formId: "quiz" }], { scores: true }).scores?.passRate).toBeNull();
    expect(() => aggregateForms([poll, poll], [])).toThrow("Duplicate schema");
  });
});

describe("lifecycle failure contract", () => {
  it("rejects missing scope mapping before any read, and reports partial non-atomic failures", async () => {
    const records: FormResource[] = [
      { kind: "schema", id: "a", value: {} },
      { kind: "submission", id: "b", value: {} }
    ];
    let reads = 0;
    let removed = 0;
    const adapter = createFormLifecycleAdapter({
      resources: ["schema", "submission"],
      list: async () => {
        reads++;
        return records;
      },
      remove: async () => {
        if (removed++ === 0) return 1;
        throw new Error("offline");
      }
    });
    await expect(adapter.deleteForm({ formId: "f", tenantId: "t" })).rejects.toThrow("scope mapping");
    expect(reads).toBe(0);
    const unmapped = createFormLifecycleAdapter(
      {
        resources: ["schema"],
        list: async () => records.slice(0, 1),
        remove: async () => 1
      },
      { scope: () => ({}) }
    );
    await expect(unmapped.inspectFormDeletion({ formId: "f", tenantId: "t" })).rejects.toThrow("tenant mapping");
    expect((await adapter.deleteForm({ formId: "f" })).error?.code).toBe("transaction_unsupported");
    expect(reads).toBe(0);
    expect(await adapter.deleteForm({ formId: "f", allowNonAtomic: true })).toMatchObject({
      status: "partial",
      atomic: false,
      counts: { schema: 1, submission: 0 }
    });
    await expect(adapter.inspectFormDeletion({ formId: "f", cursor: "%" })).rejects.toThrow("cursor");
    await expect(adapter.inspectFormDeletion({ formId: "f", pageSize: 0 })).rejects.toThrow("pageSize");
  });
});
