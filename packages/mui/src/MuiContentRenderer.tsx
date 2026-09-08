import {
  type BaseSubmissionMetadata,
  evaluateQuiz,
  type FormAnalytics,
  getContentModeDiagnostics,
  getFormContentMode,
  type PollRuntimeAdapter,
  readQuizMetadata
} from "@form-engine-ts/core";
import {
  FormEngineI18nProvider,
  FormRenderer,
  type FormRendererProps,
  type FormRendererSlots,
  type FormSubmissionMetadata,
  type TypedFormRendererProps
} from "@form-engine-ts/react";
import { Alert } from "@mui/material";
import type { ReactNode } from "react";
import { muiContentTranslation } from "./contentTranslation";
import { MuiFormBuilderContext } from "./context";
import { MuiPollResults, type MuiPollResultsSlotProps, type MuiPollResultsSlots } from "./MuiPollResults";
import { QuizResultView, type QuizResultViewProps } from "./QuizResultView";
import { MuiChoiceGroupSlot } from "./slots";
import type { MuiAdapterOptions, MuiFormEngineI18nOptions } from "./types";

export interface MuiQuizRendererOptions {
  readonly showImmediateFeedback?: boolean;
  readonly resultViewProps?: Omit<QuizResultViewProps, "result" | "locale" | "i18n">;
  readonly renderInvalid?: (issues: ReturnType<typeof getContentModeDiagnostics>) => ReactNode;
}

export interface MuiPollRendererOptions {
  readonly adapter: PollRuntimeAdapter<FormAnalytics>;
  readonly closed: boolean;
  readonly canViewResults: boolean;
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
}

export type MuiContentRendererProps = FormRendererProps & MuiContentRendererOwnProps;
export type TypedMuiContentRendererProps<TMeta extends BaseSubmissionMetadata = FormSubmissionMetadata> =
  TypedFormRendererProps<TMeta> & MuiContentRendererOwnProps;

interface ContentModeAfterFormProps {
  readonly schema: Parameters<NonNullable<FormRendererSlots["renderAfterForm"]>>[0]["schema"];
  readonly answers: Readonly<Record<string, unknown>>;
  readonly submitStatus: Parameters<NonNullable<FormRendererSlots["renderAfterForm"]>>[0]["submitStatus"];
  readonly locale: string;
  readonly options: MuiContentRendererOptions | undefined;
  readonly i18n: MuiFormEngineI18nOptions | undefined;
}

function InvalidQuiz({
  locale,
  options,
  issues,
  i18n
}: {
  readonly locale: string;
  readonly options: MuiQuizRendererOptions | undefined;
  readonly issues: ReturnType<typeof getContentModeDiagnostics>;
  readonly i18n: MuiFormEngineI18nOptions | undefined;
}) {
  if (options?.renderInvalid !== undefined) return <>{options.renderInvalid(issues)}</>;
  const { translate: t } = muiContentTranslation(locale, i18n);
  return <Alert severity="error">{t("content.results.invalidQuiz")}</Alert>;
}

function ContentModeAfterForm({ schema, answers, submitStatus, locale, options, i18n }: ContentModeAfterFormProps) {
  const mode = getFormContentMode(schema.metadata);
  if (mode === "poll" && options?.poll !== undefined) {
    return (
      <MuiPollResults
        schema={schema}
        adapter={options.poll.adapter}
        submitted={submitStatus === "success"}
        closed={options.poll.closed}
        canViewResults={options.poll.canViewResults}
        {...(options.poll.submissionRevision === undefined
          ? {}
          : { submissionRevision: options.poll.submissionRevision })}
        locale={locale}
        {...(i18n === undefined ? {} : { i18n })}
        {...(options.poll.slots === undefined ? {} : { slots: options.poll.slots })}
        {...(options.poll.slotProps === undefined ? {} : { slotProps: options.poll.slotProps })}
      />
    );
  }
  if (
    mode !== "quiz" ||
    options?.quiz?.showImmediateFeedback === false ||
    readQuizMetadata(schema.metadata).showExplanation !== "immediate" ||
    submitStatus === "success"
  )
    return null;
  const issues = getContentModeDiagnostics(schema);
  if (issues.length > 0) return <InvalidQuiz locale={locale} options={options?.quiz} issues={issues} i18n={i18n} />;
  const result = evaluateQuiz(schema, answers);
  const questions = result.questions.filter((question) => answers[question.fieldId] !== undefined);
  if (questions.length === 0) return null;
  return (
    <div aria-live="polite">
      <QuizResultView
        {...options?.quiz?.resultViewProps}
        result={{ ...result, questions }}
        locale={locale}
        {...(i18n === undefined ? {} : { i18n })}
        showScore={false}
      />
    </div>
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
  const resolvedSlots: FormRendererSlots = {
    ...slots,
    renderChoiceGroup: slots?.renderChoiceGroup ?? MuiChoiceGroupSlot,
    renderCompletion:
      slots?.renderCompletion ??
      ((completion) => {
        if (getFormContentMode(completion.schema.metadata) !== "quiz") return <div>{completion.message}</div>;
        const issues = getContentModeDiagnostics(completion.schema);
        return (
          <>
            <div>{completion.message}</div>
            {issues.length > 0 ? (
              <InvalidQuiz locale={locale} options={contentModeOptions?.quiz} issues={issues} i18n={i18n} />
            ) : (
              <QuizResultView
                {...contentModeOptions?.quiz?.resultViewProps}
                result={evaluateQuiz(completion.schema, completion.answers)}
                locale={locale}
                {...(i18n === undefined ? {} : { i18n })}
              />
            )}
          </>
        );
      }),
    renderAfterForm:
      slots?.renderAfterForm ??
      ((state) => (
        <ContentModeAfterForm
          schema={state.schema}
          answers={state.answers}
          submitStatus={state.submitStatus}
          locale={locale}
          options={contentModeOptions}
          i18n={i18n}
        />
      ))
  };
  const content = (
    <MuiFormBuilderContext.Provider value={{ options: muiOptions ?? {} }}>
      <FormRenderer {...(rendererProps as FormRendererProps)} slots={resolvedSlots} />
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
