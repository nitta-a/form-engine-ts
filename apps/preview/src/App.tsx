import {
  aggregateResponses,
  createSubmission,
  type FormAnalytics,
  type FormValues,
  type QuestionAggregate
} from "@form-engine/core";
import { FormProvider, FormRenderer } from "@form-engine/react";
import { MemoryStorageAdapter } from "@form-engine/storage-memory";
import { mockTranslator } from "@form-engine/translator-mock";
import { useCallback, useState } from "react";
import { customerFeedbackSchema } from "./schema";

const storage = new MemoryStorageAdapter();
const emptyAnalytics = aggregateResponses(customerFeedbackSchema, []);

function formatNumber(value: number | null): string {
  return value === null ? "—" : Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function AnalyticsDetails({ aggregate, locale }: { readonly aggregate: QuestionAggregate; readonly locale: string }) {
  const t = (key: string) => mockTranslator.translate(key, locale);
  if (aggregate.kind === "number") {
    return (
      <dl className="metric-grid">
        <div>
          <dt>{t("preview.minimum")}</dt>
          <dd>{formatNumber(aggregate.minimum)}</dd>
        </div>
        <div>
          <dt>{t("preview.maximum")}</dt>
          <dd>{formatNumber(aggregate.maximum)}</dd>
        </div>
        <div>
          <dt>{t("preview.average")}</dt>
          <dd>{formatNumber(aggregate.average)}</dd>
        </div>
      </dl>
    );
  }
  if (aggregate.kind === "checkbox") {
    return (
      <div className="option-bars">
        <OptionBar
          label={t("preview.true")}
          count={aggregate.trueCount}
          percentage={aggregate.truePercentageOfSubmissions}
        />
        <OptionBar
          label={t("preview.false")}
          count={aggregate.falseCount}
          percentage={aggregate.falsePercentageOfSubmissions}
        />
      </div>
    );
  }
  if (aggregate.kind === "select" || aggregate.kind === "radio" || aggregate.kind === "multi-select") {
    const field = customerFeedbackSchema.fields.find((item) => item.id === aggregate.fieldId);
    return (
      <div className="option-bars">
        {aggregate.options.map((option) => {
          const schemaOption =
            field !== undefined && "options" in field
              ? field.options.find((item) => item.value === option.value)
              : undefined;
          return (
            <OptionBar
              key={option.value}
              label={schemaOption === undefined ? option.value : t(schemaOption.labelKey)}
              count={option.count}
              percentage={option.percentageOfSubmissions}
            />
          );
        })}
      </div>
    );
  }
  return null;
}

function OptionBar({
  label,
  count,
  percentage
}: {
  readonly label: string;
  readonly count: number;
  readonly percentage: number;
}) {
  return (
    <div className="option-bar">
      <div>
        <span>{label}</span>
        <strong>
          {count} · {percentage.toFixed(0)}%
        </strong>
      </div>
      <div className="track">
        <span style={{ width: `${Math.min(percentage, 100)}%` }} />
      </div>
    </div>
  );
}

function AnalyticsPanel({ analytics, locale }: { readonly analytics: FormAnalytics; readonly locale: string }) {
  const t = (key: string) => mockTranslator.translate(key, locale);
  return (
    <aside className="analytics-card" aria-labelledby="analytics-heading">
      <div className="analytics-heading">
        <div>
          <span className="eyebrow">LIVE</span>
          <h2 id="analytics-heading">{t("preview.analytics")}</h2>
        </div>
        <div className="response-count">
          <strong>{analytics.submissionCount}</strong>
          <span>{t("preview.responses")}</span>
        </div>
      </div>
      {analytics.submissionCount === 0 ? (
        <p className="empty-state">{t("preview.noResponses")}</p>
      ) : (
        <div className="question-results">
          {analytics.questions.map((aggregate) => {
            const field = customerFeedbackSchema.fields.find((item) => item.id === aggregate.fieldId);
            return (
              <section className="question-result" key={aggregate.fieldId}>
                <h3>{field === undefined ? aggregate.fieldId : t(field.labelKey)}</h3>
                <p className="answer-counts">
                  {t("preview.answered")}: {aggregate.answeredCount} · {t("preview.unanswered")}:{" "}
                  {aggregate.unansweredCount}
                </p>
                <AnalyticsDetails aggregate={aggregate} locale={locale} />
              </section>
            );
          })}
        </div>
      )}
    </aside>
  );
}

export default function App() {
  const [locale, setLocale] = useState("en");
  const [analytics, setAnalytics] = useState<FormAnalytics>(emptyAnalytics);
  const submit = useCallback(
    async (values: FormValues) => {
      const submission = createSubmission(customerFeedbackSchema, values, {
        id: globalThis.crypto.randomUUID(),
        locale
      });
      await storage.saveSubmission(submission);
      const submissions = await storage.listSubmissions(customerFeedbackSchema.id, customerFeedbackSchema.version);
      setAnalytics(aggregateResponses(customerFeedbackSchema, submissions));
    },
    [locale]
  );
  const t = (key: string) => mockTranslator.translate(key, locale);

  return (
    <main>
      <nav className="topbar" aria-label={t("preview.language")}>
        <a className="brand" href="#form">
          <span>FORM</span> ENGINE
        </a>
        <div className="locale-switch">
          <span>{t("preview.language")}</span>
          <button type="button" aria-pressed={locale === "en"} onClick={() => setLocale("en")}>
            EN
          </button>
          <button type="button" aria-pressed={locale === "ja"} onClick={() => setLocale("ja")}>
            日本語
          </button>
        </div>
      </nav>
      <div className="page-grid">
        <section id="form" className="form-card">
          <FormProvider
            schema={customerFeedbackSchema}
            locale={locale}
            translator={mockTranslator}
            onSubmit={submit}
            resetOnSuccess
          >
            <FormRenderer successMessageKey="preview.success" errorMessageKey="preview.error" />
          </FormProvider>
        </section>
        <AnalyticsPanel analytics={analytics} locale={locale} />
      </div>
    </main>
  );
}
