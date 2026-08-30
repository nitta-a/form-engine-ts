import { type FormField, type FormSchema, type FormVersionRecord, resolveLocalizedSchema } from "@form-engine-ts/core";
import type {
  SurveyResponseSummaryComponentProps,
  SurveyResponseSummaryData,
  SurveyResponseSummaryQuestion,
  SurveySummaryInput
} from "./types";

function schemaFor(version: FormVersionRecord | FormSchema): FormSchema {
  return "schema" in version ? version.schema : version;
}

function labelFor(field: FormField, schema: FormSchema, sourceLanguage: string): string {
  const localized = resolveLocalizedSchema(schema, sourceLanguage);
  return localized.fields.find((candidate) => candidate.id === field.id)?.title ?? field.title;
}

function questionData(
  aggregate: SurveySummaryInput["questions"][number],
  field: FormField,
  schema: FormSchema,
  sourceLanguage: string
): SurveyResponseSummaryQuestion {
  const base = {
    fieldId: aggregate.fieldId,
    label: labelFor(field, schema, sourceLanguage),
    kind: aggregate.kind,
    answeredCount: aggregate.answeredCount,
    unansweredCount: aggregate.unansweredCount
  };
  if (aggregate.kind === "select" || aggregate.kind === "radio" || aggregate.kind === "multi-select") {
    const localized = resolveLocalizedSchema(schema, sourceLanguage);
    const localizedField = localized.fields.find((candidate) => candidate.id === aggregate.fieldId);
    const options = "options" in field ? field.options : [];
    const localizedOptions = localizedField !== undefined && "options" in localizedField ? localizedField.options : [];
    return {
      ...base,
      options: aggregate.options.map((option) => ({
        ...option,
        label:
          localizedOptions.find((candidate) => candidate.id === option.id)?.label ??
          options.find((candidate) => candidate.id === option.id)?.label ??
          option.id,
        percentage: option.percentageOfSubmissions
      }))
    };
  }
  if (aggregate.kind === "number" || aggregate.kind === "rating") {
    return {
      ...base,
      statistics: {
        average: aggregate.average,
        minimum: aggregate.minimum,
        maximum: aggregate.maximum,
        total: aggregate.total
      }
    };
  }
  if (aggregate.kind === "checkbox") {
    return {
      ...base,
      statistics: {
        trueCount: aggregate.trueCount,
        falseCount: aggregate.falseCount,
        truePercentage: aggregate.truePercentageOfSubmissions,
        falsePercentage: aggregate.falsePercentageOfSubmissions
      }
    };
  }
  return base;
}

/** Converts analytics/domain data into a stable, localized shape for survey UI clients. */
export function toSurveyResponseSummary(
  summary: SurveySummaryInput,
  version: FormVersionRecord | FormSchema,
  sourceLanguage: string
): SurveyResponseSummaryData {
  const schema = schemaFor(version);
  const localized = resolveLocalizedSchema(schema, sourceLanguage);
  const fields = new Map(schema.fields.map((field) => [field.id, field]));
  return {
    formId: summary.formId ?? schema.id,
    version: summary.formVersion ?? schema.version,
    sourceLanguage,
    title: localized.title,
    questions: summary.questions.flatMap((aggregate) => {
      const field = fields.get(aggregate.fieldId);
      return field === undefined ? [] : [questionData(aggregate, field, schema, sourceLanguage)];
    })
  };
}

function defaultQuestion(question: SurveyResponseSummaryQuestion): React.JSX.Element {
  return (
    <article>
      <h3>{question.label}</h3>
      <p>
        Answered: {question.answeredCount} · Unanswered: {question.unansweredCount}
      </p>
      {question.options === undefined ? null : (
        <ul>
          {question.options.map((option) => (
            <li key={option.id}>
              {option.label}: {option.count} ({option.percentage.toFixed(1)}%)
            </li>
          ))}
        </ul>
      )}
      {question.statistics === undefined ? null : (
        <dl>
          {Object.entries(question.statistics).map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{value ?? "—"}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}

export function SurveyResponseSummary({
  summary,
  version,
  sourceLanguage,
  renderQuestion,
  slots,
  className
}: SurveyResponseSummaryComponentProps): React.JSX.Element {
  const data = toSurveyResponseSummary(summary, version, sourceLanguage);
  const questionRenderer = renderQuestion ?? slots?.renderQuestion;
  return (
    <section className={className} data-form-id={data.formId} data-version={data.version}>
      {slots?.renderHeader?.(data) ?? <h2>{data.title}</h2>}
      <div>
        {data.questions.map((question) => (
          <div key={question.fieldId}>{questionRenderer?.(question) ?? defaultQuestion(question)}</div>
        ))}
      </div>
    </section>
  );
}
