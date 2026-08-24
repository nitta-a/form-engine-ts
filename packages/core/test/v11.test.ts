import {
  calculateCrossTabulation,
  calculateFieldVisibility,
  calculatePageVisibility,
  dispatchWebhook,
  type FormEvent,
  type FormSchema,
  type FormSubmission,
  populateSchemaTranslations,
  resolveLocalizedSchema,
  sanitizeSchema,
  selectVisibleAnswers,
  validateFormSchema,
  validatePageAnswers
} from "../src";

const pagedSchema: FormSchema = {
  id: "paged",
  version: 1,
  title: "Survey",
  defaultLocale: "en",
  supportedLocales: ["en", "ja"],
  fields: [
    { id: "kind", type: "radio", title: "Kind", required: true, options: [{ id: "yes", label: "Yes" }] },
    { id: "name", type: "text", title: "Name", description: "Full name", required: true },
    { id: "detail", type: "text", title: "Detail", required: true }
  ],
  pages: [
    { id: "basic", title: "Basic", questionIds: ["kind", "name"] },
    {
      id: "details",
      title: "Details",
      questionIds: ["detail"],
      displayCondition: { questionId: "kind", operator: "equals", value: "yes" }
    }
  ]
};

describe("static schema localization", () => {
  it("resolves stored translations and falls back without mutating the source", () => {
    const localizedSource: FormSchema = {
      ...pagedSchema,
      translations: { ja: { title: "アンケート" } },
      fields: pagedSchema.fields.map((field, index) =>
        index === 0
          ? {
              ...field,
              translations: { ja: { title: "種類" } },
              options: [{ id: "yes", label: "Yes", translations: { ja: "はい" } }]
            }
          : field
      )
    };
    const localized = resolveLocalizedSchema(localizedSource, "ja");
    expect(localized.title).toBe("アンケート");
    expect(localized.description).toBeUndefined();
    expect(localized.fields[0]?.title).toBe("種類");
    expect(localized.fields[1]?.title).toBe("Name");
    expect(localizedSource.title).toBe("Survey");
    expect(resolveLocalizedSchema(localizedSource, "en")).toBe(localizedSource);
  });

  it("populates form, field, option, and page translations in one batch per locale", async () => {
    const adapter = {
      translateText: vi.fn(),
      translateBatch: vi.fn(async (texts: readonly string[], locale: string) =>
        texts.map((text) => `${locale}:${text}`)
      )
    };
    const { schema: populated } = await populateSchemaTranslations(pagedSchema, ["ja", "ja"], adapter);
    expect(adapter.translateBatch).toHaveBeenCalledTimes(1);
    expect(populated.translations?.ja?.title).toBe("ja:Survey");
    expect(populated.fields[0]?.translations?.ja?.title).toBe("ja:Kind");
    const first = populated.fields[0];
    expect(first !== undefined && "options" in first ? first.options[0]?.translations?.ja : undefined).toBe("ja:Yes");
    expect(populated.pages?.[0]?.translations?.ja?.title).toBe("ja:Basic");
    expect(pagedSchema.translations).toBeUndefined();
  });
});

describe("page validation and visibility", () => {
  it("validates only the requested visible page and handles an invalid page index", () => {
    const first = validatePageAnswers(pagedSchema, 0, {});
    expect(first.issues.map((issue) => issue.fieldId)).toEqual(["kind", "name"]);
    expect(first.issues.some((issue) => issue.fieldId === "detail")).toBe(false);
    expect(validatePageAnswers(pagedSchema, 99, {})).toEqual({ valid: true, issues: [] });
  });

  it("skips conditional pages and excludes their stale answers", () => {
    const hiddenValues = { kind: "other", name: "Ada", detail: "stale" };
    expect(calculatePageVisibility(pagedSchema, hiddenValues)).toEqual({ basic: true, details: false });
    expect(calculateFieldVisibility(pagedSchema, hiddenValues).detail).toBe(false);
    expect(validatePageAnswers(pagedSchema, 1, hiddenValues)).toEqual({ valid: true, issues: [] });
    expect(selectVisibleAnswers(pagedSchema, hiddenValues)).toEqual({ kind: "other", name: "Ada" });
  });

  it("sanitizes missing, duplicate, empty, and unassigned page membership", () => {
    const dirty: FormSchema = {
      ...pagedSchema,
      pages: [
        { id: "one", questionIds: ["kind", "missing"] },
        { id: "empty", questionIds: ["missing"] },
        { id: "two", questionIds: ["kind", "name"] }
      ]
    };
    expect(sanitizeSchema(dirty).pages).toEqual([
      { id: "one", questionIds: ["kind"] },
      { id: "two", questionIds: ["name", "detail"] }
    ]);
    expect(dirty.pages?.[0]?.questionIds).toEqual(["kind", "missing"]);
  });

  it("rejects duplicate, unassigned, and forward page references", () => {
    const result = validateFormSchema({
      ...pagedSchema,
      pages: [
        {
          id: "first",
          questionIds: ["kind", "name"],
          displayCondition: { questionId: "detail", operator: "not_empty" }
        },
        { id: "second", questionIds: ["detail", "kind"] }
      ]
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues.map((issue) => issue.code)).toEqual(
        expect.arrayContaining(["duplicate_page_question", "forward_page_condition"])
      );
    }
    const unassigned = validateFormSchema({ ...pagedSchema, pages: [{ id: "only", questionIds: ["kind"] }] });
    expect(unassigned.valid ? [] : unassigned.issues.map((issue) => issue.code)).toContain("unassigned_page_question");
  });
});

describe("cross tabulation", () => {
  it("builds the matrix and all totals from complete single-choice pairs", () => {
    const response = (id: string, row: string | undefined, col: string | undefined): FormSubmission => ({
      id,
      formId: "form",
      formVersion: 1,
      locale: "en",
      submittedAt: "2026-01-01T00:00:00.000Z",
      values: { row, col }
    });
    const result = calculateCrossTabulation(
      [response("1", "a", "x"), response("2", "a", "y"), response("3", "b", "x"), response("4", "b", undefined)],
      "row",
      "col"
    );
    expect(result.matrix).toEqual({ a: { x: 1, y: 1 }, b: { x: 1 } });
    expect(result.rowTotals).toEqual({ a: 2, b: 1 });
    expect(result.colTotals).toEqual({ x: 2, y: 1 });
    expect(result.grandTotal).toBe(3);
  });
});

describe("webhook dispatch", () => {
  const event: FormEvent = {
    id: "event-1",
    type: "response.submitted",
    formId: "form",
    timestamp: "2026-01-01T00:00:00.000Z",
    payload: { answer: 1 }
  };

  it("posts JSON with custom headers and an HMAC signature", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 202 }));
    await expect(
      dispatchWebhook(
        event,
        { url: "https://example.test/hook", secret: "secret", headers: { "X-Test": "yes" } },
        fetchImpl
      )
    ).resolves.toEqual({ success: true, status: 202 });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.test/hook",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "content-type": "application/json",
          "X-Test": "yes",
          "X-Form-Engine-Signature": expect.stringMatching(/^[a-f0-9]{64}$/)
        })
      })
    );
  });

  it("returns HTTP failures and aborts timed-out requests", async () => {
    const failed = vi.fn<typeof fetch>(async () => new Response(null, { status: 500 }));
    await expect(dispatchWebhook(event, { url: "https://example.test" }, failed)).resolves.toEqual({
      success: false,
      status: 500,
      error: "Webhook returned HTTP 500."
    });
    const hanging: typeof fetch = async (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      });
    await expect(dispatchWebhook(event, { url: "https://example.test", timeoutMs: 1 }, hanging)).resolves.toEqual({
      success: false,
      error: "Webhook request timed out after 1ms."
    });
  });
});
