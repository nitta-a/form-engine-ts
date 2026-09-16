import type {
  BaseSubmissionMetadata,
  FormAnalytics,
  FormSchema,
  getContentModeDiagnostics,
  PollRuntimeAdapter,
  QuizEvaluationResult,
  QuizQuestionResult
} from "@form-engine-ts/core";
import {
  ContentRenderer,
  type ContentRendererClassNames,
  type ContentRendererProps,
  type ContentRendererSlots,
  type FormDraftResumeSlotProps,
  FormEngineI18nProvider,
  type FormRendererProps,
  type FormSubmissionMetadata,
  type PollResultOptionProps,
  type PollResultsErrorProps,
  type PollResultsLoadingProps,
  type TypedFormRendererProps
} from "@form-engine-ts/react";
import { Alert, Button, Checkbox, FormControlLabel, LinearProgress, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { muiContentTranslation } from "./contentTranslation";
import { MuiFormBuilderContext } from "./context";
import type { MuiPollResultsSlotProps, MuiPollResultsSlots } from "./MuiPollResults";
import { QuizResultView, type QuizResultViewProps } from "./QuizResultView";
import { MuiChoiceGroupSlot } from "./slots";
import type { MuiAdapterOptions, MuiFormEngineI18nOptions } from "./types";

export interface MuiQuizRendererOptions {
  readonly showImmediateFeedback?: boolean;
  readonly resultViewProps?: Omit<QuizResultViewProps, "evaluation" | "schema" | "locale" | "i18n">;
  readonly renderInvalid?: (issues: ReturnType<typeof getContentModeDiagnostics>) => ReactNode;
}

export interface MuiPollRendererOptions {
  readonly adapter: PollRuntimeAdapter<FormAnalytics>;
  readonly closed: boolean;
  readonly canViewResults: boolean;
  readonly alreadyVoted?: boolean;
  readonly submissionRevision?: number;
  readonly slots?: MuiPollResultsSlots;
  readonly slotProps?: MuiPollResultsSlotProps;
}

export interface MuiContentRendererOptions {
  readonly quiz?: MuiQuizRendererOptions;
  readonly poll?: MuiPollRendererOptions;
}

interface MuiContentRendererOwnProps {
  readonly contentModeOptions?: MuiContentRendererOptions;
  readonly muiOptions?: MuiAdapterOptions;
  readonly i18n?: MuiFormEngineI18nOptions;
  readonly classNames?: ContentRendererClassNames;
  readonly slots?: ContentRendererSlots;
}

export type MuiContentRendererProps = FormRendererProps & MuiContentRendererOwnProps;
export type TypedMuiContentRendererProps<TMeta extends BaseSubmissionMetadata = FormSubmissionMetadata> =
  TypedFormRendererProps<TMeta> & MuiContentRendererOwnProps;

function MuiQuizFeedback({
  question,
  locale,
  i18n
}: {
  readonly question: QuizQuestionResult;
  readonly locale: string;
  readonly i18n?: MuiFormEngineI18nOptions;
}) {
  const { translate: t } = muiContentTranslation(locale, i18n);
  return (
    <Stack spacing={0.5} aria-live="polite" role="status" sx={{ mt: 1 }}>
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Typography
          component="span"
          aria-hidden="true"
          color={question.correct ? "success.main" : "error.main"}
          fontWeight="bold"
        >
          {question.correct ? "✓" : "!"}
        </Typography>
        <Typography component="span" color={question.correct ? "success.main" : "error.main"} fontWeight="bold">
          {t(question.correct ? "content.results.correct" : "content.results.incorrect")}
        </Typography>
      </Stack>
      <Typography variant="body2">
        {t("content.results.correctOption")}: {question.correctOption}
      </Typography>
      {question.explanation === undefined ? null : <Typography variant="body2">{question.explanation}</Typography>}
      <Typography variant="body2">
        {question.earned} / {question.points}
      </Typography>
    </Stack>
  );
}

function MuiQuizSummary({
  evaluation,
  schema,
  locale,
  i18n,
  options
}: {
  readonly evaluation: QuizEvaluationResult;
  readonly schema: FormSchema;
  readonly locale: string;
  readonly i18n?: MuiFormEngineI18nOptions;
  readonly options?: MuiQuizRendererOptions;
}) {
  return (
    <QuizResultView
      {...options?.resultViewProps}
      evaluation={evaluation}
      schema={schema}
      locale={locale}
      {...(i18n === undefined ? {} : { i18n })}
    />
  );
}

function MuiPollResultOption({
  item,
  locale,
  options,
  i18n
}: PollResultOptionProps & {
  readonly options: MuiPollRendererOptions;
  readonly i18n?: MuiFormEngineI18nOptions;
}) {
  const { locale: resolvedLocale, translate: t } = muiContentTranslation(locale, i18n);
  const resultItem = { ...item };
  if (options.slots?.option !== undefined) return <>{options.slots.option(resultItem)}</>;
  return (
    <Stack component="span" spacing={0.5} sx={{ flex: 1, minWidth: 0 }} data-poll-result-option>
      <LinearProgress
        {...options.slotProps?.progress}
        variant="determinate"
        value={item.percentage}
        aria-label={`${item.label}: ${item.percentage}%`}
      />
      <Typography {...options.slotProps?.count} component={options.slotProps?.count?.component ?? "span"}>
        {new Intl.NumberFormat(resolvedLocale).format(item.count)} {t("content.results.votes")} (
        {new Intl.NumberFormat(resolvedLocale).format(item.percentage)}%)
      </Typography>
    </Stack>
  );
}

function MuiPollResultsLoading({
  options,
  props
}: {
  readonly options: MuiPollRendererOptions;
  readonly props: PollResultsLoadingProps;
}) {
  return (
    options.slots?.loading?.() ?? (
      <Typography {...options.slotProps?.loading} role="status">
        {props.label}
      </Typography>
    )
  );
}

function MuiPollResultsError({
  options,
  props
}: {
  readonly options: MuiPollRendererOptions;
  readonly props: PollResultsErrorProps;
}) {
  return (
    options.slots?.error?.(props.error, props.onRetry) ?? (
      <Alert {...options.slotProps?.error} severity="error" role="alert">
        {props.error.message || props.labels.loadError}{" "}
        <Button {...options.slotProps?.retry} type="button" onClick={props.onRetry}>
          {props.labels.retry}
        </Button>
      </Alert>
    )
  );
}

function MuiInvalidQuiz({
  issues,
  locale,
  i18n,
  renderInvalid
}: {
  readonly issues: ReturnType<typeof getContentModeDiagnostics>;
  readonly locale: string;
  readonly i18n?: MuiFormEngineI18nOptions;
  readonly renderInvalid?: MuiQuizRendererOptions["renderInvalid"];
}) {
  if (renderInvalid !== undefined) return <>{renderInvalid(issues)}</>;
  const { translate: t } = muiContentTranslation(locale, i18n);
  return <Alert severity="error">{t("content.results.invalidQuiz")}</Alert>;
}

function MuiDraftResume({
  props,
  locale,
  i18n
}: {
  props: FormDraftResumeSlotProps;
  locale: string;
  i18n?: MuiFormEngineI18nOptions;
}) {
  const ja = locale.toLowerCase().startsWith("ja");
  const label = (key: string, fallback: string) => {
    const translated = i18n?.translator?.(key);
    return translated === undefined || translated === key ? fallback : translated;
  };
  if (props.mode === "prompt") {
    return (
      <Alert severity="info">
        <Typography component="h2" variant="h6">
          {label("renderer.draftResumeTitle", ja ? "回答を続ける" : "Continue your response")}
        </Typography>
        <Typography>
          {label(
            "renderer.draftResumeMessage",
            ja
              ? "このブラウザーに保存された未送信の回答があります。"
              : "A saved response from this browser is available. It has not been submitted."
          )}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <Button type="button" variant="contained" onClick={props.onResume}>
            {label("renderer.draftResumeContinue", ja ? "続きから回答する" : "Continue where you left off")}
          </Button>
          <Button type="button" onClick={props.onStartOver}>
            {label("renderer.draftResumeStartOver", ja ? "最初から回答する" : "Start over")}
          </Button>
        </Stack>
      </Alert>
    );
  }
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <FormControlLabel
        control={
          <Checkbox
            checked={props.savingEnabled}
            disabled={!props.storageAvailable}
            onChange={(_, checked) => props.onToggleSaving(checked)}
          />
        }
        label={label(
          props.savingEnabled ? "renderer.draftResumeEnabled" : "renderer.draftResumeDisabled",
          props.savingEnabled
            ? ja
              ? "この端末に回答を7日間保存する"
              : "Save my response on this device for 7 days"
            : ja
              ? "この端末に回答を保存しない"
              : "Do not save my response on this device"
        )}
      />
      {props.saveStatus === "saved" ? (
        <Typography role="status">
          {label("renderer.draftSaved", ja ? "この端末に一時保存しました" : "Saved on this device")}
        </Typography>
      ) : null}
      {props.error === undefined ? null : (
        <Typography role="alert">
          {label(
            props.errorKind === "delete" ? "renderer.draftDeleteFailed" : "renderer.draftSaveFailed",
            props.errorKind === "delete"
              ? ja
                ? "保存された回答を削除できませんでした。"
                : "The saved response could not be removed."
              : ja
                ? "この端末に回答を保存できませんでした。"
                : "This response could not be saved on this device."
          )}
        </Typography>
      )}
    </Stack>
  );
}

function MuiContentRendererImplementation<TMeta extends BaseSubmissionMetadata = FormSubmissionMetadata>(
  props: MuiContentRendererProps | TypedMuiContentRendererProps<TMeta>
) {
  const { contentModeOptions, muiOptions, i18n, slots, ...rendererProps } = props;
  const locale =
    "schema" in rendererProps
      ? (rendererProps.locale ?? rendererProps.schema.defaultLocale ?? "en")
      : (i18n?.locale ?? "en");
  const quizOptions = contentModeOptions?.quiz;
  const pollOptions = contentModeOptions?.poll;
  const contentSlots = slots;
  const resolvedSlots: ContentRendererSlots = {
    ...slots,
    renderHeader:
      contentSlots?.renderHeader ??
      (({ title, description }) => (
        <Stack component="header" className={props.classNames?.header} spacing={1}>
          <Typography component="h1" className={props.classNames?.headerTitle} variant="h4">
            {title}
          </Typography>
          {description === undefined ? null : (
            <Typography component="p" className={props.classNames?.headerDescription} color="text.secondary">
              {description}
            </Typography>
          )}
        </Stack>
      )),
    renderDraftResume:
      contentSlots?.renderDraftResume ??
      ((draft) => <MuiDraftResume props={draft} locale={locale} {...(i18n === undefined ? {} : { i18n })} />),
    renderChoiceGroup: slots?.renderChoiceGroup ?? MuiChoiceGroupSlot,
    renderQuizFeedback:
      contentSlots?.renderQuizFeedback ??
      ((feedback) => (
        <MuiQuizFeedback question={feedback.question} locale={locale} {...(i18n === undefined ? {} : { i18n })} />
      )),
    renderQuizSummary:
      contentSlots?.renderQuizSummary ??
      ((summary) => (
        <MuiQuizSummary
          evaluation={summary.evaluation}
          schema={summary.schema}
          locale={locale}
          {...(i18n === undefined ? {} : { i18n })}
          {...(quizOptions === undefined ? {} : { options: quizOptions })}
        />
      )),
    renderInvalidQuiz:
      contentSlots?.renderInvalidQuiz ??
      ((issues) => (
        <MuiInvalidQuiz
          issues={issues}
          locale={locale}
          {...(i18n === undefined ? {} : { i18n })}
          {...(quizOptions?.renderInvalid === undefined ? {} : { renderInvalid: quizOptions.renderInvalid })}
        />
      )),
    ...(pollOptions === undefined || contentSlots?.renderPollResultOption !== undefined
      ? {}
      : {
          renderPollResultOption: (poll: PollResultOptionProps) => (
            <MuiPollResultOption {...poll} options={pollOptions} {...(i18n === undefined ? {} : { i18n })} />
          )
        }),
    ...(pollOptions === undefined || contentSlots?.renderPollResultsLoading !== undefined
      ? {}
      : {
          renderPollResultsLoading: (poll: PollResultsLoadingProps) => (
            <MuiPollResultsLoading options={pollOptions} props={poll} />
          )
        }),
    ...(pollOptions === undefined || contentSlots?.renderPollResultsError !== undefined
      ? {}
      : {
          renderPollResultsError: (poll: PollResultsErrorProps) => (
            <MuiPollResultsError options={pollOptions} props={poll} />
          )
        })
  };
  const contentMode = {
    ...(quizOptions === undefined
      ? {}
      : {
          quiz: {
            ...(quizOptions.showImmediateFeedback === undefined
              ? {}
              : { showImmediateFeedback: quizOptions.showImmediateFeedback })
          }
        }),
    ...(pollOptions === undefined
      ? {}
      : {
          poll: {
            adapter: pollOptions.adapter,
            closed: pollOptions.closed,
            canViewResults: pollOptions.canViewResults,
            ...(pollOptions.alreadyVoted === undefined ? {} : { alreadyVoted: pollOptions.alreadyVoted }),
            ...(pollOptions.submissionRevision === undefined
              ? {}
              : { submissionRevision: pollOptions.submissionRevision })
          }
        })
  };
  const content = (
    <MuiFormBuilderContext.Provider value={{ options: muiOptions ?? {} }}>
      <ContentRenderer
        {...(rendererProps as ContentRendererProps)}
        contentModeOptions={contentMode}
        slots={resolvedSlots}
      />
    </MuiFormBuilderContext.Provider>
  );
  if (i18n === undefined) return content;
  return <FormEngineI18nProvider {...i18n}>{content}</FormEngineI18nProvider>;
}

export function MuiContentRenderer(props: MuiContentRendererProps): React.JSX.Element;
export function MuiContentRenderer<TMeta extends BaseSubmissionMetadata = FormSubmissionMetadata>(
  props: TypedMuiContentRendererProps<TMeta>
): React.JSX.Element;
export function MuiContentRenderer<TMeta extends BaseSubmissionMetadata = FormSubmissionMetadata>(
  props: MuiContentRendererProps | TypedMuiContentRendererProps<TMeta>
) {
  return <MuiContentRendererImplementation {...props} />;
}
