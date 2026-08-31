import type { FormAnalytics, FormSchema } from "@form-engine-ts/core";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import {
  composeSurveyVersionActions,
  createFreeTextTranslationController,
  type FreeTextAnswerItem,
  hasPiiCandidate,
  mapSurveyResponseSummary,
  SurveyEditor,
  type SurveyEditorAdapter,
  SurveyProvider,
  SurveyResponseSummary,
  SurveyResponseSummaryCustomDomain,
  SurveyResponseSummaryDomain,
  type SurveyUiProviderProps,
  type SurveyVersionActionAdapter,
  type SurveyVersionAdapter,
  SurveyVersionPanel,
  SurveyWorkflowControlled,
  surveyQualityIssueKey,
  toSurveyResponseSummary,
  translateFreeTextAnswers,
  useFreeTextAnswerTranslation,
  useFreeTextDomainAnswerTranslation,
  useSurveyEditor,
  useSurveyEditorDomain,
  useSurveyMapping,
  useSurveyMappingCrud,
  useSurveyQualityController,
  useSurveyResponseSummaryDomain,
  useSurveyTranslation,
  useSurveyVersionDomainActions,
  useSurveyVersionOperations,
  useSurveyWorkflow
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

  it("keeps a domain record as the editor source of truth for question operations", async () => {
    type DomainVersion = { readonly schema: FormSchema; readonly marker: string };
    const version: DomainVersion = { schema, marker: "maker" };
    const onDomainChange = vi.fn();
    const addQuestion = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useSurveyEditorDomain({
        domain: version,
        domainAdapter: {
          toFormSchema: (domain) => domain.schema,
          fromFormSchema: (nextSchema, previous) => ({ ...previous, schema: nextSchema })
        },
        adapter: {
          translateSurveyPreview: vi.fn().mockResolvedValue(version),
          updateSurveyDraft: vi.fn().mockResolvedValue(undefined)
        },
        questionAdapter: { addQuestion },
        onDomainChange
      })
    );

    await act(async () => expect(await result.current.addQuestion("text")).toBe(true));

    expect(addQuestion).toHaveBeenCalledWith(
      expect.objectContaining({ question: expect.objectContaining({ type: "text" }) })
    );
    expect(onDomainChange).toHaveBeenCalled();
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

  it("updates hook item state for direct translation and accepts an application PII callback", async () => {
    const item: FreeTextAnswerItem = {
      id: "direct-email",
      responseId: "r1",
      fieldId: "comment",
      text: "person@example.com",
      sourceLanguage: "en",
      findings: [{ fieldId: "comment", type: "email" }]
    };
    const onPiiConfirmation = vi.fn().mockResolvedValue(true);
    const adapter = { translateBatch: vi.fn().mockResolvedValue([{ id: item.id, text: "翻訳済み" }]) };
    const { result } = renderHook(() =>
      useFreeTextAnswerTranslation({
        items: [item],
        adapter,
        targetLanguage: "ja",
        onPiiConfirmation
      })
    );

    await act(async () => {
      const outcome = await result.current.translate([item]);
      expect(outcome.status).toBe("success");
    });

    expect(onPiiConfirmation).toHaveBeenCalledWith(item.findings);
    expect(result.current.items[0]).toEqual(expect.objectContaining({ id: item.id, translatedText: "翻訳済み" }));
    expect(result.current.items[0]?.status).toBe("success");
  });

  it("translates domain answer arrays directly and preserves adapter-provided IDs", async () => {
    type DomainAnswer = { readonly answerId: string; readonly text: string };
    const answer: DomainAnswer = { answerId: "domain-1", text: "hello" };
    const adapter = {
      translateBatch: vi.fn().mockResolvedValue([{ id: answer.answerId, text: "こんにちは" }])
    };
    const { result } = renderHook(() =>
      useFreeTextDomainAnswerTranslation({
        items: [answer],
        domainAdapter: {
          toFreeTextAnswerItem: (domainAnswer) => ({
            id: domainAnswer.answerId,
            responseId: domainAnswer.answerId,
            fieldId: "comment",
            text: domainAnswer.text,
            sourceLanguage: "en"
          })
        },
        adapter,
        targetLanguage: "ja"
      })
    );

    await act(async () => {
      const outcome = await result.current.translate([answer]);
      expect(outcome.items[0]).toEqual(expect.objectContaining({ id: "domain-1", translatedText: "こんにちは" }));
    });
    expect(result.current.items[0]).toEqual(expect.objectContaining({ id: "domain-1", translatedText: "こんにちは" }));
  });

  it("accepts an i18next-shaped instance without a type assertion", () => {
    const i18n = {
      language: "ja",
      t: (key: string, options?: { readonly ns?: string | readonly string[] }) => `${options?.ns ?? "common"}:${key}`
    };
    const props: SurveyUiProviderProps = { i18n, children: null };
    expect(props.i18n).toBe(i18n);
  });

  it("returns the adapter error from structured version action results", async () => {
    const error = new Error("publish failed at Maker API");
    const publish = vi.fn().mockRejectedValue(error);
    const { result } = renderHook(() => useSurveyVersionOperations({ version: schema, adapter: { publish } }));

    let actionResult: { succeeded: boolean; error?: Error } | undefined;
    await act(async () => {
      actionResult = await result.current.publishResult();
    });

    expect(actionResult).toEqual({ succeeded: false, error });
    expect(result.current.operations.publish.result).toEqual({ succeeded: false, error });
  });

  it("preserves structured version responses and invokes replaceable action effects", async () => {
    const response = { code: "QUALITY_BLOCKED", details: { issueCount: 2 } };
    const invalidate = vi.fn().mockResolvedValue(undefined);
    const notify = vi.fn();
    const publishResult = vi.fn().mockResolvedValue({ succeeded: false, response, metadata: { source: "quality" } });
    const { result } = renderHook(() =>
      useSurveyVersionOperations({ version: schema, adapter: { publishResult, invalidate, notify } })
    );

    let actionResult: Awaited<ReturnType<typeof result.current.publishResult>> | undefined;
    await act(async () => {
      actionResult = await result.current.publishResult({ allowWarnings: true });
    });

    expect(actionResult).toEqual({ succeeded: false, response, metadata: { source: "quality" } });
    expect(invalidate).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
    expect(result.current.operations.publish.status).toBe("error");
  });

  it("supports generic domain workflow and mapping adapters", async () => {
    type SurveyDomain = { readonly id: string; readonly state: string };
    const domain: SurveyDomain = { id: "survey", state: "draft" };
    const transition = vi.fn().mockResolvedValue({ ...domain, state: "published" });
    const onDomainChange = vi.fn();
    const workflow = renderHook(() =>
      useSurveyWorkflow({
        domain,
        transitions: [{ id: "publish", label: "Publish" }],
        adapter: { transition },
        onDomainChange
      })
    );

    await act(async () => expect(await workflow.result.current.transition("publish")).toBe(true));
    expect(transition).toHaveBeenCalledWith(expect.objectContaining({ domain, transition: "publish" }));
    expect(onDomainChange).toHaveBeenCalledWith({ id: "survey", state: "published" });

    const saveMappings = vi.fn().mockResolvedValue(undefined);
    const mappings = [{ id: "m1", sourceFieldId: "name", targetFieldId: "fullName" }];
    const mapping = renderHook(() => useSurveyMapping({ domain, mappings, adapter: { saveMappings } }));
    act(() =>
      mapping.result.current.setMappings([...mappings, { id: "m2", sourceFieldId: "email", targetFieldId: "mail" }])
    );
    await act(async () => expect(await mapping.result.current.save()).toBe(true));
    expect(saveMappings).toHaveBeenCalledWith(
      expect.objectContaining({ mappings: expect.arrayContaining([expect.objectContaining({ id: "m2" })]) })
    );
  });

  it("uses stable quality issue keys for custom quality slots", () => {
    expect(surveyQualityIssueKey({ code: "missing", message: "Missing", path: "fields.0.title" })).toBe(
      "missing:fields.0.title"
    );
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

  it("allows the default version panel warning dialog to be dismissed", async () => {
    const adapter: SurveyVersionAdapter = {
      qualityCheck: vi.fn().mockResolvedValue({
        issues: [{ code: "missing", message: "Missing translation", severity: "warning" }]
      }),
      publish: vi.fn().mockResolvedValue(undefined)
    };
    const { result } = renderHook(() => useSurveyVersionOperations({ version: schema, adapter }));

    await act(async () => {
      await result.current.runQualityCheck();
      await result.current.publish();
    });

    const view = render(<SurveyVersionPanel version={schema} actions={result.current} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Quality warnings must be confirmed");
    await act(async () => {
      screen.getByRole("button", { name: "Cancel" }).click();
    });
    expect(screen.queryByText("Quality warnings must be confirmed before publishing.")).toBeNull();
    view.unmount();
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

  it("returns typed quality payloads and original action errors from the domain version controller", async () => {
    type QualityPayload = { providerRun: string; diagnostics: readonly string[] };
    const issue = { code: "missing", message: "Missing", severity: "warning" as const };
    const payload: QualityPayload = { providerRun: "run-2", diagnostics: ["missing"] };
    const publishError = new Error("publish failed");
    const version = { id: "maker-version" };
    const { result } = renderHook(() =>
      useSurveyVersionDomainActions({
        version,
        adapter: {
          runQualityCheck: vi.fn().mockResolvedValue({
            status: "COMPLETED" as const,
            runId: "run-2",
            checkedRevision: 9,
            issues: [issue],
            payload
          }),
          publishResult: vi.fn().mockResolvedValue({
            succeeded: false,
            error: publishError,
            response: { providerCode: "PUBLISH_REJECTED" }
          })
        }
      })
    );

    await act(async () => {
      const quality = await result.current.runQualityCheckResult();
      expect(quality.data?.payload).toEqual(payload);
      expect(quality.data?.status).toBe("COMPLETED");
      expect(quality.data?.checkedRevision).toBe(9);
      expect((await result.current.publishResult({ allowWarnings: true })).error).toBe(publishError);
    });
    expect(result.current.quality.result?.payload).toEqual(payload);
    expect(result.current.quality.result?.runId).toBe("run-2");
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

  it("maps domain-owned language aggregates, skip reasons, definitions, and labels", () => {
    type DomainSummary = { readonly aggregate: string };
    const domain = { id: "domain-version" };
    const data = mapSurveyResponseSummary(
      { domain, summary: { aggregate: "maker-summary" }, sourceLanguage: "ja" },
      {
        toFormSchema: () => schema,
        toSurveySummary: () => ({
          formId: schema.id,
          formVersion: schema.version,
          questions: [
            {
              fieldId: "satisfaction",
              kind: "radio",
              answeredCount: 1,
              unansweredCount: 0,
              options: [{ id: "good", count: 1, percentageOfSubmissions: 100 }]
            }
          ]
        }),
        mapLanguages: () => [{ language: "ja", submissionCount: 1, summary: { questions: [] } }],
        mapSkipReasons: () => [{ reason: "not-applicable", count: 2, language: "ja" }],
        resolveLabel: () => "満足度",
        getQuestionDefinition: () => ({ source: "maker" }),
        getOptionDefinition: ({ optionId }) => ({ source: "maker", optionId })
      }
    );

    expect(data.customData).toEqual({ aggregate: "maker-summary" } satisfies DomainSummary);
    expect(data.languages?.[0]?.language).toBe("ja");
    expect(data.skipReasons?.[0]?.reason).toBe("not-applicable");
    expect(data.questions[0]).toEqual(
      expect.objectContaining({
        label: "満足度",
        definition: { source: "maker" },
        optionDefinitions: { good: { source: "maker", optionId: "good" } }
      })
    );
  });

  it("passes mapped domain summary data to the render slot without losing custom aggregates", () => {
    const header = vi.fn(() => null);
    const languageChange = vi.fn();
    const domain = { id: "domain-version" };

    render(
      <SurveyResponseSummaryCustomDomain
        version={domain}
        summary={{ aggregate: "maker-summary" }}
        sourceLanguage="ja"
        domainAdapter={{
          toFormSchema: () => schema,
          toSurveySummary: () => ({
            formId: schema.id,
            formVersion: schema.version,
            questions: []
          }),
          mapLanguages: () => [{ language: "ja", submissionCount: 1, summary: { questions: [] } }],
          mapSkipReasons: () => [{ reason: "skipped", count: 1 }]
        }}
        slots={{
          renderHeader: header,
          renderLanguageTabs: (props) => {
            languageChange(props);
            return null;
          }
        }}
        onSourceLanguageChange={vi.fn()}
      />
    );

    expect(header).toHaveBeenCalledWith(
      expect.objectContaining({
        customData: { aggregate: "maker-summary" },
        languages: expect.any(Array),
        skipReasons: expect.any(Array)
      })
    );
    expect(languageChange).toHaveBeenCalledWith(
      expect.objectContaining({ activeLanguage: "ja", languages: expect.any(Array) })
    );
  });

  it("supports the domain-first response summary contract and language-specific aggregates", async () => {
    const summary = { aggregate: "maker-summary" };
    const japaneseSummary = {
      formId: schema.id,
      formVersion: schema.version,
      questions: [
        {
          fieldId: "satisfaction",
          kind: "radio" as const,
          answeredCount: 3,
          unansweredCount: 0,
          options: [{ id: "good", count: 3, percentageOfSubmissions: 100 }]
        }
      ]
    };
    const header = vi.fn(() => null);
    const adapter = {
      toSummaryInput: vi.fn(() => ({ questions: [] })),
      toFormSchema: vi.fn(() => schema),
      sourceLanguage: vi.fn(() => "en"),
      mapLanguages: vi.fn(() => [
        { language: "en", submissionCount: 1, summary: { questions: [] } },
        { language: "ja", submissionCount: 3, summary: japaneseSummary }
      ]),
      mapSkipReasons: () => [{ reason: "not-applicable", count: 2 }]
    };
    const { result } = renderHook(() =>
      useSurveyResponseSummaryDomain({
        summary,
        version: { id: "version" },
        domainAdapter: adapter,
        selectedLanguage: "ja",
        slots: { header }
      })
    );

    expect(result.current.data.customData).toBe(summary);
    expect(result.current.data.questions[0]?.answeredCount).toBe(3);
    expect(result.current.data.skipReasons).toEqual([{ reason: "not-applicable", count: 2 }]);
    expect(result.current.languageOptions).toEqual([
      { language: "en", count: 1 },
      { language: "ja", count: 3 }
    ]);

    render(
      <SurveyResponseSummaryDomain
        summary={summary}
        version={{ id: "version" }}
        domainAdapter={adapter}
        languageOptions={[{ language: "ja", count: 3 }]}
        selectedLanguage="ja"
        slots={{ header }}
      />
    );
    expect(header).toHaveBeenCalledWith(expect.objectContaining({ customData: summary }));
  });

  it("supports generic mapping CRUD with operation state and invalidation", async () => {
    const first = { id: "m1" };
    const second = { id: "m2" };
    const invalidate = vi.fn().mockResolvedValue(undefined);
    const adapter = {
      create: vi.fn().mockResolvedValue(second),
      remove: vi.fn().mockResolvedValue(undefined),
      reorder: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([first]),
      invalidate
    };
    const { result } = renderHook(() =>
      useSurveyMappingCrud<{ readonly id: string }, { readonly id: string }, { readonly deckId: string }>({
        domain: { id: "survey" },
        mappings: [],
        adapter
      })
    );

    await act(async () => {
      expect(await result.current.create({ deckId: "deck" })).toBe(true);
      expect(await result.current.reorder(second, 0)).toBe(true);
      expect(await result.current.remove(second)).toBe(true);
      expect(await result.current.refresh()).toBe(true);
    });

    expect(adapter.create).toHaveBeenCalledWith(expect.objectContaining({ selection: { deckId: "deck" } }));
    expect(result.current.mappings).toEqual([first]);
    expect(invalidate).toHaveBeenCalledTimes(3);
  });

  it("provides one translation scope to headless consumers and Form Engine UI", () => {
    const translation = { common: vi.fn(() => "Common label"), customSurvey: vi.fn(() => "Survey label") };
    function Consumer(): React.JSX.Element {
      const scope = useSurveyTranslation();
      return <span>{`${scope.common("save")}|${scope.customSurvey("title")}`}</span>;
    }

    render(
      <SurveyProvider translation={translation}>
        <Consumer />
      </SurveyProvider>
    );
    expect(screen.getByText("Common label|Survey label")).toBeInTheDocument();
  });

  it("renders controlled workflow state without imposing a package state shape", () => {
    const onToggle = vi.fn();
    const state = { makerStatus: "ready", tab: 2 };
    render(
      <SurveyWorkflowControlled
        state={state}
        expanded
        onToggle={onToggle}
        progress={{ value: 75, label: "Three quarters" }}
        steps={["draft", "review"]}
        renderStep={(step, current) => <span>{`${step}:${current.makerStatus}`}</span>}
      />
    );
    expect(screen.getByText("draft:ready")).toBeInTheDocument();
    act(() => screen.getByRole("button", { name: "Collapse" }).click());
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("keeps the original quality response and handles accept/reject in one controller", async () => {
    const issue = { code: "missing", message: "Missing", severity: "warning" as const };
    const response = { providerRun: "run-1", diagnostics: ["missing"] };
    const notify = vi.fn();
    const decide = vi.fn().mockResolvedValue({ succeeded: true, response: { accepted: true } });
    const version = { id: "v1" };
    const { result } = renderHook(() =>
      useSurveyQualityController({
        version,
        adapter: {
          run: vi.fn().mockResolvedValue({
            issues: [issue],
            response,
            rawResponse: response,
            runId: "run-1",
            checkedRevision: 7
          }),
          decide,
          notify
        }
      })
    );

    await act(async () => {
      await result.current.run();
      await result.current.accept(issue);
    });

    expect(result.current.quality.result?.rawResponse).toBe(response);
    expect(result.current.quality.issues).toEqual([issue]);
    expect(result.current.quality.checkStatus).toBe("failed");
    expect(result.current.quality.runId).toBe("run-1");
    expect(result.current.quality.checkedRevision).toBe(7);
    expect(result.current.decisions["missing:"]).toBe("accept");
    expect(decide).toHaveBeenCalledWith(expect.objectContaining({ result: expect.objectContaining({ response }) }));
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "decided" }));
  });

  it("supports controlled workflow state and tab callbacks", async () => {
    const onToggle = vi.fn();
    const onTabChange = vi.fn();
    const domain = { id: "survey" };
    const workflowState = { status: "idle" as const, completed: true, progressValue: 80, tabIndex: 2, expanded: true };
    const transition = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useSurveyWorkflow({
        domain,
        transitions: [{ id: "publish", label: "Publish" }],
        state: workflowState,
        onToggle,
        onTabChange,
        adapter: { transition }
      })
    );

    act(() => {
      result.current.toggle();
      result.current.setTab(3);
    });

    expect(result.current.state.completed).toBe(true);
    expect(result.current.progressValue).toBe(80);
    expect(result.current.expanded).toBe(true);
    expect(onToggle).toHaveBeenCalledWith(false);
    expect(onTabChange).toHaveBeenCalledWith(3);
    await act(async () => expect(await result.current.transition("publish")).toBe(true));
    expect(transition).toHaveBeenCalledWith(
      expect.objectContaining({ workflowState: expect.objectContaining(workflowState) })
    );
  });

  it("exposes mapping CRUD operations independently", async () => {
    const mappings = [{ id: "m1", sourceFieldId: "a", targetFieldId: "b" }];
    const adapter = {
      listMappings: vi.fn().mockResolvedValue(mappings),
      addMapping: vi.fn().mockResolvedValue(undefined),
      removeMapping: vi.fn().mockResolvedValue(undefined),
      reorderMappings: vi.fn().mockResolvedValue(undefined)
    };
    const domain = { id: "survey" };
    const initialMappings = mappings.slice(0, 0);
    const selection = { deckId: "deck-1", groupId: "group-1" };
    const { result } = renderHook(() => useSurveyMapping({ domain, mappings: initialMappings, selection, adapter }));

    await act(async () => {
      await result.current.refresh();
      await result.current.add({ id: "m2", sourceFieldId: "c", targetFieldId: "d" });
      await result.current.remove("m1");
      await result.current.reorder([]);
    });

    expect(adapter.listMappings).toHaveBeenCalledWith(expect.objectContaining({ selection }));
    expect(adapter.addMapping).toHaveBeenCalledWith(
      expect.objectContaining({ mapping: expect.objectContaining({ id: "m2" }), selection })
    );
    expect(adapter.removeMapping).toHaveBeenCalledWith(expect.objectContaining({ mappingId: "m1", selection }));
    expect(adapter.reorderMappings).toHaveBeenCalledWith(expect.objectContaining({ mappings: [], selection }));
    expect(result.current.state.operation).toBe("reorder");
  });

  it("reports an explicit error when a mapping CRUD operation is not provided", async () => {
    const domain = { id: "survey" };
    const mappings = [] as const;
    const { result } = renderHook(() =>
      useSurveyMapping({
        domain,
        mappings,
        adapter: {}
      })
    );

    await act(async () =>
      expect(await result.current.add({ id: "m1", sourceFieldId: "a", targetFieldId: "b" })).toBe(false)
    );

    expect(result.current.mappings).toEqual([]);
    expect(result.current.state).toEqual(expect.objectContaining({ status: "error", operation: "add" }));
  });
});
