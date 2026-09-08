import type { FormSchema, QuizEvaluationResult, QuizQuestionEvaluation } from "@form-engine-ts/core";
import {
  Card,
  CardContent,
  type CardContentProps,
  type CardProps,
  Stack,
  type StackProps,
  Typography,
  type TypographyProps
} from "@mui/material";
import { Fragment, type ReactNode } from "react";
import { muiContentTranslation } from "./contentTranslation";
import type { MuiComponentSlotProps, MuiFormEngineI18nOptions } from "./types";

export interface QuizResultViewLabels {
  readonly totalScore: string;
  readonly passed: string;
  readonly notPassed: string;
  readonly correct: string;
  readonly incorrect: string;
  readonly correctOption: string;
  readonly reward?: string;
}

export interface QuizResultViewSlots {
  readonly score?: (evaluation: QuizEvaluationResult) => ReactNode;
  readonly status?: (passed: boolean) => ReactNode;
  readonly question?: (question: QuizQuestionEvaluation) => ReactNode;
  readonly reward?: (reward: NonNullable<QuizEvaluationResult["reward"]>) => ReactNode;
}

export interface QuizResultViewSlotProps {
  readonly root?: MuiComponentSlotProps<StackProps>;
  readonly score?: MuiComponentSlotProps<TypographyProps>;
  readonly status?: MuiComponentSlotProps<TypographyProps>;
  readonly questionCard?: MuiComponentSlotProps<CardProps>;
  readonly questionContent?: MuiComponentSlotProps<CardContentProps>;
  readonly questionTitle?: MuiComponentSlotProps<TypographyProps>;
  readonly questionStatus?: MuiComponentSlotProps<TypographyProps>;
  readonly correctOption?: MuiComponentSlotProps<TypographyProps>;
  readonly explanation?: MuiComponentSlotProps<TypographyProps>;
  readonly points?: MuiComponentSlotProps<TypographyProps>;
  readonly reward?: MuiComponentSlotProps<CardProps>;
  readonly rewardContent?: MuiComponentSlotProps<CardContentProps>;
}

export interface QuizResultViewProps {
  readonly evaluation: QuizEvaluationResult;
  readonly schema?: FormSchema;
  readonly locale?: string;
  readonly labels?: Partial<QuizResultViewLabels>;
  readonly slots?: QuizResultViewSlots;
  readonly slotProps?: QuizResultViewSlotProps;
  readonly i18n?: MuiFormEngineI18nOptions;
}

function optionLabel(schema: FormSchema | undefined, questionId: string, optionId: string | undefined): string {
  if (optionId === undefined) return "";
  const field = schema?.fields.find((candidate) => candidate.id === questionId);
  return field !== undefined && "options" in field
    ? (field.options.find((option) => option.id === optionId)?.label ?? optionId)
    : optionId;
}

function rewardTitle(type: NonNullable<QuizEvaluationResult["reward"]>["type"]): string {
  return type === "coupon" ? "Coupon" : type === "badge" ? "Badge" : "Reward";
}

export function QuizResultView({
  evaluation,
  schema,
  locale = "en",
  labels,
  slots = {},
  slotProps = {},
  i18n
}: QuizResultViewProps) {
  const { translate: t } = muiContentTranslation(locale, i18n);
  const resolvedLabels: QuizResultViewLabels = {
    totalScore: labels?.totalScore ?? t("content.results.totalScore"),
    passed: labels?.passed ?? t("content.results.passed"),
    notPassed: labels?.notPassed ?? t("content.results.notPassed"),
    correct: labels?.correct ?? t("content.results.correct"),
    incorrect: labels?.incorrect ?? t("content.results.incorrect"),
    correctOption: labels?.correctOption ?? t("content.results.correctOption"),
    reward: labels?.reward ?? "Reward"
  };
  return (
    <Stack {...slotProps.root} spacing={slotProps.root?.spacing ?? 2}>
      {slots.score?.(evaluation) ?? (
        <Typography {...slotProps.score}>
          {resolvedLabels.totalScore}: {evaluation.totalScore} / {evaluation.maxPossibleScore}
        </Typography>
      )}
      {evaluation.isPassed === undefined
        ? null
        : (slots.status?.(evaluation.isPassed) ?? (
            <Typography {...slotProps.status}>
              {evaluation.isPassed ? resolvedLabels.passed : resolvedLabels.notPassed}
            </Typography>
          ))}
      {evaluation.questions.map((question) => (
        <Fragment key={question.questionId}>
          {slots.question?.(question) ?? (
            <Card {...slotProps.questionCard}>
              <CardContent {...slotProps.questionContent}>
                <Typography {...slotProps.questionTitle} component={slotProps.questionTitle?.component ?? "h3"}>
                  {schema?.fields.find((field) => field.id === question.questionId)?.title ?? question.questionId}
                </Typography>
                <Typography {...slotProps.questionStatus}>
                  {question.isCorrect ? resolvedLabels.correct : resolvedLabels.incorrect}
                </Typography>
                {question.correctOptionId === undefined ? null : (
                  <Typography {...slotProps.correctOption}>
                    {resolvedLabels.correctOption}: {optionLabel(schema, question.questionId, question.correctOptionId)}
                  </Typography>
                )}
                {question.explanation === undefined ? null : (
                  <Typography {...slotProps.explanation}>{question.explanation}</Typography>
                )}
                <Typography {...slotProps.points}>
                  {question.scoreEarned} / {question.maxScore}
                </Typography>
              </CardContent>
            </Card>
          )}
        </Fragment>
      ))}
      {evaluation.reward === undefined
        ? null
        : (slots.reward?.(evaluation.reward) ?? (
            <Card {...slotProps.reward} data-quiz-reward>
              <CardContent {...slotProps.rewardContent}>
                <Typography component="h3">{resolvedLabels.reward}</Typography>
                <Typography>{rewardTitle(evaluation.reward.type)}</Typography>
                {evaluation.reward.code === undefined ? null : <Typography>{evaluation.reward.code}</Typography>}
                {evaluation.reward.message === undefined ? null : <Typography>{evaluation.reward.message}</Typography>}
              </CardContent>
            </Card>
          ))}
    </Stack>
  );
}
