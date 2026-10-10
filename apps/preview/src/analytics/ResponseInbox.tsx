import {
  calculateFieldVisibility,
  type FormField,
  type FormSchema,
  type FormSubmission,
  type FormValue,
  isRadioTextAnswer,
  selectedOptionId
} from "@form-engine-ts/core";
import { useState } from "react";

const englishLabels = {
  title: "Individual responses",
  intro: "Search customer feedback and expand a response to see the full picture.",
  search: "Search responses",
  placeholder: "Search by answer or response ID",
  language: "Response language",
  allLanguages: "All languages",
  response: "Response",
  sample: "Sample data",
  id: "Response ID",
  yes: "Yes",
  no: "No",
  unanswered: "Not answered",
  noMatches: "No responses match your search.",
  noResponses: "Saved responses will appear here.",
  clear: "Clear filters",
  results: "matching responses"
};

const japaneseLabels: typeof englishLabels = {
  title: "回答一覧",
  intro: "お客様の声を検索し、回答を開いて詳細を確認できます。",
  search: "回答を検索",
  placeholder: "回答内容・回答IDで検索",
  language: "回答言語",
  allLanguages: "すべての言語",
  response: "回答",
  sample: "サンプルデータ",
  id: "回答ID",
  yes: "はい",
  no: "いいえ",
  unanswered: "未回答",
  noMatches: "条件に一致する回答はありません。",
  noResponses: "保存された回答がここに表示されます。",
  clear: "絞り込みを解除",
  results: "件の回答"
};

function formatAnswer(field: FormField, value: FormValue, labels: typeof englishLabels): string {
  if (value === undefined || value === "") return labels.unanswered;
  if (typeof value === "boolean") return value ? labels.yes : labels.no;
  if ("options" in field) {
    const optionLabel = (id: string) => field.options.find((option) => option.id === id)?.label ?? id;
    if (Array.isArray(value)) return value.map(optionLabel).join(", ") || labels.unanswered;
    const optionId = selectedOptionId(value);
    if (optionId !== undefined) {
      const label = optionLabel(optionId);
      return isRadioTextAnswer(value) && value.text !== "" ? `${label} — ${value.text}` : label;
    }
  }
  if (Array.isArray(value)) return value.join(", ");
  if (isRadioTextAnswer(value)) return value.text;
  return String(value);
}

interface ResponseInboxProps {
  readonly schema: FormSchema;
  readonly submissions: readonly FormSubmission[];
  readonly locale: string;
}

export function ResponseInbox({ schema, submissions, locale }: ResponseInboxProps) {
  const labels = locale === "ja" ? japaneseLabels : englishLabels;
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("");
  const languages = [
    ...new Set(submissions.map((submission) => submission.locale).filter((value) => value !== undefined))
  ];
  const query = search.trim().toLocaleLowerCase(locale);

  const toResponseEntry = (submission: FormSubmission, index: number) => {
    const visibility = calculateFieldVisibility(schema, submission.values);
    const answers = schema.fields
      .filter((field) => visibility[field.id] === true)
      .map((field) => ({
        id: field.id,
        title: field.title,
        value: formatAnswer(field, submission.values[field.id], labels)
      }));
    const searchableText = [submission.id, ...answers.map((answer) => `${answer.title} ${answer.value}`)]
      .join(" ")
      .toLocaleLowerCase(locale);
    return { submission, number: index + 1, answers, searchableText };
  };
  const entries = submissions
    .map(toResponseEntry)
    .filter(
      (entry) => (language === "" || entry.submission.locale === language) && entry.searchableText.includes(query)
    )
    .reverse();
  const hasFilters = search !== "" || language !== "";

  return (
    <section className="response-inbox" aria-labelledby="response-inbox-heading">
      <div className="response-inbox-heading">
        <h3 id="response-inbox-heading">{labels.title}</h3>
        <p>{labels.intro}</p>
      </div>
      <div className="response-search">
        <label>
          {labels.search}
          <input
            type="search"
            value={search}
            placeholder={labels.placeholder}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
        </label>
        <label>
          {labels.language}
          <select value={language} onChange={(event) => setLanguage(event.currentTarget.value)}>
            <option value="">{labels.allLanguages}</option>
            {languages.map((value) => (
              <option key={value} value={value}>
                {value.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        {hasFilters ? (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setLanguage("");
            }}
          >
            {labels.clear}
          </button>
        ) : null}
      </div>
      <p className="response-result-count" aria-live="polite">
        {entries.length} {labels.results}
      </p>
      {entries.length === 0 ? (
        <p className="empty-state">{submissions.length === 0 ? labels.noResponses : labels.noMatches}</p>
      ) : (
        <div className="response-list">
          {entries.map(({ submission, number, answers }) => (
            <details className="response-entry" key={submission.id}>
              <summary>
                <span className="response-entry-heading">
                  {labels.response} #{number}
                </span>
                <time dateTime={submission.submittedAt}>{new Date(submission.submittedAt).toLocaleString(locale)}</time>
                {submission.metadata?.source === "sample" ? (
                  <span className="response-sample-badge">{labels.sample}</span>
                ) : null}
              </summary>
              <dl className="response-details">
                <div>
                  <dt>{labels.id}</dt>
                  <dd>{submission.id}</dd>
                </div>
                {answers.map((answer) => (
                  <div key={answer.id}>
                    <dt>{answer.title}</dt>
                    <dd>{answer.value}</dd>
                  </div>
                ))}
              </dl>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
