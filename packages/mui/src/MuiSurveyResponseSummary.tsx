import {
  type SurveyClientAsyncState,
  type SurveyResponseSummaryData,
  type SurveyResponseSummaryDomainInputProps,
  type SurveyResponseSummaryDomainLabels,
  type SurveyResponseSummaryLanguageOption,
  type SurveyResponseSummaryQuestion,
  type SurveyResponseSummarySkipReason,
  useSurveyResponseSummaryDomain
} from "@form-engine-ts/custom-survey-client";
import {
  Alert,
  Box,
  Card,
  CardContent,
  type CardContentProps,
  type CardProps,
  LinearProgress,
  type LinearProgressProps,
  List,
  ListItem,
  type ListItemProps,
  type ListProps,
  Stack,
  type StackProps,
  Tab,
  type TabProps,
  Tabs,
  type TabsProps,
  Typography
} from "@mui/material";
import type { ReactNode } from "react";

type MuiSummaryDataAttributes = {
  readonly [key: `data-${string}`]: string | number | boolean | undefined;
};

type MuiSummaryCardProps = CardProps & MuiSummaryDataAttributes;

export interface MuiSurveyResponseSummarySlots<TSkipReason = unknown> {
  readonly renderHeader?: (data: SurveyResponseSummaryData<unknown, TSkipReason>) => ReactNode;
  readonly header?: (data: SurveyResponseSummaryData<unknown, TSkipReason>) => ReactNode;
  readonly renderQuestion?: (question: SurveyResponseSummaryQuestion) => ReactNode;
  readonly question?: (question: SurveyResponseSummaryQuestion) => ReactNode;
  readonly skipReasons?: (reasons: readonly TSkipReason[]) => ReactNode;
}

export interface MuiSurveyResponseSummarySlotProps {
  readonly root?: StackProps;
  readonly tabs?: TabsProps;
  readonly tab?: TabProps;
  readonly questionCard?: MuiSummaryCardProps;
  readonly questionContent?: CardContentProps;
  readonly responseCounts?: StackProps;
  readonly optionList?: ListProps;
  readonly option?: ListItemProps;
  readonly progress?: LinearProgressProps;
  readonly statistics?: StackProps;
  readonly statisticCard?: MuiSummaryCardProps;
  readonly statisticContent?: CardContentProps;
  readonly skipReasonsCard?: MuiSummaryCardProps;
  readonly skipReasonList?: ListProps;
  readonly skipReason?: ListItemProps;
}

export interface MuiSurveyResponseSummaryDataProps<
  TCustomData = unknown,
  TSkipReason = SurveyResponseSummarySkipReason
> {
  readonly data: SurveyResponseSummaryData<TCustomData, TSkipReason>;
  readonly languageOptions?: readonly SurveyResponseSummaryLanguageOption[];
  readonly selectedLanguage?: string | null;
  readonly onLanguageChange?: (language: string | null) => void;
  readonly summaryState?: SurveyClientAsyncState;
  readonly labels?: SurveyResponseSummaryDomainLabels;
  /** Locale used for counts, statistics, and percentages. Defaults to the active summary language. */
  readonly locale?: string;
  readonly slots?: MuiSurveyResponseSummarySlots<TSkipReason>;
  readonly slotProps?: MuiSurveyResponseSummarySlotProps;
  readonly className?: string;
}

export interface MuiSurveyResponseSummaryDomainProps<TSummary, TVersion>
  extends Omit<SurveyResponseSummaryDomainInputProps<TSummary, TVersion>, "slots" | "variant"> {
  readonly slots?: MuiSurveyResponseSummarySlots<unknown>;
  readonly slotProps?: MuiSurveyResponseSummarySlotProps;
}

function clampPercentage(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, value));
}

function formatCount(value: number | null, locale: string): string {
  if (value === null) return "—";
  try {
    return new Intl.NumberFormat(locale).format(value);
  } catch {
    return new Intl.NumberFormat().format(value);
  }
}

function formatNumber(value: number | null, locale: string): string {
  if (value === null) return "—";
  try {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
  } catch {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
  }
}

function formatPercentage(value: number | null, locale: string): string {
  const percentage = clampPercentage(value);
  if (percentage === null) return "—";
  try {
    return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(percentage / 100);
  } catch {
    return new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 1 }).format(percentage / 100);
  }
}

function statisticValue(statistics: Readonly<Record<string, number | null>>, key: string): number | null {
  const value = statistics[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

const defaultLabels: Required<SurveyResponseSummaryDomainLabels> = {
  languages: "Languages",
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

function MuiStatisticCard(
  label: string,
  value: string,
  cardProps: MuiSummaryCardProps | undefined,
  contentProps: CardContentProps | undefined
): React.JSX.Element {
  return (
    <Card variant="outlined" {...cardProps}>
      <CardContent {...contentProps}>
        <Typography color="text.secondary" variant="body2">
          {label}
        </Typography>
        <Typography variant="h6">{value}</Typography>
      </CardContent>
    </Card>
  );
}

function MuiQuestionCard<TSkipReason>(
  question: SurveyResponseSummaryQuestion,
  labels: Required<SurveyResponseSummaryDomainLabels>,
  locale: string,
  slots: MuiSurveyResponseSummarySlots<TSkipReason> | undefined,
  slotProps: MuiSurveyResponseSummarySlotProps
): React.JSX.Element {
  const statistics = question.statistics;
  const questionRenderer = slots?.question ?? slots?.renderQuestion;
  if (questionRenderer !== undefined) return <>{questionRenderer(question)}</>;
  return (
    <Card
      variant="outlined"
      data-question-kind={question.kind}
      data-mui-slot="response-summary-question"
      {...slotProps.questionCard}
    >
      <CardContent {...slotProps.questionContent}>
        <Stack spacing={1.5}>
          <Typography component="h3" variant="h6">
            {question.label}
          </Typography>
          <Stack direction={{ sm: "row" }} spacing={2} {...slotProps.responseCounts}>
            <Box>
              <Typography color="text.secondary" variant="body2">
                {labels.answered}
              </Typography>
              <Typography variant="body1">{formatCount(question.answeredCount, locale)}</Typography>
            </Box>
            <Box>
              <Typography color="text.secondary" variant="body2">
                {labels.unanswered}
              </Typography>
              <Typography variant="body1">{formatCount(question.unansweredCount, locale)}</Typography>
            </Box>
          </Stack>
          {question.options === undefined ? null : (
            <Box>
              <Typography component="h4" variant="subtitle1">
                {labels.options}
              </Typography>
              <List disablePadding {...slotProps.optionList}>
                {question.options.map((option) => {
                  const percentage = clampPercentage(option.percentage);
                  const formattedPercentage = formatPercentage(percentage, locale);
                  return (
                    <ListItem disableGutters {...slotProps.option} key={option.id}>
                      <Stack spacing={0.5} sx={{ width: "100%" }}>
                        <Stack direction="row" justifyContent="space-between" spacing={1}>
                          <Typography variant="body2">{option.label}</Typography>
                          <Typography variant="body2">
                            {formatCount(option.count, locale)} ({formattedPercentage})
                          </Typography>
                        </Stack>
                        <LinearProgress
                          {...slotProps.progress}
                          variant="determinate"
                          value={percentage ?? 0}
                          aria-label={`${option.label}: ${labels.percentage} ${formattedPercentage}`}
                        />
                      </Stack>
                    </ListItem>
                  );
                })}
              </List>
            </Box>
          )}
          {statistics === undefined ? null : (
            <Box>
              <Typography component="h4" variant="subtitle1">
                {labels.statistics}
              </Typography>
              <Stack direction={{ sm: "row" }} spacing={1.5} {...slotProps.statistics}>
                {question.kind === "checkbox" ? (
                  <>
                    {MuiStatisticCard(
                      labels.checked,
                      `${formatCount(statisticValue(statistics, "trueCount"), locale)} (${formatPercentage(
                        statisticValue(statistics, "truePercentage"),
                        locale
                      )})`,
                      slotProps.statisticCard,
                      slotProps.statisticContent
                    )}
                    {MuiStatisticCard(
                      labels.unchecked,
                      `${formatCount(statisticValue(statistics, "falseCount"), locale)} (${formatPercentage(
                        statisticValue(statistics, "falsePercentage"),
                        locale
                      )})`,
                      slotProps.statisticCard,
                      slotProps.statisticContent
                    )}
                  </>
                ) : (
                  <>
                    {MuiStatisticCard(
                      labels.average,
                      formatNumber(statisticValue(statistics, "average"), locale),
                      slotProps.statisticCard,
                      slotProps.statisticContent
                    )}
                    {MuiStatisticCard(
                      labels.minimum,
                      formatNumber(statisticValue(statistics, "minimum"), locale),
                      slotProps.statisticCard,
                      slotProps.statisticContent
                    )}
                    {MuiStatisticCard(
                      labels.maximum,
                      formatNumber(statisticValue(statistics, "maximum"), locale),
                      slotProps.statisticCard,
                      slotProps.statisticContent
                    )}
                    {MuiStatisticCard(
                      labels.total,
                      formatNumber(statisticValue(statistics, "total"), locale),
                      slotProps.statisticCard,
                      slotProps.statisticContent
                    )}
                  </>
                )}
              </Stack>
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

function MuiSkipReasons<TSkipReason>(
  reasons: readonly TSkipReason[],
  label: string,
  locale: string,
  slots: MuiSurveyResponseSummarySlots<TSkipReason> | undefined,
  slotProps: MuiSurveyResponseSummarySlotProps
): React.JSX.Element | null {
  if (slots?.skipReasons !== undefined) return <>{slots.skipReasons(reasons)}</>;
  const entries = reasons.flatMap((reason) => {
    if (typeof reason !== "object" || reason === null || !("reason" in reason) || !("count" in reason)) return [];
    return typeof reason.reason === "string" && typeof reason.count === "number" && Number.isFinite(reason.count)
      ? [{ reason: reason.reason, count: reason.count }]
      : [];
  });
  if (entries.length === 0) return null;
  return (
    <Card variant="outlined" data-mui-slot="response-summary-skip-reasons" {...slotProps.skipReasonsCard}>
      <CardContent>
        <Typography component="h3" variant="h6">
          {label}
        </Typography>
        <List disablePadding {...slotProps.skipReasonList}>
          {entries.map((entry) => (
            <ListItem disableGutters {...slotProps.skipReason} key={entry.reason}>
              <Stack direction="row" justifyContent="space-between" sx={{ width: "100%" }}>
                <Typography variant="body2">{entry.reason}</Typography>
                <Typography variant="body2">{formatCount(entry.count, locale)}</Typography>
              </Stack>
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );
}

export function MuiSurveyResponseSummary<TCustomData = unknown, TSkipReason = SurveyResponseSummarySkipReason>(
  props: MuiSurveyResponseSummaryDataProps<TCustomData, TSkipReason>
): React.JSX.Element {
  const {
    data,
    languageOptions,
    selectedLanguage,
    onLanguageChange,
    summaryState,
    labels,
    locale,
    slots,
    slotProps = {},
    className
  } = props;
  const resolvedLabels = { ...defaultLabels, ...labels };
  const displayLocale = locale ?? data.sourceLanguage;
  const resolvedLanguageOptions: readonly SurveyResponseSummaryLanguageOption[] =
    languageOptions ??
    data.languages?.map(({ language, submissionCount }) => ({ language, count: submissionCount })) ??
    [];
  const activeLanguage = selectedLanguage ?? data.sourceLanguage;
  const header = slots?.header?.(data) ?? slots?.renderHeader?.(data) ?? (
    <Typography component="h2" variant="h5">
      {data.title}
    </Typography>
  );
  const isBusy = summaryState?.status === "loading" || summaryState?.status === "error";
  return (
    <Stack
      data-summary-variant="mui"
      data-mui-slot="response-summary"
      spacing={2}
      {...slotProps.root}
      className={className ?? slotProps.root?.className}
    >
      {header}
      {resolvedLanguageOptions.length === 0 ? null : (
        <Tabs
          value={activeLanguage}
          aria-label={resolvedLabels.languages}
          onChange={(_, language: string) => onLanguageChange?.(language)}
          {...slotProps.tabs}
        >
          {resolvedLanguageOptions.map(({ language, count, label }) => (
            <Tab
              value={language}
              label={
                <>
                  {label ?? language} ({formatCount(count, displayLocale)})
                </>
              }
              key={language}
              {...slotProps.tab}
            />
          ))}
        </Tabs>
      )}
      {summaryState?.status === "loading" ? <LinearProgress aria-label="Loading summary" /> : null}
      {summaryState?.status === "error" ? (
        <Alert severity="error">{summaryState.error?.message ?? "Unable to load summary."}</Alert>
      ) : null}
      {isBusy ? null : (
        <Stack spacing={2}>
          {data.questions.map((question) => (
            <Box key={question.fieldId}>
              {MuiQuestionCard(question, resolvedLabels, displayLocale, slots, slotProps)}
            </Box>
          ))}
          {data.skipReasons === undefined || data.skipReasons.length === 0
            ? null
            : MuiSkipReasons(data.skipReasons, resolvedLabels.skipReasons, displayLocale, slots, slotProps)}
        </Stack>
      )}
    </Stack>
  );
}

export function MuiSurveyResponseSummaryDomain<TSummary, TVersion>(
  props: MuiSurveyResponseSummaryDomainProps<TSummary, TVersion>
): React.JSX.Element {
  const { slots, slotProps, ...domainOptions } = props;
  const controller = useSurveyResponseSummaryDomain(domainOptions);
  const summaryProps: MuiSurveyResponseSummaryDataProps<TSummary, unknown> = {
    data: controller.data,
    languageOptions: controller.languageOptions,
    selectedLanguage: controller.selectedLanguage,
    onLanguageChange: controller.setLanguage,
    summaryState: props.summaryState ?? controller.summaryState,
    ...(props.labels === undefined ? {} : { labels: props.labels }),
    ...(props.locale === undefined ? {} : { locale: props.locale }),
    ...(slots === undefined ? {} : { slots }),
    ...(slotProps === undefined ? {} : { slotProps }),
    ...(props.className === undefined ? {} : { className: props.className })
  };
  return <MuiSurveyResponseSummary {...summaryProps} />;
}
