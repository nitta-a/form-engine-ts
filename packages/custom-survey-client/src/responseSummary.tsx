import { type FormField, type FormSchema, type FormVersionRecord, resolveLocalizedSchema } from "@form-engine-ts/core";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { mapSurveyResponseSummary } from "./response/summaryMapper";
import type {
  SurveyResponseSummaryComponentProps,
  SurveyResponseSummaryCustomDomainComponentProps,
  SurveyResponseSummaryData,
  SurveyResponseSummaryDomainComponentProps,
  SurveyResponseSummaryDomainInputProps,
  SurveyResponseSummaryDomainLabels,
  SurveyResponseSummaryDomainSlots,
  SurveyResponseSummaryQuestion,
  SurveySummaryInput,
  UseSurveyResponseSummaryDomainOptions,
  UseSurveyResponseSummaryDomainResult
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

const defaultSummaryLabels: Required<SurveyResponseSummaryDomainLabels> = {
  languages: "Languages",
  answered: "Answered",
  unanswered: "Unanswered"
};

function defaultQuestion(
  question: SurveyResponseSummaryQuestion,
  labels: Pick<Required<SurveyResponseSummaryDomainLabels>, "answered" | "unanswered"> = defaultSummaryLabels
): React.JSX.Element {
  return (
    <article>
      <h3>{question.label}</h3>
      <p>
        {labels.answered}: {question.answeredCount} · {labels.unanswered}: {question.unansweredCount}
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
  onSourceLanguageChange,
  renderQuestion,
  slots,
  className
}: SurveyResponseSummaryComponentProps): React.JSX.Element {
  const data = toSurveyResponseSummary(summary, version, sourceLanguage);
  return renderSummaryData(data, renderQuestion, slots, className, onSourceLanguageChange);
}

function renderSummaryData(
  data: SurveyResponseSummaryData,
  renderQuestion: SurveyResponseSummaryComponentProps["renderQuestion"],
  slots: SurveyResponseSummaryComponentProps["slots"],
  className: string | undefined,
  onSourceLanguageChange: SurveyResponseSummaryComponentProps["onSourceLanguageChange"],
  labels?: SurveyResponseSummaryDomainLabels,
  _languageLabel?: (language: string) => ReactNode
): React.JSX.Element {
  const questionRenderer = renderQuestion ?? slots?.renderQuestion;
  const resolvedLabels = { ...defaultSummaryLabels, ...labels };
  return (
    <section className={className} data-form-id={data.formId} data-version={data.version}>
      {slots?.renderHeader?.(data) ?? slots?.header?.(data) ?? <h2>{data.title}</h2>}
      {data.languages === undefined || data.languages.length === 0 || slots?.renderLanguageTabs === undefined
        ? null
        : slots.renderLanguageTabs({
            languages: data.languages,
            activeLanguage: data.sourceLanguage,
            onChange: onSourceLanguageChange ?? (() => undefined)
          })}
      <div>
        {data.questions.map((question) => (
          <div key={question.fieldId}>{questionRenderer?.(question) ?? defaultQuestion(question, resolvedLabels)}</div>
        ))}
      </div>
    </section>
  );
}

function domainSummaryData<TSummary, TVersion>(
  options: UseSurveyResponseSummaryDomainOptions<TSummary, TVersion>,
  selectedLanguage: string | null
): {
  readonly data: SurveyResponseSummaryData<TSummary, unknown>;
  readonly languageOptions: readonly { language: string; count: number }[];
} {
  const { domainAdapter, summary, version } = options;
  const languages = domainAdapter.mapLanguages?.({ domain: version, summary });
  const sourceLanguage = selectedLanguage ?? domainAdapter.sourceLanguage(version);
  const selectedAggregate = languages?.find((language) => language.language === sourceLanguage);
  const baseData = toSurveyResponseSummary(
    selectedAggregate === undefined ? domainAdapter.toSummaryInput(summary) : selectedAggregate.summary,
    domainAdapter.toFormSchema(version),
    sourceLanguage
  );
  const languageOptions =
    options.languageOptions ??
    languages?.map(({ language, submissionCount }) => ({ language, count: submissionCount })) ??
    [];
  const questions = baseData.questions.map((question) => {
    const label = domainAdapter.resolveLabel?.({ domain: version, fieldId: question.fieldId, sourceLanguage });
    const definition = domainAdapter.getQuestionDefinition?.({ domain: version, fieldId: question.fieldId });
    const optionDefinitions = Object.fromEntries(
      (question.options ?? []).flatMap((option) => {
        const optionDefinition = domainAdapter.getOptionDefinition?.({
          domain: version,
          fieldId: question.fieldId,
          optionId: option.id
        });
        return optionDefinition === undefined ? [] : [[option.id, optionDefinition]];
      })
    );
    return {
      ...question,
      ...(label === undefined ? {} : { label }),
      ...(definition === undefined ? {} : { definition }),
      ...(Object.keys(optionDefinitions).length === 0 ? {} : { optionDefinitions })
    };
  });
  return {
    data: {
      ...baseData,
      customData: summary,
      questions,
      ...(languages === undefined ? {} : { languages }),
      ...(domainAdapter.mapSkipReasons === undefined
        ? {}
        : (() => {
            const skipReasons = domainAdapter.mapSkipReasons({ domain: version, summary });
            return skipReasons === undefined ? {} : { skipReasons };
          })())
    },
    languageOptions
  };
}

function renderDomainSummaryData(
  data: SurveyResponseSummaryData<unknown, unknown>,
  languageOptions: readonly { readonly language: string; readonly count: number }[],
  selectedLanguage: string | null,
  onLanguageChange: (language: string | null) => void,
  slots: SurveyResponseSummaryDomainSlots,
  className: string | undefined,
  labels: SurveyResponseSummaryDomainLabels | undefined,
  languageLabel: ((language: string) => ReactNode) | undefined
): React.JSX.Element {
  const resolvedLabels = { ...defaultSummaryLabels, ...labels };
  const languageAggregates =
    data.languages ??
    languageOptions.map(({ language, count }) => ({ language, submissionCount: count, summary: { questions: [] } }));
  return (
    <section className={className} data-form-id={data.formId} data-version={data.version}>
      {slots.header?.(data) ?? slots.renderHeader?.(data) ?? <h2>{data.title}</h2>}
      {languageOptions.length === 0
        ? null
        : ((slots.languageTabs ?? slots.renderLanguageTabs)?.({
            languages: languageAggregates,
            activeLanguage: selectedLanguage ?? data.sourceLanguage,
            onChange: (language) => onLanguageChange(language)
          }) ?? (
            <div role="tablist" aria-label={resolvedLabels.languages}>
              {languageOptions.map(({ language, count }) => {
                const active = (selectedLanguage ?? data.sourceLanguage) === language;
                return (
                  <button
                    key={language}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => onLanguageChange(language)}
                  >
                    {languageLabel?.(language) ?? language} ({count})
                  </button>
                );
              })}
            </div>
          ))}
      {slots.skipReasons?.(data.skipReasons ?? [])}
      <div>
        {data.questions.map((question) => (
          <div key={question.fieldId}>{slots.question?.(question) ?? defaultQuestion(question, resolvedLabels)}</div>
        ))}
      </div>
    </section>
  );
}

export function useSurveyResponseSummaryDomain<TSummary, TVersion>(
  options: UseSurveyResponseSummaryDomainOptions<TSummary, TVersion>
): UseSurveyResponseSummaryDomainResult<TSummary, TVersion> {
  const [internalLanguage, setInternalLanguage] = useState<string | null>(null);
  const selectedLanguage = options.selectedLanguage === undefined ? internalLanguage : options.selectedLanguage;
  const setLanguage = useCallback(
    (language: string | null) => {
      if (options.selectedLanguage === undefined) setInternalLanguage(language);
      options.onLanguageChange?.(language);
    },
    [options.onLanguageChange, options.selectedLanguage]
  );
  const mapped = useMemo(() => domainSummaryData(options, selectedLanguage), [options, selectedLanguage]);
  return {
    data: mapped.data,
    summary: options.summary,
    version: options.version,
    selectedLanguage,
    languageOptions: mapped.languageOptions,
    setLanguage
  };
}

/** Domain-record summary component with typed application-owned aggregate data. */
function SurveyResponseSummaryDomainView<TSummary, TVersion>(
  props: SurveyResponseSummaryDomainInputProps<TSummary, TVersion>
): React.JSX.Element {
  const controller = useSurveyResponseSummaryDomain(props);
  return renderDomainSummaryData(
    controller.data,
    controller.languageOptions,
    controller.selectedLanguage,
    controller.setLanguage,
    props.slots ?? {},
    props.className,
    props.labels,
    props.languageLabel
  );
}

function SurveyResponseSummaryLegacyDomainView<TDomain>(
  props: SurveyResponseSummaryDomainComponentProps<TDomain>
): React.JSX.Element {
  const {
    summary,
    version,
    domainAdapter,
    sourceLanguage,
    onSourceLanguageChange,
    renderQuestion,
    slots,
    className,
    labels,
    languageLabel
  } = props;
  const data = toSurveyResponseSummary(summary, domainAdapter.toFormSchema(version), sourceLanguage);
  return renderSummaryData(data, renderQuestion, slots, className, onSourceLanguageChange, labels, languageLabel);
}

function isDomainSummaryProps<TSummary, TVersion>(
  props: SurveyResponseSummaryDomainInputProps<TSummary, TVersion> | SurveyResponseSummaryDomainComponentProps<TVersion>
): props is SurveyResponseSummaryDomainInputProps<TSummary, TVersion> {
  return "toSummaryInput" in props.domainAdapter;
}

export function SurveyResponseSummaryDomain<TSummary, TVersion>(
  props: SurveyResponseSummaryDomainInputProps<TSummary, TVersion>
): React.JSX.Element;
export function SurveyResponseSummaryDomain<TDomain>(
  props: SurveyResponseSummaryDomainComponentProps<TDomain>
): React.JSX.Element;
export function SurveyResponseSummaryDomain<TSummary, TVersion>(
  props: SurveyResponseSummaryDomainInputProps<TSummary, TVersion> | SurveyResponseSummaryDomainComponentProps<TVersion>
): React.JSX.Element {
  if (isDomainSummaryProps(props)) {
    return <SurveyResponseSummaryDomainView {...props} />;
  }
  return <SurveyResponseSummaryLegacyDomainView {...props} />;
}

/** Domain summary variant for application-owned aggregates and render metadata. */
export function SurveyResponseSummaryCustomDomain<TDomain, TDomainSummary>(
  props: SurveyResponseSummaryCustomDomainComponentProps<TDomain, TDomainSummary>
): React.JSX.Element {
  const { domainAdapter, version, summary, sourceLanguage, onSourceLanguageChange, renderQuestion, slots, className } =
    props;
  const data = mapSurveyResponseSummary({ domain: version, summary, sourceLanguage }, domainAdapter);
  return renderSummaryData(data, renderQuestion, slots, className, onSourceLanguageChange);
}
