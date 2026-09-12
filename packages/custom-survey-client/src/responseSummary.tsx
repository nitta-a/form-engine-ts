import { type FormSchema, type FormVersionRecord, toResponseSummary } from "@form-engine-ts/core";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mapSurveyResponseSummary } from "./response/summaryMapper";
import type {
  SurveyClientAsyncState,
  SurveyResponseSummaryComponentProps,
  SurveyResponseSummaryCustomDomainComponentProps,
  SurveyResponseSummaryData,
  SurveyResponseSummaryDomainComponentProps,
  SurveyResponseSummaryDomainInputProps,
  SurveyResponseSummaryDomainLabels,
  SurveyResponseSummaryDomainSlots,
  SurveyResponseSummaryLanguageOption,
  SurveyResponseSummaryQuestion,
  SurveyResponseSummaryTabOption,
  SurveyResponseSummaryTabSelection,
  SurveyResponseSummaryVariant,
  SurveySummaryInput,
  SurveySummaryLoader,
  UseSurveyResponseSummaryDomainOptions,
  UseSurveyResponseSummaryDomainResult
} from "./types";

function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/** Converts analytics/domain data into a stable, localized shape for survey UI clients. */
export function toSurveyResponseSummary(
  summary: SurveySummaryInput,
  version: FormVersionRecord | FormSchema,
  sourceLanguage: string
): SurveyResponseSummaryData {
  return toResponseSummary(summary, version, sourceLanguage);
}

const defaultSummaryLabels: Required<SurveyResponseSummaryDomainLabels> = {
  languages: "Languages",
  allLanguages: "All languages",
  answered: "Answered",
  unanswered: "Unanswered",
  skipReasons: "Skip reasons",
  options: "Options",
  statistics: "Statistics",
  average: "Average",
  minimum: "Minimum",
  maximum: "Maximum",
  total: "Total",
  checked: "Checked",
  unchecked: "Unchecked",
  percentage: "Percentage"
};

function formatCount(count: number, language: string): string {
  try {
    return new Intl.NumberFormat(language).format(count);
  } catch {
    return new Intl.NumberFormat().format(count);
  }
}

function formatNumber(value: number | null, language: string): string {
  if (value === null) return "—";
  try {
    return new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(value);
  } catch {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
  }
}

function formatPercentage(value: number, language: string): string {
  const percentage = clampPercentage(value);
  try {
    return new Intl.NumberFormat(language, { style: "percent", maximumFractionDigits: 1 }).format(percentage / 100);
  } catch {
    return new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 1 }).format(percentage / 100);
  }
}

function tabSelectionForLanguage(language: string): SurveyResponseSummaryTabSelection {
  return { scope: "language", language };
}

function isLanguageTabOption(
  option: SurveyResponseSummaryTabOption
): option is Extract<SurveyResponseSummaryTabOption, { readonly scope: "language" }> {
  return option.scope === "language";
}

function summarySubmissionCount(
  summary: SurveySummaryInput,
  languages: readonly { readonly submissionCount: number }[] | undefined,
  fallback: readonly SurveyResponseSummaryLanguageOption[]
): number {
  if ("submissionCount" in summary && typeof summary.submissionCount === "number") return summary.submissionCount;
  if (languages !== undefined) return languages.reduce((total, language) => total + language.submissionCount, 0);
  return fallback.reduce((total, language) => total + language.count, 0);
}

function skipReasonEntry(value: unknown): { readonly reason: string; readonly count: number } | undefined {
  if (typeof value !== "object" || value === null || !("reason" in value) || !("count" in value)) return undefined;
  return typeof value.reason === "string" && typeof value.count === "number" && Number.isFinite(value.count)
    ? { reason: value.reason, count: value.count }
    : undefined;
}

function defaultSkipReasons(reasons: readonly unknown[], label: string, language: string): React.JSX.Element | null {
  const entries = reasons.flatMap((reason) => {
    const entry = skipReasonEntry(reason);
    return entry === undefined ? [] : [entry];
  });
  if (entries.length === 0) return null;
  return (
    <section aria-label={label}>
      <h3>{label}</h3>
      <ul>
        {entries.map((entry) => (
          <li key={entry.reason}>
            {entry.reason}: {formatCount(entry.count, language)}
          </li>
        ))}
      </ul>
    </section>
  );
}

function richStatistic(label: string, value: number | null, locale: string, className: string): React.JSX.Element {
  return (
    <div className={className}>
      <dt>{label}</dt>
      <dd>{formatNumber(value, locale)}</dd>
    </div>
  );
}

function richQuestion(
  question: SurveyResponseSummaryQuestion,
  labels: Required<SurveyResponseSummaryDomainLabels>,
  locale: string
): React.JSX.Element {
  const statistics = question.statistics;
  return (
    <article className="form-engine-response-summary__question-card" data-question-kind={question.kind}>
      <h3>{question.label}</h3>
      <dl className="form-engine-response-summary__response-counts">
        <div>
          <dt>{labels.answered}</dt>
          <dd>{formatCount(question.answeredCount, locale)}</dd>
        </div>
        <div>
          <dt>{labels.unanswered}</dt>
          <dd>{formatCount(question.unansweredCount, locale)}</dd>
        </div>
      </dl>
      {question.options === undefined ? null : (
        <section aria-label={labels.options} className="form-engine-response-summary__option-section">
          <h4>{labels.options}</h4>
          <ul className="form-engine-response-summary__option-list">
            {question.options.map((option) => {
              const percentage = clampPercentage(option.percentage);
              const formattedPercentage = formatPercentage(percentage, locale);
              return (
                <li key={option.id} className="form-engine-response-summary__option">
                  <div className="form-engine-response-summary__option-label">
                    <span>{option.label}</span>
                    <span>
                      {formatCount(option.count, locale)} ({formattedPercentage})
                    </span>
                  </div>
                  <progress
                    max={100}
                    value={percentage}
                    aria-label={`${option.label}: ${labels.percentage} ${formattedPercentage}`}
                  >
                    {formattedPercentage}
                  </progress>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {statistics === undefined ? null : (
        <section aria-label={labels.statistics} className="form-engine-response-summary__statistics-section">
          <h4>{labels.statistics}</h4>
          {question.kind === "checkbox" ? (
            <dl className="form-engine-response-summary__statistics-cards">
              <div>
                <dt>{labels.checked}</dt>
                <dd>
                  {formatCount(statistics.trueCount ?? 0, locale)} (
                  {formatPercentage(statistics.truePercentage ?? 0, locale)})
                </dd>
              </div>
              <div>
                <dt>{labels.unchecked}</dt>
                <dd>
                  {formatCount(statistics.falseCount ?? 0, locale)} (
                  {formatPercentage(statistics.falsePercentage ?? 0, locale)})
                </dd>
              </div>
            </dl>
          ) : (
            <dl className="form-engine-response-summary__statistics-cards">
              {richStatistic(
                labels.average,
                statistics.average ?? null,
                locale,
                "form-engine-response-summary__statistic"
              )}
              {richStatistic(
                labels.minimum,
                statistics.minimum ?? null,
                locale,
                "form-engine-response-summary__statistic"
              )}
              {richStatistic(
                labels.maximum,
                statistics.maximum ?? null,
                locale,
                "form-engine-response-summary__statistic"
              )}
              {richStatistic(labels.total, statistics.total ?? null, locale, "form-engine-response-summary__statistic")}
            </dl>
          )}
        </section>
      )}
    </article>
  );
}

function richSkipReasons(reasons: readonly unknown[], label: string, locale: string): React.JSX.Element | null {
  const entries = reasons.flatMap((reason) => {
    const entry = skipReasonEntry(reason);
    return entry === undefined ? [] : [entry];
  });
  if (entries.length === 0) return null;
  return (
    <section aria-label={label} className="form-engine-response-summary__skip-reasons">
      <h3>{label}</h3>
      <ul>
        {entries.map((entry) => (
          <li key={entry.reason} className="form-engine-response-summary__skip-reason-card">
            <span>{entry.reason}</span>
            <strong>{formatCount(entry.count, locale)}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

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
  className,
  variant,
  locale,
  labels
}: SurveyResponseSummaryComponentProps): React.JSX.Element {
  const data = toSurveyResponseSummary(summary, version, sourceLanguage);
  return renderSummaryData(
    data,
    renderQuestion,
    slots,
    className,
    onSourceLanguageChange,
    labels,
    undefined,
    variant,
    locale
  );
}

function renderSummaryData(
  data: SurveyResponseSummaryData,
  renderQuestion: SurveyResponseSummaryComponentProps["renderQuestion"],
  slots: SurveyResponseSummaryComponentProps["slots"],
  className: string | undefined,
  onSourceLanguageChange: SurveyResponseSummaryComponentProps["onSourceLanguageChange"],
  labels?: SurveyResponseSummaryDomainLabels,
  _languageLabel?: (language: string) => ReactNode,
  variant: SurveyResponseSummaryVariant = "default",
  locale?: string
): React.JSX.Element {
  const questionRenderer = renderQuestion ?? slots?.renderQuestion;
  const resolvedLabels = { ...defaultSummaryLabels, ...labels };
  const displayLocale = locale ?? data.sourceLanguage;
  return (
    <section
      className={className}
      data-form-id={data.formId}
      data-version={data.version}
      data-summary-variant={variant}
    >
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
          <div key={question.fieldId} className="form-engine-response-summary__question">
            {questionRenderer?.(question) ??
              (variant === "rich"
                ? richQuestion(question, resolvedLabels, displayLocale)
                : defaultQuestion(question, resolvedLabels))}
          </div>
        ))}
      </div>
      {data.skipReasons === undefined || data.skipReasons.length === 0
        ? null
        : slots?.skipReasons === undefined
          ? variant === "rich"
            ? richSkipReasons(data.skipReasons, resolvedLabels.skipReasons, displayLocale)
            : defaultSkipReasons(data.skipReasons, resolvedLabels.skipReasons, displayLocale)
          : slots.skipReasons(data.skipReasons)}
    </section>
  );
}

function domainSummaryData<TSummary, TVersion>(
  options: UseSurveyResponseSummaryDomainOptions<TSummary, TVersion>,
  selectedTab: SurveyResponseSummaryTabSelection,
  activeSummary: TSummary
): {
  readonly data: SurveyResponseSummaryData<TSummary, unknown>;
  readonly languageOptions: readonly SurveyResponseSummaryLanguageOption[];
  readonly tabOptions: readonly SurveyResponseSummaryTabOption[];
} {
  const { domainAdapter, version } = options;
  const sourceLanguage = domainAdapter.sourceLanguage(version);
  const summary = activeSummary;
  const languages = domainAdapter.mapLanguages?.({ domain: version, summary });
  const overallLanguages =
    activeSummary === options.summary
      ? languages
      : domainAdapter.mapLanguages?.({ domain: version, summary: options.summary });
  const rawLanguageOptions: readonly SurveyResponseSummaryLanguageOption[] =
    options.tabOptions?.filter(isLanguageTabOption).map(({ language, count, label }) => ({ language, count, label })) ??
    options.languageOptions ??
    languages?.map(({ language, submissionCount }) => ({ language, count: submissionCount })) ??
    [];
  const activeLanguage = selectedTab.scope === "language" ? selectedTab.language : sourceLanguage;
  const overallSummaryInput = domainAdapter.toSummaryInput(options.summary);
  const selectedAggregate =
    selectedTab.scope === "language" ? languages?.find((language) => language.language === activeLanguage) : undefined;
  const summaryInput =
    selectedTab.scope === "all"
      ? overallSummaryInput
      : (selectedAggregate?.summary ??
        domainAdapter.toLanguageSummaryInput?.({ domain: version, summary, language: activeLanguage }) ??
        domainAdapter.toSummaryInput(summary));
  const baseData = toSurveyResponseSummary(summaryInput, domainAdapter.toFormSchema(version), activeLanguage);
  const resolvedLanguages =
    languages ??
    rawLanguageOptions.map(({ language, count }) => ({
      language,
      submissionCount: count,
      summary:
        domainAdapter.toLanguageSummaryInput?.({ domain: version, summary, language }) ??
        (selectedTab.scope === "language" && language === activeLanguage ? summaryInput : { questions: [] })
    }));
  const languageOptions: readonly SurveyResponseSummaryLanguageOption[] = rawLanguageOptions.map((option) => ({
    ...option,
    ...(option.label !== undefined
      ? {}
      : options.languageLabel === undefined
        ? {}
        : { label: options.languageLabel(option.language) })
  }));
  const allCount = summarySubmissionCount(overallSummaryInput, overallLanguages, languageOptions);
  const tabOptions: readonly SurveyResponseSummaryTabOption[] = options.tabOptions ?? [
    { scope: "all", count: allCount },
    ...languageOptions.map((option) => ({ scope: "language" as const, ...option }))
  ];
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
      ...(resolvedLanguages.length === 0 ? {} : { languages: resolvedLanguages }),
      ...(domainAdapter.mapSkipReasons === undefined
        ? {}
        : (() => {
            const skipReasons = domainAdapter.mapSkipReasons({
              domain: version,
              summary: selectedTab.scope === "all" ? options.summary : summary
            });
            return skipReasons === undefined ? {} : { skipReasons };
          })())
    },
    languageOptions,
    tabOptions
  };
}

function renderDomainSummaryData(
  data: SurveyResponseSummaryData<unknown, unknown>,
  languageOptions: readonly SurveyResponseSummaryLanguageOption[],
  tabOptions: readonly SurveyResponseSummaryTabOption[],
  selectedTab: SurveyResponseSummaryTabSelection,
  onTabChange: (tab: SurveyResponseSummaryTabSelection) => void,
  slots: SurveyResponseSummaryDomainSlots,
  className: string | undefined,
  labels: SurveyResponseSummaryDomainLabels | undefined,
  languageLabel: ((language: string) => ReactNode) | undefined,
  summaryState: { readonly status: "idle" | "loading" | "success" | "error"; readonly error?: Error },
  variant: SurveyResponseSummaryVariant = "default",
  locale?: string
): React.JSX.Element {
  const displayLocale = locale ?? data.sourceLanguage;
  const resolvedLabels = {
    ...defaultSummaryLabels,
    ...labels,
    allLanguages:
      labels?.allLanguages ?? (displayLocale.startsWith("ja") ? "全言語" : defaultSummaryLabels.allLanguages)
  };
  const languageAggregates =
    data.languages ??
    languageOptions.map(({ language, count }) => ({ language, submissionCount: count, summary: { questions: [] } }));
  return (
    <section
      className={className}
      data-form-id={data.formId}
      data-version={data.version}
      data-summary-variant={variant}
    >
      {slots.header?.(data) ?? slots.renderHeader?.(data) ?? <h2>{data.title}</h2>}
      {tabOptions.length === 0
        ? null
        : ((slots.summaryTabs ?? slots.renderSummaryTabs)?.({
            tabs: tabOptions,
            activeTab: selectedTab,
            onChange: onTabChange
          }) ??
          (slots.languageTabs ?? slots.renderLanguageTabs)?.({
            languages: languageAggregates,
            activeLanguage: selectedTab.scope === "language" ? selectedTab.language : data.sourceLanguage,
            onChange: (language) => onTabChange(tabSelectionForLanguage(language))
          }) ?? (
            <div role="tablist" aria-label={resolvedLabels.languages}>
              {tabOptions.map((tab) => {
                const active =
                  tab.scope === "all"
                    ? selectedTab.scope === "all"
                    : selectedTab.scope === "language" && selectedTab.language === tab.language;
                const label =
                  tab.scope === "all"
                    ? resolvedLabels.allLanguages
                    : (languageLabel?.(tab.language) ?? tab.label ?? tab.language);
                return (
                  <button
                    key={tab.scope === "all" ? "all" : tab.language}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() =>
                      onTabChange(tab.scope === "all" ? { scope: "all" } : tabSelectionForLanguage(tab.language))
                    }
                  >
                    {label} ({tab.count})
                  </button>
                );
              })}
            </div>
          ))}
      {summaryState.status === "loading" ? <p role="status">Loading summary…</p> : null}
      {summaryState.status === "error" ? (
        <p role="alert">{summaryState.error?.message ?? "Unable to load summary."}</p>
      ) : null}
      {summaryState.status === "loading" || summaryState.status === "error" ? null : (
        <>
          {data.skipReasons === undefined || data.skipReasons.length === 0
            ? null
            : slots.skipReasons === undefined
              ? variant === "rich"
                ? richSkipReasons(data.skipReasons, resolvedLabels.skipReasons, displayLocale)
                : defaultSkipReasons(data.skipReasons, resolvedLabels.skipReasons, displayLocale)
              : slots.skipReasons(data.skipReasons)}
          <div>
            {data.questions.map((question) => (
              <div key={question.fieldId} className="form-engine-response-summary__question">
                {slots.question?.(question) ??
                  (variant === "rich"
                    ? richQuestion(question, resolvedLabels, displayLocale)
                    : defaultQuestion(question, resolvedLabels))}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function summaryLoaderFunction<TSummary>(
  loader: SurveySummaryLoader<TSummary>["load"] | SurveySummaryLoader<TSummary> | undefined
): SurveySummaryLoader<TSummary>["load"] | undefined {
  if (loader === undefined) return undefined;
  return typeof loader === "function" ? loader : loader.load;
}

function normalizedError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

export function useSurveyResponseSummaryDomain<TSummary, TVersion>(
  options: UseSurveyResponseSummaryDomainOptions<TSummary, TVersion>
): UseSurveyResponseSummaryDomainResult<TSummary, TVersion> {
  const sourceLanguage = options.domainAdapter.sourceLanguage(options.version);
  const initialTab =
    options.defaultTab ??
    (options.defaultLanguage === undefined
      ? { scope: "all" as const }
      : tabSelectionForLanguage(options.defaultLanguage ?? sourceLanguage));
  const [internalTab, setInternalTab] = useState<SurveyResponseSummaryTabSelection>(initialTab);
  const selectedTab =
    options.selectedTab ??
    (options.selectedLanguage === undefined
      ? internalTab
      : tabSelectionForLanguage(options.selectedLanguage ?? sourceLanguage));
  const selectedLanguage =
    selectedTab.scope === "language"
      ? options.selectedLanguage !== undefined
        ? options.selectedLanguage
        : options.defaultLanguage === null && selectedTab.language === sourceLanguage
          ? null
          : selectedTab.language
      : null;
  const activeLanguage = selectedTab.scope === "language" ? selectedTab.language : sourceLanguage;
  const loader = summaryLoaderFunction(options.summaryLoader);
  const cacheRef = useRef<Map<string, TSummary>>(new Map([[activeLanguage, options.summary]]));
  const activeSummaryRef = useRef<{ readonly language: string; readonly summary: TSummary }>({
    language: activeLanguage,
    summary: options.summary
  });
  const [activeSummaryState, setActiveSummaryState] = useState(activeSummaryRef.current);
  const [summaryState, setSummaryState] = useState<SurveyClientAsyncState>(
    () => options.summaryState ?? { status: "idle" }
  );
  const requestRef = useRef(0);
  const controllerRef = useRef<AbortController | undefined>(undefined);
  const pendingRef = useRef<Map<string, Promise<TSummary | undefined>>>(new Map());
  const loadSummaryForLanguage = useCallback(
    async (language: string, force = false): Promise<TSummary | undefined> => {
      if (loader === undefined) return undefined;
      if (!force) {
        const cached = cacheRef.current.get(language);
        if (cached !== undefined) {
          const next = { language, summary: cached };
          activeSummaryRef.current = next;
          setActiveSummaryState(next);
          setSummaryState({ status: "success" });
          return cached;
        }
      }
      const pending = pendingRef.current.get(language);
      if (pending !== undefined && !force) return pending;
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      activeSummaryRef.current = { language, summary: activeSummaryRef.current.summary };
      setActiveSummaryState((current) => (current.language === language ? current : { ...current, language }));
      setSummaryState({ status: "loading" });
      const request = loader({ language, signal: controller.signal })
        .then((loaded) => {
          if (requestRef.current !== requestId || controller.signal.aborted) return undefined;
          cacheRef.current.set(language, loaded);
          const next = { language, summary: loaded };
          activeSummaryRef.current = next;
          setActiveSummaryState(next);
          setSummaryState({ status: "success" });
          return loaded;
        })
        .catch((cause: unknown) => {
          if (requestRef.current !== requestId || controller.signal.aborted) return undefined;
          setSummaryState({ status: "error", error: normalizedError(cause) });
          return undefined;
        })
        .finally(() => {
          if (pendingRef.current.get(language) === request) pendingRef.current.delete(language);
        });
      pendingRef.current.set(language, request);
      return request;
    },
    [loader]
  );
  const setTab = useCallback(
    (tab: SurveyResponseSummaryTabSelection) => {
      if (options.selectedTab === undefined && options.selectedLanguage === undefined) setInternalTab(tab);
      options.onTabChange?.(tab);
      if (tab.scope === "language") {
        options.onLanguageChange?.(tab.language);
        if (loader !== undefined) void loadSummaryForLanguage(tab.language);
        return;
      }
      controllerRef.current?.abort();
      requestRef.current += 1;
      activeSummaryRef.current = { language: sourceLanguage, summary: options.summary };
      setActiveSummaryState(activeSummaryRef.current);
      if (options.summaryState === undefined) setSummaryState({ status: "success" });
    },
    [
      loadSummaryForLanguage,
      loader,
      options.onLanguageChange,
      options.onTabChange,
      options.selectedLanguage,
      options.selectedTab,
      options.summaryState,
      options.summary,
      sourceLanguage
    ]
  );
  const setLanguage = useCallback(
    (language: string | null) => setTab(tabSelectionForLanguage(language ?? sourceLanguage)),
    [setTab, sourceLanguage]
  );
  useEffect(() => {
    if (loader === undefined || selectedTab.scope === "all" || activeSummaryRef.current.language === activeLanguage)
      return;
    void loadSummaryForLanguage(activeLanguage);
  }, [activeLanguage, loadSummaryForLanguage, loader, selectedTab.scope]);
  useEffect(
    () => () => {
      controllerRef.current?.abort();
    },
    []
  );
  const activeSummary =
    loader === undefined || selectedTab.scope === "all" || activeLanguage === sourceLanguage
      ? options.summary
      : activeSummaryState.language === activeLanguage
        ? activeSummaryState.summary
        : options.summary;
  const mapped = useMemo(
    () => domainSummaryData(options, selectedTab, activeSummary),
    [activeSummary, options, selectedTab]
  );
  const reloadSummary = useCallback(
    () => (selectedTab.scope === "all" ? Promise.resolve(undefined) : loadSummaryForLanguage(activeLanguage, true)),
    [activeLanguage, loadSummaryForLanguage, selectedTab.scope]
  );
  const effectiveSummaryState = options.summaryState ?? summaryState;
  return {
    data: mapped.data,
    summary: activeSummary,
    version: options.version,
    domainAdapter: options.domainAdapter,
    selectedLanguage,
    summaryState: effectiveSummaryState,
    summaryLoading: effectiveSummaryState.status === "loading",
    ...(effectiveSummaryState.error === undefined ? {} : { summaryError: effectiveSummaryState.error }),
    reloadSummary,
    languageOptions: mapped.languageOptions,
    tabOptions: mapped.tabOptions,
    ...(options.variant === undefined ? {} : { variant: options.variant }),
    ...(options.locale === undefined ? {} : { locale: options.locale }),
    ...(options.slots === undefined ? {} : { slots: options.slots }),
    ...(options.labels === undefined ? {} : { labels: options.labels }),
    ...(options.languageLabel === undefined ? {} : { languageLabel: options.languageLabel }),
    ...(options.className === undefined ? {} : { className: options.className }),
    onLanguageChange: setLanguage,
    setLanguage,
    selectedTab,
    onTabChange: setTab,
    setTab
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
    controller.tabOptions,
    controller.selectedTab,
    controller.setTab,
    props.slots ?? {},
    props.className,
    props.labels,
    props.languageLabel,
    props.summaryState ?? controller.summaryState,
    props.variant,
    props.locale
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
    languageLabel,
    variant,
    locale
  } = props;
  const data = toSurveyResponseSummary(summary, domainAdapter.toFormSchema(version), sourceLanguage);
  return renderSummaryData(
    data,
    renderQuestion,
    slots,
    className,
    onSourceLanguageChange,
    labels,
    languageLabel,
    variant,
    locale
  );
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
  const {
    domainAdapter,
    version,
    summary,
    sourceLanguage,
    onSourceLanguageChange,
    renderQuestion,
    slots,
    className,
    variant,
    locale,
    labels
  } = props;
  const data = mapSurveyResponseSummary({ domain: version, summary, sourceLanguage }, domainAdapter);
  return renderSummaryData(
    data,
    renderQuestion,
    slots,
    className,
    onSourceLanguageChange,
    labels,
    undefined,
    variant,
    locale
  );
}
