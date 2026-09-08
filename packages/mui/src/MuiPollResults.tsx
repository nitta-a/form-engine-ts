import type { ChoiceQuestionAggregate, FormAnalytics, FormSchema, PollRuntimeAdapter } from "@form-engine-ts/core";
import { usePollResults } from "@form-engine-ts/react";
import {
  Alert,
  type AlertProps,
  Button,
  type ButtonProps,
  Card,
  type CardProps,
  LinearProgress,
  type LinearProgressProps,
  List,
  ListItem,
  type ListItemProps,
  type ListProps,
  Stack,
  type StackProps,
  Typography,
  type TypographyProps
} from "@mui/material";
import { Fragment, type ReactNode } from "react";
import { muiContentTranslation } from "./contentTranslation";
import type { MuiComponentSlotProps, MuiFormEngineI18nOptions } from "./types";

export interface MuiPollResultItem {
  readonly optionId: string;
  readonly label: string;
  readonly count: number;
  readonly percentage: number;
}

export interface MuiPollResultViewSlots {
  readonly header?: (analytics: FormAnalytics) => ReactNode;
  readonly option?: (item: MuiPollResultItem) => ReactNode;
}

export interface MuiPollResultViewSlotProps {
  readonly root?: MuiComponentSlotProps<StackProps>;
  readonly card?: MuiComponentSlotProps<CardProps>;
  readonly title?: MuiComponentSlotProps<TypographyProps>;
  readonly list?: MuiComponentSlotProps<ListProps>;
  readonly option?: MuiComponentSlotProps<ListItemProps>;
  readonly progress?: MuiComponentSlotProps<LinearProgressProps>;
  readonly count?: MuiComponentSlotProps<TypographyProps>;
}

export interface MuiPollResultViewProps {
  readonly schema: FormSchema;
  readonly analytics: FormAnalytics;
  readonly locale?: string;
  readonly slots?: MuiPollResultViewSlots;
  readonly slotProps?: MuiPollResultViewSlotProps;
  readonly i18n?: MuiFormEngineI18nOptions;
}

function getPollItems(schema: FormSchema, analytics: FormAnalytics): readonly MuiPollResultItem[] {
  const field = schema.fields[0];
  const aggregate = analytics.questions.find(
    (question): question is ChoiceQuestionAggregate =>
      question.fieldId === field?.id &&
      (question.kind === "radio" || question.kind === "select" || question.kind === "multi-select")
  );
  if (field === undefined || !("options" in field) || aggregate === undefined) return [];
  return field.options.map((option) => {
    const value = aggregate.options.find((item) => item.id === option.id);
    return {
      optionId: option.id,
      label: option.label,
      count: value?.count ?? 0,
      percentage: Math.min(100, Math.max(0, value?.percentageOfSubmissions ?? 0))
    };
  });
}

export function MuiPollResultView({
  schema,
  analytics,
  locale = "en",
  slots = {},
  slotProps = {},
  i18n
}: MuiPollResultViewProps) {
  const { locale: resolvedLocale, translate: t } = muiContentTranslation(locale, i18n);
  const items = getPollItems(schema, analytics);
  const number = new Intl.NumberFormat(resolvedLocale);
  return (
    <Stack {...slotProps.root} spacing={slotProps.root?.spacing ?? 2}>
      {slots.header?.(analytics) ?? (
        <Typography {...slotProps.title} component={slotProps.title?.component ?? "h2"}>
          {t("content.results.pollResults")}
        </Typography>
      )}
      <Card {...slotProps.card}>
        <List {...slotProps.list}>
          {items.map((item) => (
            <Fragment key={item.optionId}>
              {slots.option?.(item) ?? (
                <ListItem {...slotProps.option}>
                  <Stack spacing={0.5} width="100%">
                    <Typography>{item.label}</Typography>
                    <LinearProgress
                      {...slotProps.progress}
                      variant="determinate"
                      value={item.percentage}
                      aria-label={`${item.label}: ${item.percentage}%`}
                    />
                    <Typography {...slotProps.count}>
                      {number.format(item.count)} {t("content.results.votes")} ({number.format(item.percentage)}%)
                    </Typography>
                  </Stack>
                </ListItem>
              )}
            </Fragment>
          ))}
        </List>
      </Card>
    </Stack>
  );
}

export interface MuiPollResultsSlots extends MuiPollResultViewSlots {
  readonly loading?: () => ReactNode;
  readonly error?: (error: Error, reload: () => void) => ReactNode;
}

export interface MuiPollResultsSlotProps extends MuiPollResultViewSlotProps {
  readonly loading?: MuiComponentSlotProps<TypographyProps>;
  readonly error?: MuiComponentSlotProps<AlertProps>;
  readonly retry?: MuiComponentSlotProps<ButtonProps>;
}

export interface MuiPollResultsProps {
  readonly schema: FormSchema;
  readonly adapter: PollRuntimeAdapter<FormAnalytics>;
  readonly submitted: boolean;
  readonly alreadyVoted?: boolean;
  readonly closed: boolean;
  readonly canViewResults: boolean;
  readonly submissionRevision?: number;
  readonly locale?: string;
  readonly slots?: MuiPollResultsSlots;
  readonly slotProps?: MuiPollResultsSlotProps;
  readonly i18n?: MuiFormEngineI18nOptions;
}

export function MuiPollResults({
  schema,
  adapter,
  submitted,
  alreadyVoted,
  closed,
  canViewResults,
  submissionRevision,
  locale = "en",
  slots = {},
  slotProps = {},
  i18n
}: MuiPollResultsProps) {
  const result = usePollResults({
    schema,
    adapter,
    submitted,
    ...(alreadyVoted === undefined ? {} : { alreadyVoted }),
    closed,
    canViewResults,
    ...(submissionRevision === undefined ? {} : { submissionRevision })
  });
  const { locale: resolvedLocale, translate: t } = muiContentTranslation(locale, i18n);
  if (!result.enabled) return null;
  if (result.error !== undefined)
    return (
      slots.error?.(result.error, result.reload) ?? (
        <Alert {...slotProps.error} severity="error" role="alert">
          {result.error.message || t("content.results.loadError")}{" "}
          <Button {...slotProps.retry} type="button" onClick={result.reload}>
            {t("content.results.retry")}
          </Button>
        </Alert>
      )
    );
  if (result.loading || result.data === undefined)
    return (
      slots.loading?.() ?? (
        <Typography {...slotProps.loading} role="status">
          {t("content.results.loading")}
        </Typography>
      )
    );
  return (
    <MuiPollResultView
      schema={schema}
      analytics={result.data}
      locale={resolvedLocale}
      {...(i18n === undefined ? {} : { i18n })}
      slots={slots}
      slotProps={slotProps}
    />
  );
}
