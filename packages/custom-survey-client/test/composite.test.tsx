import type { FormAnalytics, FormSchema } from "@form-engine-ts/core";
import { act, renderHook, waitFor } from "@testing-library/react";
import {
  type FreeTextAnswerItem,
  SurveyEditor,
  type SurveyEditorAdapter,
  SurveyResponseSummary,
  type SurveyVersionAdapter,
  toSurveyResponseSummary,
  useFreeTextAnswerTranslation,
  useSurveyEditor,
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
    const save = vi.fn<SurveyEditorAdapter["save"]>().mockResolvedValue(undefined);
    const translate = vi.fn<SurveyEditorAdapter["translate"]>().mockResolvedValue({
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
