import type {
  BaseSubmissionMetadata,
  FormAnalytics,
  getContentModeDiagnostics,
  PollRuntimeAdapter,
  QuizQuestionResult
} from "@form-engine-ts/core";
import {
  type ChoiceOptionSlotProps,
  ContentRenderer,
  type ContentRendererClassNames,
  type ContentRendererProps,
  type ContentRendererSlots,
  type FormDraftResumeSlotProps,
  FormEngineI18nProvider,
  type FormProgressSlotProps,
  type FormQuizShareSlotProps,
  type FormRendererComponents,
  type FormRendererProps,
  type FormSubmissionMetadata,
  type PollResultOptionProps,
  type PollResultsErrorProps,
  type PollResultsLoadingProps,
  type QuizResultSummaryProps,
  type QuizShareOptions,
  type RadioTextInputSlotProps,
  type TypedFormRendererProps,
  useShare
} from "@form-engine-ts/react";
import {
  Alert,
  Button,
  Checkbox,
  FormControlLabel,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import type { ReactNode } from "react";
import { muiContentTranslation } from "./contentTranslation";
import { MuiFormBuilderContext } from "./context";
import type { MuiPollResultsSlotProps, MuiPollResultsSlots } from "./MuiPollResults";
import { QuizResultView, type QuizResultViewProps } from "./QuizResultView";
import { muiRespondentComponents } from "./respondent";
import { MuiChoiceGroupSlot } from "./slots";
import type { MuiAdapterOptions, MuiFormEngineI18nOptions } from "./types";

export interface MuiQuizRendererOptions {
  readonly showImmediateFeedback?: boolean;
  readonly share?: QuizShareOptions;
  readonly renderShare?: (props: FormQuizShareSlotProps) => ReactNode;
  readonly resultViewProps?: Omit<QuizResultViewProps, "evaluation" | "schema" | "locale" | "i18n">;
  readonly renderInvalid?: (issues: ReturnType<typeof getContentModeDiagnostics>) => ReactNode;
}

export interface MuiPollRendererOptions {
  readonly adapter: PollRuntimeAdapter<FormAnalytics>;
  readonly closed?: boolean;
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
  labels,
  share,
  renderShare,
  className,
  options
}: QuizResultSummaryProps & {
  readonly locale: string;
  readonly i18n?: MuiFormEngineI18nOptions;
  readonly options?: MuiQuizRendererOptions;
}) {
  const {
    share: shareResult,
    status: shareStatus,
    supported
  } = useShare(share?.onShare === undefined ? {} : { onShare: share.onShare });
  const { translate: t } = muiContentTranslation(locale, i18n);
  const shareProps: FormQuizShareSlotProps = {
    evaluation,
    schema,
    status: shareStatus,
    supported,
    onShare: () =>
      void shareResult({
        title: schema.title,
        text:
          share?.buildText?.(evaluation, schema) ??
          `${labels?.totalScore ?? t("content.results.totalScore")}: ${evaluation.totalScore} / ${evaluation.maxPossibleScore}`,
        ...(share?.url === undefined ? {} : { url: share.url })
      })
  };
  const shareContent =
    share === undefined
      ? null
      : (renderShare?.(shareProps) ??
        options?.renderShare?.(shareProps) ?? (
          <Button
            type="button"
            disabled={!supported || shareStatus === "shared" || shareStatus === "copied"}
            onClick={shareProps.onShare}
          >
            {shareStatus === "shared"
              ? t("content.results.shared")
              : shareStatus === "copied"
                ? t("content.results.copied")
                : t("content.results.share")}
          </Button>
        ));
  return (
    <Stack className={className} spacing={2}>
      <QuizResultView
        {...options?.resultViewProps}
        evaluation={evaluation}
        schema={schema}
        locale={locale}
        {...(i18n === undefined ? {} : { i18n })}
      />
      {shareContent}
      {shareStatus === "error" ? <Alert severity="error">{t("content.results.shareFailed")}</Alert> : null}
    </Stack>
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

function formatTranslation(value: string, params: Readonly<Record<string, string | number>>): string {
  return value.replace(/\{\{(\w+)\}\}/g, (token, key: string) =>
    Object.hasOwn(params, key) ? String(params[key]) : token
  );
}

function MuiProgress({
  progress,
  locale,
  i18n
}: {
  readonly progress: FormProgressSlotProps;
  readonly locale: string;
  readonly i18n?: MuiFormEngineI18nOptions;
}) {
  if (progress.visiblePages <= 1) return null;
  const { translate: t } = muiContentTranslation(locale, i18n);
  const step = formatTranslation(t("form.step"), {
    current: progress.currentPage + 1,
    total: progress.visiblePages
  });
  const remaining = formatTranslation(t("renderer.remainingQuestions"), {
    count: progress.remainingQuestions
  });
  return (
    <Stack spacing={0.5} sx={{ mt: 1 }}>
      <LinearProgress
        variant="determinate"
        value={progress.percent}
        aria-label={t("renderer.progressLabel")}
        aria-valuetext={`${step} (${remaining})`}
      />
      <Typography component="span" variant="body2" color="text.secondary">
        {step}
      </Typography>
    </Stack>
  );
}

function MuiNavigation({
  ButtonComponent,
  totalPages,
  canPrev,
  canNext,
  disabled,
  onPrev,
  onNext,
  locale,
  i18n
}: {
  readonly ButtonComponent: NonNullable<FormRendererComponents["Button"]>;
  readonly totalPages: number;
  readonly canPrev: boolean;
  readonly canNext: boolean;
  readonly disabled?: boolean;
  readonly onPrev: () => void;
  readonly onNext: () => void;
  readonly locale: string;
  readonly i18n?: MuiFormEngineI18nOptions;
}) {
  if (totalPages <= 1 || (!canPrev && !canNext)) return null;
  const { translate: t } = muiContentTranslation(locale, i18n);
  return (
    <Stack direction={{ xs: "column-reverse", sm: "row" }} spacing={1} justifyContent="space-between" sx={{ mt: 2 }}>
      {canPrev ? (
        <ButtonComponent
          type="button"
          kind="previous"
          {...(disabled === undefined ? {} : { disabled })}
          onClick={onPrev}
        >
          {t("form.back")}
        </ButtonComponent>
      ) : (
        <span />
      )}
      {canNext ? (
        <ButtonComponent type="button" kind="next" {...(disabled === undefined ? {} : { disabled })} onClick={onNext}>
          {t("form.next")}
        </ButtonComponent>
      ) : null}
    </Stack>
  );
}

function MuiDraftResume({
  ButtonComponent,
  props,
  locale,
  i18n
}: {
  readonly ButtonComponent: NonNullable<FormRendererComponents["Button"]>;
  props: FormDraftResumeSlotProps;
  locale: string;
  i18n?: MuiFormEngineI18nOptions;
}) {
  const { translate: t } = muiContentTranslation(locale, i18n);
  if (props.mode === "prompt") {
    return (
      <Alert severity="info">
        <Typography component="h2" variant="h6">
          {t("renderer.draftResumeTitle")}
        </Typography>
        <Typography>{t("renderer.draftResumeMessage")}</Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <ButtonComponent type="button" kind="draft-resume" onClick={props.onResume}>
            {t("renderer.draftResumeContinue")}
          </ButtonComponent>
          <ButtonComponent type="button" kind="draft-start-over" onClick={props.onStartOver}>
            {t("renderer.draftResumeStartOver")}
          </ButtonComponent>
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
        label={t(props.savingEnabled ? "renderer.draftResumeEnabled" : "renderer.draftResumeDisabled")}
      />
      {props.saveStatus === "saved" ? <Typography role="status">{t("renderer.draftSaved")}</Typography> : null}
      {props.error === undefined ? null : (
        <Typography role="alert">
          {t(props.errorKind === "delete" ? "renderer.draftDeleteFailed" : "renderer.draftSaveFailed")}
        </Typography>
      )}
    </Stack>
  );
}

function MuiChoiceOption({ children, checked, disabled, readOnly, inputId, option }: ChoiceOptionSlotProps) {
  return (
    <Paper
      component="label"
      variant={checked ? "elevation" : "outlined"}
      data-option-id={option.id}
      data-selected={checked ? "true" : "false"}
      aria-disabled={disabled || readOnly ? "true" : undefined}
      htmlFor={inputId}
      sx={{
        alignItems: "center",
        cursor: disabled || readOnly ? "default" : "pointer",
        display: "flex",
        gap: 1,
        minHeight: 48,
        px: 1.5,
        py: 0.75,
        borderColor: checked ? "primary.main" : "divider",
        bgcolor: checked ? "action.selected" : "background.paper"
      }}
    >
      {children}
    </Paper>
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
  const ButtonComponent = rendererProps.primitiveComponents?.Button ?? muiRespondentComponents.Button;
  if (ButtonComponent === undefined) throw new Error("MUI respondent Button is unavailable.");
  const resolvedSlots: ContentRendererSlots = {
    ...slots,
    renderNavigation:
      contentSlots?.renderNavigation ??
      ((navigation) => (
        <MuiNavigation
          ButtonComponent={ButtonComponent}
          totalPages={navigation.totalPages}
          canPrev={navigation.canPrev}
          canNext={navigation.canNext}
          {...(navigation.disabled === undefined ? {} : { disabled: navigation.disabled })}
          onPrev={navigation.onPrev}
          onNext={navigation.onNext}
          locale={locale}
          {...(i18n === undefined ? {} : { i18n })}
        />
      )),
    renderChoiceOption: contentSlots?.renderChoiceOption ?? MuiChoiceOption,
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
      ((draft) => (
        <MuiDraftResume
          ButtonComponent={ButtonComponent}
          props={draft}
          locale={locale}
          {...(i18n === undefined ? {} : { i18n })}
        />
      )),
    renderChoiceGroup: slots?.renderChoiceGroup ?? MuiChoiceGroupSlot,
    renderPageHeader:
      contentSlots?.renderPageHeader ??
      (({ page, progress }) => (
        <Stack spacing={0.5}>
          {page.title === undefined ? null : <Typography component="h2">{page.title}</Typography>}
          {page.description === undefined ? null : (
            <Typography component="p" color="text.secondary">
              {page.description}
            </Typography>
          )}
          {contentSlots?.renderProgress?.(progress) ?? (
            <MuiProgress progress={progress} locale={locale} {...(i18n === undefined ? {} : { i18n })} />
          )}
        </Stack>
      )),
    renderRadioTextInput:
      contentSlots?.renderRadioTextInput ??
      ((input: RadioTextInputSlotProps) => (
        <TextField
          {...muiOptions?.muiSlotProps?.textField}
          id={input.inputId}
          label={input.label}
          value={input.value}
          disabled={input.disabled}
          slotProps={{ input: { readOnly: input.readOnly } }}
          size={muiOptions?.size ?? "medium"}
          variant={muiOptions?.variant ?? "outlined"}
          fullWidth={muiOptions?.inputFullWidth ?? muiOptions?.fullWidth ?? true}
          onChange={(event) => input.onChange(event.currentTarget.value)}
        />
      )),
    renderQuizFeedback:
      contentSlots?.renderQuizFeedback ??
      ((feedback) => (
        <MuiQuizFeedback question={feedback.question} locale={locale} {...(i18n === undefined ? {} : { i18n })} />
      )),
    renderQuizSummary:
      contentSlots?.renderQuizSummary ??
      ((summary) => (
        <MuiQuizSummary
          {...summary}
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
              : { showImmediateFeedback: quizOptions.showImmediateFeedback }),
            ...(quizOptions.share === undefined ? {} : { share: quizOptions.share })
          }
        }),
    ...(pollOptions === undefined
      ? {}
      : {
          poll: {
            adapter: pollOptions.adapter,
            canViewResults: pollOptions.canViewResults,
            ...(pollOptions.closed === undefined ? {} : { closed: pollOptions.closed }),
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
        primitiveComponents={{ ...muiRespondentComponents, ...rendererProps.primitiveComponents }}
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
