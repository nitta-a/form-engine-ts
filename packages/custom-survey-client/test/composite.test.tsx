import type { FormAnalytics, FormSchema } from "@form-engine-ts/core";
import { act, renderHook, waitFor } from "@testing-library/react";
import {
  composeSurveyVersionActions,
  createFreeTextTranslationController,
  type FreeTextAnswerItem,
  hasPiiCandidate,
  SurveyEditor,
  type SurveyEditorAdapter,
  SurveyResponseSummary,
  type SurveyVersionActionAdapter,
  type SurveyVersionAdapter,
  toSurveyResponseSummary,
  translateFreeTextAnswers,
  useFreeTextAnswerTranslation,
  useSurveyEditor,
  useSurveyVersionDomainActions,
  useSurveyVersionOperations
} from "../src";

const schema: FormSchema = {
  id: "customer-survey",
  version: 2,
  title: "Customer survey",
  defaultLocale: "en",
  supportedLocales: ["en", "ja"],
  translations: { ja: { title: "顧客アンケート" } },
  fields: [
    {
      id: "satisfaction",
      type: "radio",
      title: "Satisfaction",
      required: false,
      options: [
        { id: "good", label: "Good", translations: { ja: "良い" } },
        { id: "bad", label: "Bad", translations: { ja: "悪い" } }
      ]
    }
  ]
};

describe("custom survey client", () => {
  it("translates and saves editor state through the adapter", async () => {
    const save = vi.fn<NonNullable<SurveyEditorAdapter["save"]>>().mockResolvedValue(undefined);
    const translate = vi.fn<NonNullable<SurveyEditorAdapter["translate"]>>().mockResolvedValue({
      ...schema,
      title: "Translated survey"
    });
    const { result } = renderHook(() => useSurveyEditor({ schema, adapter: { save, translate } }));

    await act(async () => {
      expect(await result.current.translate()).toBe(true);
    });
    await waitFor(() => expect(result.current.schema.title).toBe("Translated survey"));
    await act(async () => expect(await result.current.save()).toBe(true));

    expect(translate).toHaveBeenCalledWith(expect.objectContaining({ sourceLocale: "en", targetLocale: "ja" }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ title: "Translated survey" }));
  });

  it("accepts the new editor adapter contract and controller alias", async () => {
    const updateSurveyDraft = vi.fn().mockResolvedValue(undefined);
    const translateSurveyPreview = vi.fn().mockResolvedValue({ ...schema, title: "Preview" });
    const { result } = renderHook(() =>
      useSurveyEditor({ adapter: { updateSurveyDraft, translateSurveyPreview }, schema })
    );

    await act(async () => {
      expect(await result.current.translate()).toBe(true);
      expect(await result.current.save()).toBe(true);
    });

    expect(translateSurveyPreview).toHaveBeenCalled();
    expect(updateSurveyDraft).toHaveBeenCalledWith(expect.objectContaining({ title: "Customer survey" }));
  });

  it("translates selected free-text answers in language groups and requires PII confirmation", async () => {
    const items: FreeTextAnswerItem[] = [
      { id: "a", responseId: "r1", fieldId: "comment", text: "hello", sourceLanguage: "en" },
      {
        id: "b",
        responseId: "r2",
        fieldId: "comment",
        text: "こんにちは",
        sourceLanguage: "ja",
        findings: [{ fieldId: "comment", type: "email" }]
      }
    ];
    const batches: string[] = [];
    const adapter = {
      translateBatch: vi.fn(
        async ({ items: batch, sourceLanguage }: { items: readonly FreeTextAnswerItem[]; sourceLanguage: string }) => {
          batches.push(`${sourceLanguage}:${batch.map((item) => item.id).join(",")}`);
          return batch.map((item) => ({ id: item.id, text: `${item.text}!` }));
        }
      )
    };
    const { result } = renderHook(() =>
      useFreeTextAnswerTranslation({ items, adapter, targetLanguage: "fr", batchSize: 1 })
    );

    act(() => {
      result.current.selectAll();
    });
    await act(async () => {
      expect((await result.current.translateSelected()).status).toBe("needs_confirmation");
    });
    expect(adapter.translateBatch).not.toHaveBeenCalled();

    await act(async () => {
      expect((await result.current.confirmPii()).status).toBe("success");
    });
    expect(batches).toEqual(["en:a", "ja:b"]);
    expect(result.current.items.every((item) => item.status === "success")).toBe(true);
  });

  it("normalizes string answers from FormResponse records and supports cancelling PII confirmation", async () => {
    const adapter = { translateBatch: vi.fn().mockResolvedValue([{ id: "r1:comment", text: "translated" }]) };
    const { result } = renderHook(() =>
      useFreeTextAnswerTranslation({
        items: [
          {
            responseId: "r1",
            formId: schema.id,
            formVersion: schema.version,
            sourceLocale: "en",
            answers: { comment: "hello", score: 3 },
            submittedAt: "2026-01-01T00:00:00.000Z"
          }
        ],
        adapter,
        targetLanguage: "ja",
        detectPii: () => [{ fieldId: "comment", type: "email" }]
      })
    );

    act(() => result.current.selectAll());
    await act(async () => expect((await result.current.translateSelected()).status).toBe("needs_confirmation"));
    act(() => result.current.cancelPii());
    expect(result.current.status).toBe("idle");
    expect(adapter.translateBatch).not.toHaveBeenCalled();
  });

  it("translates arbitrary answer arrays directly and returns per-answer failures", async () => {
    const items: FreeTextAnswerItem[] = [
      { id: "en-1", responseId: "r1", fieldId: "comment", text: "hello", sourceLanguage: "en" },
      { id: "ja-1", responseId: "r2", fieldId: "comment", text: "こんにちは", sourceLanguage: "ja" }
    ];
    const adapter = {
      translateBatch: vi.fn(async ({ items: batch }: { items: readonly FreeTextAnswerItem[] }) => {
        if (batch[0]?.id === "ja-1") throw new Error("provider unavailable");
        return batch.map((item) => ({ id: item.id, text: `${item.text}!` }));
      })
    };

    const result = await translateFreeTextAnswers(items, adapter, { targetLanguage: "fr", batchSize: 1 });

    expect(result.status).toBe("partial");
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.items).toEqual([
      expect.objectContaining({ id: "en-1", status: "success", translatedText: "hello!" }),
      expect.objectContaining({ id: "ja-1", status: "error" })
    ]);
    expect(adapter.translateBatch).toHaveBeenCalledTimes(2);
  });

  it("supports a selection-free controller and explicit PII confirmation", async () => {
    const item: FreeTextAnswerItem = {
      id: "email-answer",
      responseId: "r1",
      fieldId: "comment",
      text: "person@example.com",
      sourceLanguage: "en",
      findings: [{ fieldId: "comment", type: "email" }]
    };
    const adapter = { translateBatch: vi.fn().mockResolvedValue([{ id: item.id, text: "translated" }]) };
    const controller = createFreeTextTranslationController({ adapter, targetLanguage: "ja" });

    expect(hasPiiCandidate([item])).toBe(true);
    await expect(controller.translate([item])).resolves.toMatchObject({ status: "needs_confirmation" });
    await expect(controller.translate([item], { piiConfirmed: true })).resolves.toMatchObject({
      status: "success",
      succeeded: 1,
      items: [expect.objectContaining({ translatedText: "translated" })]
    });
  });

  it("gates publishing behind a warning confirmation and tracks operation state", async () => {
    const adapter: SurveyVersionAdapter = {
      qualityCheck: vi
        .fn()
        .mockResolvedValue({ issues: [{ code: "missing", message: "Missing translation", severity: "warning" }] }),
      publish: vi.fn().mockResolvedValue(undefined),
      duplicate: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      setStatus: vi.fn().mockResolvedValue(undefined)
    };
    const { result } = renderHook(() => useSurveyVersionOperations({ version: schema, adapter }));

    await act(async () => {
      expect(await result.current.publish()).toBe(false);
    });
    expect(result.current.operations.publish.status).toBe("needs_confirmation");
    await act(async () => {
      expect(await result.current.publish({ allowWarnings: true })).toBe(true);
    });
    expect(adapter.publish).toHaveBeenCalledWith(expect.objectContaining({ allowWarnings: true }));
    expect(result.current.operations.publish.status).toBe("success");
  });

  it("supports quality issue decisions and the new version action names", async () => {
    const issue = { code: "missing", message: "Missing translation", severity: "warning" as const };
    const adapter: SurveyVersionAdapter = {
      runQualityCheck: vi.fn().mockResolvedValue({ issues: [issue] }),
      publish: vi.fn().mockResolvedValue(undefined),
      decideQualityIssue: vi.fn().mockResolvedValue(undefined),
      cloneDraft: vi.fn().mockResolvedValue(undefined),
      deleteDraft: vi.fn().mockResolvedValue(undefined),
      setVisibility: vi.fn().mockResolvedValue(undefined)
    };
    const { result } = renderHook(() => useSurveyVersionOperations({ version: schema, adapter }));

    await act(async () => {
      expect(await result.current.runQualityCheck()).toEqual({ issues: [issue] });
      expect(await result.current.decideQualityIssue(issue, "accept")).toBe(true);
      expect(await result.current.publish()).toBe(true);
      expect(await result.current.cloneDraft()).toBe(true);
      expect(await result.current.deleteDraft()).toBe(true);
      expect(await result.current.setVisibility("published")).toBe(true);
    });

    expect(result.current.qualityDecisions["missing:"]).toBe("accept");
    expect(adapter.publish).toHaveBeenCalledWith(expect.objectContaining({ allowWarnings: false }));
    expect(result.current.operations.setVisibility.status).toBe("success");
  });

  it("composes optional version actions and publishes without a quality adapter", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const cloneDraft = vi.fn().mockResolvedValue(undefined);
    const adapter = composeSurveyVersionActions({ publish }, { cloneDraft });
    const { result } = renderHook(() => useSurveyVersionOperations({ version: schema, adapter }));

    await act(async () => {
      expect(await result.current.publish()).toBe(true);
      expect(await result.current.cloneDraft()).toBe(true);
    });

    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ allowWarnings: false, version: schema }));
    expect(cloneDraft).toHaveBeenCalledWith(expect.objectContaining({ version: schema }));
  });

  it("passes application-owned version records through the domain controller", async () => {
    type MakerVersion = { readonly id: string; readonly revision: number };
    type MakerState = { readonly formId: string; readonly revision: number };
    const version: MakerVersion = { id: "maker-version", revision: 4 };
    const state: MakerState = { formId: "customer-survey", revision: 8 };
    const publish = vi.fn().mockResolvedValue(undefined);
    const adapter: SurveyVersionActionAdapter<MakerVersion, MakerState> = { publish };
    const { result } = renderHook(() => useSurveyVersionDomainActions({ version, state, adapter }));

    await act(async () => expect(await result.current.publish()).toBe(true));

    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ version, state, allowWarnings: false }));
  });

  it("localizes question and option labels from version data", () => {
    const summary: FormAnalytics = {
      formId: schema.id,
      formVersion: schema.version,
      submissionCount: 2,
      questions: [
        {
          fieldId: "satisfaction",
          kind: "radio",
          answeredCount: 2,
          unansweredCount: 0,
          options: [
            { id: "good", count: 2, percentageOfSubmissions: 100 },
            { id: "bad", count: 0, percentageOfSubmissions: 0 }
          ]
        }
      ]
    };
    const data = toSurveyResponseSummary(summary, schema, "ja");
    expect(data.title).toBe("顧客アンケート");
    expect(data.questions[0]?.label).toBe("Satisfaction");
    expect(data.questions[0]?.options?.[0]?.label).toBe("良い");
  });

  it("accepts the requested direct summary component props", () => {
    const summary: FormAnalytics = {
      formId: schema.id,
      formVersion: schema.version,
      submissionCount: 0,
      questions: []
    };
    expect(() => SurveyResponseSummary({ summary, version: schema, sourceLanguage: "en" })).not.toThrow();
    expect(SurveyEditor).toBeDefined();
  });
});
