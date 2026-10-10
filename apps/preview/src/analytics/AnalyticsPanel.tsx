import {
  analyzeInteractionAnalytics,
  calculateCrossTabulation,
  calculateFieldVisibility,
  compareInteractionAnalytics,
  dispatchWebhook,
  type FormEvent,
  resolveLocalizedSchema,
  type SelectField
} from "@form-engine-ts/core";
import { mockTranslator } from "@form-engine-ts/translator-mock";
import { useMemo, useState } from "react";
import { ResetResponsesControl } from "../respondent/ResetResponsesControl";
import { usePreviewWorkspace } from "../workspace/PreviewWorkspaceContext";
import { AnalyticsDetails } from "./AnalyticsDetails";
import { ResponseInbox } from "./ResponseInbox";

const englishLabels = {
  eyebrow: "CUSTOMER FEEDBACK",
  intro: "Understand the experience, read each response, and find what to improve.",
  averageRating: "Average rating",
  noRating: "Add a rating question to measure satisfaction.",
  comments: "Written feedback",
  commentsNote: "Responses with at least one written comment",
  questionCount: "Survey questions",
  interaction: "Interaction Analytics",
  viewed: "Viewed",
  started: "Started",
  submitted: "Submitted",
  abandoned: "Abandoned",
  pages: "Pages",
  page: "Page",
  completed: "Completed",
  completion: "Completion",
  questions: "Questions",
  field: "Field",
  presented: "Presented",
  optimization: "Optimization Insights",
  noInsights: "No threshold breaches detected.",
  threshold: "threshold",
  comparison: "Version Comparison API Fixture",
  before: "Before",
  after: "After",
  delta: "Delta",
  percentagePoints: "percentage points",
  emptyTitle: "Your customer insights start here",
  emptyHelp: "Submit a test response in Answer preview, then return here to review the results.",
  technical: "Advanced analytics & demo tools",
  technicalNote:
    "Interaction metrics describe this browser session. The version comparison and webhook below use simulated data."
};

const japaneseLabels: typeof englishLabels = {
  eyebrow: "お客様の声",
  intro: "満足度と個別の回答を確認し、サービス改善につなげましょう。",
  averageRating: "平均評価",
  noRating: "評価の質問を追加すると満足度を確認できます。",
  comments: "自由記述のある回答",
  commentsNote: "1つ以上のコメントを記入した回答数",
  questionCount: "アンケートの質問数",
  interaction: "回答中の操作の集計",
  viewed: "閲覧",
  started: "回答開始",
  submitted: "送信完了",
  abandoned: "離脱",
  pages: "ページ",
  page: "ページ",
  completed: "完了",
  completion: "完了率",
  questions: "質問",
  field: "質問",
  presented: "表示",
  optimization: "改善指標",
  noInsights: "設定した基準を超えた指標はありません。",
  threshold: "基準値",
  comparison: "バージョン比較APIの動作例",
  before: "比較前",
  after: "比較後",
  delta: "差分",
  percentagePoints: "ポイント",
  emptyTitle: "お客様の声を集めましょう",
  emptyHelp: "回答プレビューでテスト回答を送信してから、ここで集計結果を確認してください。",
  technical: "詳細分析・デモ検証ツール",
  technicalNote: "操作の集計はこのブラウザーセッションが対象です。バージョン比較とWebhookは模擬データで確認できます。"
};

export function AnalyticsPanel() {
  const {
    analytics,
    interactionAnalytics,
    schema: sourceSchema,
    submissions,
    locale,
    downloadCsv,
    storage,
    isClearing,
    resetResponses
  } = usePreviewWorkspace();
  const schema = resolveLocalizedSchema(sourceSchema, locale);
  const labels = locale === "ja" ? japaneseLabels : englishLabels;
  const t = (key: string) => mockTranslator.translate(key, locale) ?? key;
  const textFields = schema.fields.filter((field) => field.type === "textarea");
  const singleChoiceFields = schema.fields.filter(
    (field): field is SelectField => field.type === "select" || field.type === "radio"
  );
  const ratingAggregate = analytics.questions.find((question) => question.kind === "rating");
  const ratingField = schema.fields.find((field) => field.id === ratingAggregate?.fieldId);
  const averageRating = ratingAggregate?.kind === "rating" ? ratingAggregate.average : null;
  const commentCount = submissions.filter((submission) => {
    const visibility = calculateFieldVisibility(schema, submission.values);
    return textFields.some((field) => {
      const value = submission.values[field.id];
      return visibility[field.id] === true && typeof value === "string" && value.trim() !== "";
    });
  }).length;
  const [rowQuestionId, setRowQuestionId] = useState(singleChoiceFields[0]?.id ?? "");
  const [colQuestionId, setColQuestionId] = useState(singleChoiceFields[1]?.id ?? "");
  const [webhookUrl, setWebhookUrl] = useState("https://example.test/form-engine-webhook");
  const [webhookStatus, setWebhookStatus] = useState<string | null>(null);
  const effectiveRowId = singleChoiceFields.some((field) => field.id === rowQuestionId)
    ? rowQuestionId
    : (singleChoiceFields[0]?.id ?? "");
  const effectiveColId = singleChoiceFields.some((field) => field.id === colQuestionId)
    ? colQuestionId
    : (singleChoiceFields[1]?.id ?? singleChoiceFields[0]?.id ?? "");
  const crossTab = useMemo(
    () => calculateCrossTabulation(submissions, effectiveRowId, effectiveColId),
    [effectiveColId, effectiveRowId, submissions]
  );
  const rowField = singleChoiceFields.find((field) => field.id === effectiveRowId);
  const colField = singleChoiceFields.find((field) => field.id === effectiveColId);
  const optimizationReport = useMemo(
    () =>
      analyzeInteractionAnalytics(interactionAnalytics, {
        minimumSamples: { form: 1, page: 1, field: 1 }
      }),
    [interactionAnalytics]
  );
  const comparisonFixture = useMemo(
    () =>
      compareInteractionAnalytics(interactionAnalytics, {
        ...interactionAnalytics,
        formVersion: interactionAnalytics.formVersion + 1
      }),
    [interactionAnalytics]
  );

  const simulateWebhook = async () => {
    const event: FormEvent = {
      id: globalThis.crypto.randomUUID(),
      type: "response.submitted",
      formId: schema.id,
      timestamp: new Date().toISOString(),
      payload: { submissionCount: submissions.length }
    };
    const result = await dispatchWebhook(event, { url: webhookUrl }, async () => new Response(null, { status: 202 }));
    setWebhookStatus(result.success ? t("preview.webhookSuccess") : (result.error ?? t("preview.webhookError")));
  };

  return (
    <section className="workspace-card analytics-card" aria-labelledby="analytics-heading">
      <div className="analytics-heading">
        <div>
          <span className="eyebrow">{labels.eyebrow}</span>
          <h2 id="analytics-heading">{t("preview.analytics")}</h2>
          <p className="analytics-intro">{labels.intro}</p>
        </div>
        <div className="response-count">
          <strong>{analytics.submissionCount}</strong>
          <span>{t("preview.responses")}</span>
        </div>
      </div>
      <div className="dashboard-actions">
        <button className="primary-action" type="button" onClick={() => void downloadCsv()}>
          {t("preview.export")}
        </button>
      </div>
      <dl className="analytics-summary">
        <div className="analytics-summary-card">
          <dt>{labels.averageRating}</dt>
          <dd>{averageRating == null ? "—" : averageRating.toFixed(1)}</dd>
          <small>{ratingField?.title ?? labels.noRating}</small>
        </div>
        <div className="analytics-summary-card">
          <dt>{labels.comments}</dt>
          <dd>{commentCount}</dd>
          <small>{labels.commentsNote}</small>
        </div>
        <div className="analytics-summary-card">
          <dt>{labels.questionCount}</dt>
          <dd>{schema.fields.length}</dd>
          <small>{schema.title}</small>
        </div>
      </dl>
      {analytics.submissionCount === 0 ? (
        <div className="empty-state">
          <h3>{labels.emptyTitle}</h3>
          <p>{t("preview.noResponses")}</p>
          <p>{labels.emptyHelp}</p>
        </div>
      ) : (
        <div className="analytics-grid">
          <div className="question-results">
            {analytics.questions.map((aggregate) => {
              const field = schema.fields.find((item) => item.id === aggregate.fieldId);
              return (
                <section className="question-result" key={aggregate.fieldId}>
                  <h3>{field === undefined ? aggregate.fieldId : field.title}</h3>
                  <p className="answer-counts">
                    {t("preview.answered")}: {aggregate.answeredCount} · {t("preview.unanswered")}:{" "}
                    {aggregate.unansweredCount}
                  </p>
                  <AnalyticsDetails aggregate={aggregate} schema={schema} locale={locale} />
                </section>
              );
            })}
          </div>
          <section className="free-text">
            <h3>{t("preview.freeText")}</h3>
            {textFields.map((field) => {
              const answers = submissions.flatMap((submission) => {
                if (calculateFieldVisibility(schema, submission.values)[field.id] !== true) return [];
                const value = submission.values[field.id];
                return typeof value === "string" && value.trim().length > 0 ? [{ id: submission.id, value }] : [];
              });
              return answers.length === 0 ? null : (
                <div key={field.id}>
                  <h4>{field.title}</h4>
                  <ul>
                    {answers.map((answer) => (
                      <li key={`${field.id}-${answer.id}`}>{answer.value}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </section>
        </div>
      )}
      <ResponseInbox schema={schema} submissions={submissions} locale={locale} />
      <section className="analytics-tool" aria-labelledby="cross-tab-heading">
        <h3 id="cross-tab-heading">{t("preview.crossTab")}</h3>
        <div className="analytics-tool-controls">
          <label>
            {t("preview.rowQuestion")}
            <select value={effectiveRowId} onChange={(event) => setRowQuestionId(event.currentTarget.value)}>
              {singleChoiceFields.map((field) => (
                <option key={field.id} value={field.id}>
                  {field.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("preview.colQuestion")}
            <select value={effectiveColId} onChange={(event) => setColQuestionId(event.currentTarget.value)}>
              {singleChoiceFields.map((field) => (
                <option key={field.id} value={field.id}>
                  {field.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        {rowField === undefined || colField === undefined ? null : (
          <div className="cross-tab-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">{rowField.title}</th>
                  {colField.options.map((option) => (
                    <th scope="col" key={option.id}>
                      {option.label}
                    </th>
                  ))}
                  <th scope="col">{t("preview.total")}</th>
                </tr>
              </thead>
              <tbody>
                {rowField.options.map((rowOption) => (
                  <tr key={rowOption.id}>
                    <th scope="row">{rowOption.label}</th>
                    {colField.options.map((colOption) => (
                      <td key={colOption.id}>{crossTab.matrix[rowOption.id]?.[colOption.id] ?? 0}</td>
                    ))}
                    <td>{crossTab.rowTotals[rowOption.id] ?? 0}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">{t("preview.total")}</th>
                  {colField.options.map((option) => (
                    <td key={option.id}>{crossTab.colTotals[option.id] ?? 0}</td>
                  ))}
                  <td>{crossTab.grandTotal}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
      <details className="preview-technical-details">
        <summary>{labels.technical}</summary>
        <p>{labels.technicalNote}</p>
        <section className="analytics-tool" aria-labelledby="interaction-analytics-heading">
          <h3 id="interaction-analytics-heading">{labels.interaction}</h3>
          <dl className="metric-grid">
            <div>
              <dt>{labels.viewed}</dt>
              <dd>{interactionAnalytics.funnel.viewedCount}</dd>
            </div>
            <div>
              <dt>{labels.started}</dt>
              <dd>{interactionAnalytics.funnel.startedCount}</dd>
            </div>
            <div>
              <dt>{labels.submitted}</dt>
              <dd>{interactionAnalytics.funnel.submittedCount}</dd>
            </div>
            <div>
              <dt>{labels.abandoned}</dt>
              <dd>{interactionAnalytics.funnel.abandonedCount}</dd>
            </div>
          </dl>
          {interactionAnalytics.pages.length === 0 ? null : (
            <table>
              <caption>{labels.pages}</caption>
              <thead>
                <tr>
                  <th scope="col">{labels.page}</th>
                  <th scope="col">{labels.viewed}</th>
                  <th scope="col">{labels.completed}</th>
                  <th scope="col">{labels.completion}</th>
                </tr>
              </thead>
              <tbody>
                {interactionAnalytics.pages.map((page) => (
                  <tr key={page.pageId}>
                    <th scope="row">{schema.pages?.find((item) => item.id === page.pageId)?.title ?? page.pageId}</th>
                    <td>{page.viewedCount}</td>
                    <td>{page.completedCount}</td>
                    <td>{page.completionRate.toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {interactionAnalytics.fields.length === 0 ? null : (
            <table>
              <caption>{labels.questions}</caption>
              <thead>
                <tr>
                  <th scope="col">{labels.field}</th>
                  <th scope="col">{labels.presented}</th>
                  <th scope="col">{labels.completed}</th>
                  <th scope="col">{labels.completion}</th>
                </tr>
              </thead>
              <tbody>
                {interactionAnalytics.fields.map((field) => (
                  <tr key={field.fieldId}>
                    <th scope="row">
                      {schema.fields.find((item) => item.id === field.fieldId)?.title ?? field.fieldId}
                    </th>
                    <td>{field.presentedCount}</td>
                    <td>{field.completedCount}</td>
                    <td>{field.completionRate.toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="analytics-tool" aria-labelledby="optimization-insights-heading">
          <h3 id="optimization-insights-heading">{labels.optimization}</h3>
          {optimizationReport.insights.length === 0 ? (
            <p>{labels.noInsights}</p>
          ) : (
            <ul>
              {optimizationReport.insights.map((insight) => (
                <li key={insight.id}>
                  <code>{insight.targetId ?? "form"}</code> · {insight.type}: {insight.observedValue.toFixed(1)} (
                  {labels.threshold} {insight.threshold})
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="analytics-tool" aria-labelledby="interaction-comparison-heading">
          <h3 id="interaction-comparison-heading">{labels.comparison}</h3>
          <p>
            v{comparisonFixture.beforeVersion} → v{comparisonFixture.afterVersion}
          </p>
          <dl className="metric-grid">
            <div>
              <dt>{labels.before}</dt>
              <dd>{comparisonFixture.funnel.startRate.before.toFixed(1)}%</dd>
            </div>
            <div>
              <dt>{labels.after}</dt>
              <dd>{comparisonFixture.funnel.startRate.after.toFixed(1)}%</dd>
            </div>
            <div>
              <dt>{labels.delta}</dt>
              <dd>
                {comparisonFixture.funnel.startRate.deltaPercentagePoints.toFixed(1)} {labels.percentagePoints}
              </dd>
            </div>
          </dl>
        </section>
        <section className="analytics-tool" aria-labelledby="webhook-heading">
          <h3 id="webhook-heading">{t("preview.webhook")}</h3>
          <label>
            {t("preview.webhookUrl")}
            <input value={webhookUrl} onChange={(event) => setWebhookUrl(event.currentTarget.value)} />
          </label>
          <button type="button" onClick={() => void simulateWebhook()}>
            {t("preview.simulateWebhook")}
          </button>
          {webhookStatus === null ? null : <p role="status">{webhookStatus}</p>}
        </section>
        <ResetResponsesControl
          locale={locale}
          disabled={isClearing || storage.clearResponses === undefined}
          onReset={resetResponses}
        />
      </details>
    </section>
  );
}
