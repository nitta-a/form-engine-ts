import {
  type BaseSubmissionMetadata,
  type ChoiceQuestionAggregate,
  EN_MESSAGES,
  evaluateQuizLocally,
  type FormAnalytics,
  type FormSchema,
  type FormValues,
  getContentModeDiagnostics,
  getFormContentMode,
  JA_MESSAGES,
  type PollRuntimeAdapter,
  type QuizEvaluationResult,
  type QuizQuestionResult,
  readQuizFieldMetadata,
  readQuizMetadata
} from "@form-engine-ts/core";
import { createContext, type ReactNode, useContext, useEffect, useRef } from "react";
import { useForm } from "./context";
import { usePollResults } from "./hooks/usePollResults";
import { FormRenderer, type FormRendererProps, type TypedFormRendererProps } from "./renderer";
import type {
  ChoiceGroupSlotProps,
  ChoiceOptionAfterSlotProps,
  FormRendererClassNames,
  FormRendererSlots
} from "./types";

export interface ContentRendererClassNames extends FormRendererClassNames {
  readonly pollResults?: string;
  readonly pollResultOption?: string;
  readonly pollResultProgress?: string;
  readonly pollResultCount?: string;
  readonly quizQuestion?: string;
  readonly quizQuestionCorrect?: string;
  readonly quizQuestionIncorrect?: string;
  readonly quizFeedback?: string;
  readonly quizStatus?: string;
  readonly quizCorrectOption?: string;
  readonly quizExplanation?: string;
  readonly quizPoints?: string;
  readonly quizSummary?: string;
}

export interface QuizFeedbackLabels {
  readonly correct: string;
  readonly incorrect: string;
  readonly correctOption: string;
}

export interface QuizSummaryLabels {
  readonly totalScore: string;
  readonly passed: string;
  readonly notPassed: string;
  readonly reward?: string;
}

export interface PollResultLabels {
  readonly title: string;
  readonly votes: string;
  readonly loading: string;
  readonly retry: string;
  readonly loadError: string;
}

export interface PollResultItem {
  readonly optionId: string;
  readonly label: string;
  readonly count: number;
  readonly percentage: number;
  readonly checked?: boolean;
}

export interface PollResultOptionProps {
  readonly item: PollResultItem;
  readonly locale: string;
  readonly labels: Pick<PollResultLabels, "votes">;
  readonly classNames: Pick<ContentRendererClassNames, "pollResultOption" | "pollResultProgress" | "pollResultCount">;
}

export interface PollResultsLoadingProps {
  readonly locale: string;
  readonly label: string;
}

export interface PollResultsErrorProps {
  readonly error: Error;
  readonly onRetry: () => void;
  readonly locale: string;
  readonly labels: Pick<PollResultLabels, "retry" | "loadError">;
}

export interface QuizQuestionFeedbackProps {
  readonly question: QuizQuestionResult;
  readonly locale?: string;
  readonly labels?: Partial<QuizFeedbackLabels>;
  readonly classNames?: Pick<
    ContentRendererClassNames,
    | "quizQuestion"
    | "quizQuestionCorrect"
    | "quizQuestionIncorrect"
    | "quizFeedback"
    | "quizStatus"
    | "quizCorrectOption"
    | "quizExplanation"
    | "quizPoints"
  >;
}

export function QuizQuestionFeedback({ question, locale = "en", labels, classNames = {} }: QuizQuestionFeedbackProps) {
  const catalog = locale.toLowerCase().startsWith("ja") ? JA_MESSAGES : EN_MESSAGES;
  const resolved: QuizFeedbackLabels = {
    correct: labels?.correct ?? catalog["content.results.correct"],
    incorrect: labels?.incorrect ?? catalog["content.results.incorrect"],
    correctOption: labels?.correctOption ?? catalog["content.results.correctOption"]
  };
  const stateClass = question.correct ? classNames.quizQuestionCorrect : classNames.quizQuestionIncorrect;
  return (
    <div
      className={["fe-quiz-feedback", classNames.quizQuestion, stateClass, classNames.quizFeedback]
        .filter((value): value is string => value !== undefined)
        .join(" ")}
      data-quiz-result={question.correct ? "correct" : "incorrect"}
      aria-live="polite"
    >
      <div className={classNames.quizStatus} role="status">
        <span aria-hidden="true">{question.correct ? "✓" : "!"}</span>{" "}
        <span>{question.correct ? resolved.correct : resolved.incorrect}</span>
      </div>
      <div className={classNames.quizCorrectOption}>
        {resolved.correctOption}: {question.correctOption}
      </div>
      {question.explanation === undefined ? null : (
        <div className={classNames.quizExplanation}>{question.explanation}</div>
      )}
      <div className={classNames.quizPoints}>
        {question.earned} / {question.points}
      </div>
    </div>
  );
}

export interface QuizResultSummaryProps {
  readonly evaluation: QuizEvaluationResult;
  readonly schema: FormSchema;
  readonly locale?: string;
  readonly labels?: Partial<QuizSummaryLabels>;
  readonly className?: string;
}

export function QuizResultSummary({ evaluation, schema, locale = "en", labels, className }: QuizResultSummaryProps) {
  const catalog = locale.toLowerCase().startsWith("ja") ? JA_MESSAGES : EN_MESSAGES;
  const resolved: QuizSummaryLabels = {
    totalScore: labels?.totalScore ?? catalog["content.results.totalScore"],
    passed: labels?.passed ?? catalog["content.results.passed"],
    notPassed: labels?.notPassed ?? catalog["content.results.notPassed"]
  };
  const questionLabel = (questionId: string) =>
    schema?.fields.find((field) => field.id === questionId)?.title ?? questionId;
  return (
    <section className={["fe-quiz-summary", className].filter(Boolean).join(" ")} data-quiz-summary>
      <p>
        {resolved.totalScore}: {evaluation.totalScore} / {evaluation.maxPossibleScore}
      </p>
      {evaluation.isPassed === undefined ? null : <p>{evaluation.isPassed ? resolved.passed : resolved.notPassed}</p>}
      {evaluation.questions.map((question) => (
        <p key={question.questionId}>
          {questionLabel(question.questionId)}: {question.scoreEarned} / {question.maxScore}
        </p>
      ))}
      {evaluation.reward === undefined ? null : (
        <p data-quiz-reward>
          {resolved.reward ?? "Reward"}: {evaluation.reward.message ?? evaluation.reward.code ?? evaluation.reward.type}
        </p>
      )}
    </section>
  );
}

export interface PollResultViewProps {
  readonly schema: FormSchema;
  readonly analytics: FormAnalytics;
  readonly locale?: string;
  readonly labels?: Partial<PollResultLabels>;
  readonly classNames?: Pick<
    ContentRendererClassNames,
    "pollResults" | "pollResultOption" | "pollResultProgress" | "pollResultCount"
  >;
}

function pollItems(schema: FormSchema, analytics: FormAnalytics): readonly PollResultItem[] {
  const field = schema.fields[0];
  const aggregate = analytics.questions.find(
    (question): question is ChoiceQuestionAggregate =>
      question.fieldId === field?.id &&
      (question.kind === "radio" || question.kind === "select" || question.kind === "multi-select")
  );
  if (field === undefined || !("options" in field) || aggregate === undefined) return [];
  return field.options.map((option) => {
    const item = aggregate.options.find((candidate) => candidate.id === option.id);
    return {
      optionId: option.id,
      label: option.label,
      count: item?.count ?? 0,
      percentage: Math.min(100, Math.max(0, item?.percentageOfSubmissions ?? 0))
    };
  });
}

function pollResultItem(
  schema: FormSchema,
  analytics: FormAnalytics,
  optionId: string,
  checked: boolean
): PollResultItem | undefined {
  const item = pollItems(schema, analytics).find((candidate) => candidate.optionId === optionId);
  return item === undefined ? undefined : { ...item, checked };
}

export function PollResultOption({ item, locale, labels, classNames }: PollResultOptionProps) {
  const number = new Intl.NumberFormat(locale);
  return (
    <span
      className={["fe-poll-result-option", classNames.pollResultOption].filter(Boolean).join(" ")}
      data-poll-result-option
    >
      <progress
        className={classNames.pollResultProgress}
        value={item.percentage}
        max={100}
        aria-label={`${item.label}: ${item.percentage}%`}
      />
      <span className={classNames.pollResultCount}>
        {number.format(item.count)} {labels.votes} ({number.format(item.percentage)}%)
      </span>
    </span>
  );
}

export function PollResultView({ schema, analytics, locale = "en", labels, classNames = {} }: PollResultViewProps) {
  const catalog = locale.toLowerCase().startsWith("ja") ? JA_MESSAGES : EN_MESSAGES;
  const resolved: PollResultLabels = {
    title: labels?.title ?? catalog["content.results.pollResults"],
    votes: labels?.votes ?? catalog["content.results.votes"],
    loading: labels?.loading ?? catalog["content.results.loading"],
    retry: labels?.retry ?? catalog["content.results.retry"],
    loadError: labels?.loadError ?? catalog["content.results.loadError"]
  };
  const number = new Intl.NumberFormat(locale);
  return (
    <section className={["fe-poll-results", classNames.pollResults].filter(Boolean).join(" ")} data-poll-results>
      <h2>{resolved.title}</h2>
      <ul>
        {pollItems(schema, analytics).map((item) => (
          <li className={classNames.pollResultOption} key={item.optionId}>
            <span>{item.label}</span>
            <progress
              className={classNames.pollResultProgress}
              value={item.percentage}
              max={100}
              aria-label={`${item.label}: ${item.percentage}%`}
            />
            <span className={classNames.pollResultCount}>
              {number.format(item.count)} {resolved.votes} ({item.percentage}%)
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export interface PollResultsProps extends Omit<PollResultViewProps, "analytics"> {
  readonly adapter: PollRuntimeAdapter<FormAnalytics>;
  readonly submitted: boolean;
  readonly alreadyVoted?: boolean;
  readonly closed: boolean;
  readonly canViewResults: boolean;
  readonly submissionRevision?: number;
}

export function PollResults({
  schema,
  adapter,
  submitted,
  alreadyVoted,
  closed,
  canViewResults,
  submissionRevision,
  locale = "en",
  labels,
  classNames = {}
}: PollResultsProps) {
  const result = usePollResults({
    schema,
    adapter,
    submitted,
    ...(alreadyVoted === undefined ? {} : { alreadyVoted }),
    closed,
    canViewResults,
    ...(submissionRevision === undefined ? {} : { submissionRevision })
  });
  const catalog = locale.toLowerCase().startsWith("ja") ? JA_MESSAGES : EN_MESSAGES;
  if (!result.enabled) return null;
  if (result.loading) return <p role="status">{labels?.loading ?? catalog["content.results.loading"]}</p>;
  if (result.error !== undefined)
    return (
      <div role="alert">
        <p>{labels?.loadError ?? catalog["content.results.loadError"]}</p>
        <button type="button" onClick={result.reload}>
          {labels?.retry ?? catalog["content.results.retry"]}
        </button>
      </div>
    );
  return result.data === undefined ? null : (
    <PollResultView
      schema={schema}
      analytics={result.data}
      locale={locale}
      {...(labels === undefined ? {} : { labels })}
      classNames={classNames}
    />
  );
}

export interface ContentRendererOptions {
  readonly quiz?: {
    readonly showImmediateFeedback?: boolean;
    readonly feedbackLabels?: Partial<QuizFeedbackLabels>;
    readonly summaryLabels?: Partial<QuizSummaryLabels>;
  };
  readonly poll?: {
    readonly adapter: PollRuntimeAdapter<FormAnalytics>;
    readonly closed: boolean;
    readonly canViewResults: boolean;
    readonly alreadyVoted?: boolean;
    readonly submissionRevision?: number;
    readonly labels?: Partial<PollResultLabels>;
  };
}

export interface ContentRendererSlots extends FormRendererSlots {
  readonly renderPollResults?: (props: PollResultsProps) => ReactNode;
  readonly renderPollResultOption?: (props: PollResultOptionProps) => ReactNode;
  readonly renderPollResultsLoading?: (props: PollResultsLoadingProps) => ReactNode;
  readonly renderPollResultsError?: (props: PollResultsErrorProps) => ReactNode;
  readonly renderQuizFeedback?: (props: QuizQuestionFeedbackProps) => ReactNode;
  readonly renderQuizSummary?: (props: QuizResultSummaryProps) => ReactNode;
  readonly renderInvalidQuiz?: (issues: ReturnType<typeof getContentModeDiagnostics>) => ReactNode;
}

export type ContentRendererProps = FormRendererProps & {
  readonly classNames?: ContentRendererClassNames;
  readonly contentModeOptions?: ContentRendererOptions;
  readonly slots?: ContentRendererSlots;
};

export type TypedContentRendererProps<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata> =
  TypedFormRendererProps<TMeta> & {
    readonly classNames?: ContentRendererClassNames;
    readonly contentModeOptions?: ContentRendererOptions;
    readonly slots?: ContentRendererSlots;
  };

function questionResult(field: ChoiceGroupSlotProps["field"], answer: unknown): QuizQuestionResult | undefined {
  if (!("options" in field)) return undefined;
  const { correctOptionId, explanation, points = 1 } = readQuizFieldMetadata(field.metadata);
  return {
    fieldId: field.id,
    title: field.title,
    correct: answer === correctOptionId,
    correctOption: field.options.find((option) => option.id === correctOptionId)?.label ?? "",
    ...(explanation === undefined ? {} : { explanation }),
    points,
    earned: answer === correctOptionId ? points : 0
  };
}

interface PollResultsContextValue {
  readonly schema: FormSchema;
  readonly result: ReturnType<typeof usePollResults>;
  readonly locale: string;
  readonly labels: PollResultLabels;
  readonly classNames: ContentRendererClassNames;
  readonly renderOption?: ContentRendererSlots["renderPollResultOption"];
}

const PollResultsContext = createContext<PollResultsContextValue | undefined>(undefined);

function ContentPollResultOption({ option, checked }: ChoiceOptionAfterSlotProps) {
  const context = useContext(PollResultsContext);
  if (context === undefined || !context.result.enabled || context.result.data === undefined) return null;
  const item = pollResultItem(context.schema, context.result.data, option.id, checked) ?? {
    optionId: option.id,
    label: option.label,
    count: 0,
    percentage: 0,
    checked
  };
  const props: PollResultOptionProps = {
    item,
    locale: context.locale,
    labels: { votes: context.labels.votes },
    classNames: context.classNames
  };
  return context.renderOption?.(props) ?? <PollResultOption {...props} />;
}

function renderChoiceGroup(props: ChoiceGroupSlotProps, custom: ContentRendererSlots["renderChoiceGroup"]) {
  if (custom !== undefined) return <>{custom(props)}</>;
  return (
    <fieldset
      className={props.className}
      data-field-id={props.field.id}
      data-field-type={props.field.type}
      data-quiz-result={props.quizResult}
    >
      <legend>{props.title}</legend>
      {props.description === undefined ? null : <p>{props.description}</p>}
      {props.children}
      {props.error === undefined ? null : <p role="alert">{props.error.message}</p>}
    </fieldset>
  );
}

function PollChoiceGroup({
  props,
  options,
  custom,
  classNames,
  renderOption,
  renderLoading,
  renderError
}: {
  readonly props: ChoiceGroupSlotProps;
  readonly options: NonNullable<ContentRendererOptions["poll"]>;
  readonly custom: ContentRendererSlots["renderChoiceGroup"];
  readonly classNames: ContentRendererClassNames;
  readonly renderOption?: ContentRendererSlots["renderPollResultOption"];
  readonly renderLoading?: ContentRendererSlots["renderPollResultsLoading"];
  readonly renderError?: ContentRendererSlots["renderPollResultsError"];
}) {
  const form = useForm();
  const result = usePollResults({
    schema: form.schema,
    adapter: options.adapter,
    submitted: props.submitStatus === "submitting" || props.submitStatus === "success",
    ...(options.alreadyVoted === undefined ? {} : { alreadyVoted: options.alreadyVoted }),
    closed: options.closed,
    canViewResults: options.canViewResults,
    ...(options.submissionRevision === undefined ? {} : { submissionRevision: options.submissionRevision })
  });
  const optimisticVoteKey = useRef<string | undefined>(undefined);
  const optimisticData = useRef<ReturnType<typeof usePollResults>["data"]>(undefined);
  const previousSubmitStatus = useRef(props.submitStatus);
  const submittedAnswer =
    props.submittedValue !== undefined ? props.submittedValue : (props.value ?? form.values[props.field.id]);
  useEffect(() => {
    if (props.submitStatus === "error") {
      const hadOptimisticVote = optimisticVoteKey.current !== undefined;
      optimisticVoteKey.current = undefined;
      optimisticData.current = undefined;
      if (hadOptimisticVote && result.enabled) result.reload();
      return;
    }
    if (props.submitStatus !== "submitting" && props.submitStatus !== "success") {
      optimisticVoteKey.current = undefined;
      optimisticData.current = undefined;
      return;
    }
    const wasSubmitting = previousSubmitStatus.current === "submitting";
    previousSubmitStatus.current = props.submitStatus;
    if (props.submitStatus === "success" && wasSubmitting) {
      optimisticVoteKey.current = undefined;
      optimisticData.current = undefined;
      result.reload();
      return;
    }
    if (props.submitStatus === "success") return;
    const selectedOptionIds = Array.isArray(submittedAnswer)
      ? submittedAnswer.filter((value): value is string => typeof value === "string")
      : typeof submittedAnswer === "string"
        ? [submittedAnswer]
        : [];
    const key = selectedOptionIds.join("\u0000");
    if (optimisticVoteKey.current !== key) {
      optimisticVoteKey.current = key;
      optimisticData.current = undefined;
      result.applyOptimisticVote(selectedOptionIds);
      return;
    }
    if (result.data !== undefined && optimisticData.current !== result.data) {
      if (optimisticData.current !== undefined) {
        optimisticData.current = undefined;
        result.applyOptimisticVote(selectedOptionIds);
        return;
      }
      optimisticData.current = result.data;
    }
  }, [props.submitStatus, result.applyOptimisticVote, result.data, result.enabled, result.reload, submittedAnswer]);
  const catalog = form.locale.toLowerCase().startsWith("ja") ? JA_MESSAGES : EN_MESSAGES;
  const labels: PollResultLabels = {
    title: options.labels?.title ?? catalog["content.results.pollResults"],
    votes: options.labels?.votes ?? catalog["content.results.votes"],
    loading: options.labels?.loading ?? catalog["content.results.loading"],
    retry: options.labels?.retry ?? catalog["content.results.retry"],
    loadError: options.labels?.loadError ?? catalog["content.results.loadError"]
  };
  const contextValue: PollResultsContextValue = {
    schema: form.schema,
    result,
    locale: form.locale,
    labels,
    classNames,
    renderOption
  };
  let status: ReactNode = null;
  if (result.enabled && result.loading) {
    const loadingProps: PollResultsLoadingProps = { locale: form.locale, label: labels.loading };
    status = renderLoading?.(loadingProps) ?? <p role="status">{labels.loading}</p>;
  } else if (result.enabled && result.error !== undefined) {
    const errorProps: PollResultsErrorProps = {
      error: result.error,
      onRetry: result.reload,
      locale: form.locale,
      labels: { retry: labels.retry, loadError: labels.loadError }
    };
    status = renderError?.(errorProps) ?? (
      <div role="alert">
        <p>{labels.loadError}</p>
        <button type="button" onClick={result.reload}>
          {labels.retry}
        </button>
      </div>
    );
  }
  return renderChoiceGroup(
    {
      ...props,
      children: (
        <>
          <PollResultsContext.Provider value={contextValue}>{props.children}</PollResultsContext.Provider>
          {status}
        </>
      )
    },
    custom
  );
}

function ContentChoiceGroup({
  props,
  options,
  custom,
  renderFeedback,
  classNames,
  inlinePollResults,
  renderOption,
  renderLoading,
  renderError
}: {
  readonly props: ChoiceGroupSlotProps;
  readonly options: ContentRendererOptions | undefined;
  readonly custom: ContentRendererSlots["renderChoiceGroup"];
  readonly renderFeedback?: ContentRendererSlots["renderQuizFeedback"];
  readonly classNames: ContentRendererClassNames;
  readonly inlinePollResults: boolean;
  readonly renderOption?: ContentRendererSlots["renderPollResultOption"];
  readonly renderLoading?: ContentRendererSlots["renderPollResultsLoading"];
  readonly renderError?: ContentRendererSlots["renderPollResultsError"];
}) {
  const form = useForm();
  const mode = getFormContentMode(form.schema.metadata);
  const quiz = options?.quiz;
  const metadata = readQuizMetadata(form.schema.metadata);
  const answer =
    props.submitStatus === "success" && props.submittedValue !== undefined ? props.submittedValue : props.value;
  const feedback =
    mode === "quiz" && getContentModeDiagnostics(form.schema).length === 0
      ? questionResult(props.field, answer)
      : undefined;
  const visible =
    feedback !== undefined &&
    answer !== undefined &&
    ((props.submitStatus === "success" && props.submittedValue !== undefined) ||
      (quiz?.showImmediateFeedback !== false && metadata.showExplanation === "immediate"));
  const feedbackProps =
    feedback === undefined
      ? undefined
      : {
          question: feedback,
          locale: form.locale,
          ...(quiz?.feedbackLabels === undefined ? {} : { labels: quiz.feedbackLabels }),
          classNames
        };
  const feedbackNode =
    visible && feedbackProps !== undefined
      ? (renderFeedback?.(feedbackProps) ?? <QuizQuestionFeedback {...feedbackProps} />)
      : null;
  const questionClassName =
    visible && feedback !== undefined
      ? [classNames.quizQuestion, feedback.correct ? classNames.quizQuestionCorrect : classNames.quizQuestionIncorrect]
          .filter((value): value is string => value !== undefined)
          .join(" ")
      : undefined;
  const children = (
    <>
      {props.children}
      {feedbackNode}
    </>
  );
  const nextProps: ChoiceGroupSlotProps = {
    ...props,
    ...(questionClassName === undefined
      ? {}
      : { className: [props.className, questionClassName].filter(Boolean).join(" ") }),
    ...(feedback !== undefined && visible
      ? { quizResult: feedback.correct ? ("correct" as const) : ("incorrect" as const) }
      : {}),
    children
  };
  if (mode === "poll" && options?.poll !== undefined && inlinePollResults)
    return (
      <PollChoiceGroup
        props={nextProps}
        options={options.poll}
        custom={custom}
        classNames={classNames}
        renderOption={renderOption}
        renderLoading={renderLoading}
        renderError={renderError}
      />
    );
  return renderChoiceGroup(nextProps, custom);
}

function InvalidContent({
  issues,
  renderInvalid,
  locale
}: {
  readonly issues: ReturnType<typeof getContentModeDiagnostics>;
  readonly renderInvalid?: ContentRendererSlots["renderInvalidQuiz"];
  readonly locale: string;
}) {
  if (renderInvalid !== undefined) return <>{renderInvalid(issues)}</>;
  const catalog = locale.toLowerCase().startsWith("ja") ? JA_MESSAGES : EN_MESSAGES;
  return <div role="alert">{catalog["content.results.invalidQuiz"]}</div>;
}

function ContentRendererImplementation(props: ContentRendererProps | TypedContentRendererProps) {
  const { contentModeOptions, classNames = {}, slots = {}, ...rendererProps } = props;
  const appearance = rendererProps.appearance;
  const inlinePollResults = slots.renderPollResults === undefined && slots.renderAfterForm === undefined;
  const standardSlots: FormRendererSlots = {
    ...slots,
    renderChoiceOptionAfter: (optionProps) => (
      <>
        {slots.renderChoiceOptionAfter?.(optionProps)}
        {inlinePollResults ? <ContentPollResultOption {...optionProps} /> : null}
      </>
    ),
    renderChoiceGroup: (choiceProps) => (
      <ContentChoiceGroup
        props={choiceProps}
        options={contentModeOptions}
        custom={slots.renderChoiceGroup}
        renderFeedback={slots.renderQuizFeedback}
        classNames={classNames}
        inlinePollResults={inlinePollResults}
        renderOption={slots.renderPollResultOption}
        renderLoading={slots.renderPollResultsLoading}
        renderError={slots.renderPollResultsError}
      />
    )
  };
  const renderAfterForm: NonNullable<FormRendererSlots["renderAfterForm"]> = (state) => {
    const mode = getFormContentMode(state.schema.metadata);
    const locale = state.schema.defaultLocale ?? "en";
    if (mode === "poll" && contentModeOptions?.poll !== undefined) {
      const pollProps: PollResultsProps = {
        schema: state.schema,
        ...contentModeOptions.poll,
        submitted: state.submitStatus === "success",
        locale,
        classNames
      };
      return slots.renderPollResults?.(pollProps) ?? null;
    }
    if (mode !== "quiz") return null;
    const issues = getContentModeDiagnostics(state.schema);
    if (issues.length > 0)
      return <InvalidContent issues={issues} renderInvalid={slots.renderInvalidQuiz} locale={locale} />;
    if (state.submitStatus !== "success") return null;
    const evaluation = state.response?.quizEvaluation ?? evaluateQuizLocally(state.schema, state.answers as FormValues);
    const summaryProps: QuizResultSummaryProps = {
      evaluation,
      schema: state.schema,
      locale,
      ...(contentModeOptions?.quiz?.summaryLabels === undefined
        ? {}
        : { labels: contentModeOptions.quiz.summaryLabels }),
      ...(classNames.quizSummary === undefined ? {} : { className: classNames.quizSummary })
    };
    return slots.renderQuizSummary?.(summaryProps) ?? <QuizResultSummary {...summaryProps} />;
  };
  const finalSlots: ContentRendererSlots =
    slots.renderAfterForm === undefined ? { ...standardSlots, renderAfterForm } : standardSlots;
  return (
    <FormRenderer
      {...(rendererProps as FormRendererProps)}
      appearance={{ ...appearance, choiceField: appearance?.choiceField ?? "grouped" }}
      classNames={classNames}
      slots={finalSlots}
    />
  );
}

export function ContentRenderer(props: ContentRendererProps): React.JSX.Element;
export function ContentRenderer<TMeta extends BaseSubmissionMetadata>(
  props: TypedContentRendererProps<TMeta>
): React.JSX.Element;
export function ContentRenderer(props: ContentRendererProps | TypedContentRendererProps) {
  return <ContentRendererImplementation {...props} />;
}
