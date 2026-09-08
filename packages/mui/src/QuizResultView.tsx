import type { QuizQuestionResult, QuizResult } from "@form-engine-ts/core";
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
}

export interface QuizResultViewSlots {
  readonly score?: (result: QuizResult) => ReactNode;
  readonly status?: (passed: boolean) => ReactNode;
  readonly question?: (question: QuizQuestionResult) => ReactNode;
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
}

export interface QuizResultViewProps {
  readonly result: QuizResult;
  readonly locale?: string;
  readonly showScore?: boolean;
  readonly labels?: Partial<QuizResultViewLabels>;
  readonly slots?: QuizResultViewSlots;
  readonly slotProps?: QuizResultViewSlotProps;
  readonly i18n?: MuiFormEngineI18nOptions;
}

export function QuizResultView({
  result,
  locale = "en",
  showScore = true,
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
    correctOption: labels?.correctOption ?? t("content.results.correctOption")
  };
  return (
    <Stack {...slotProps.root} spacing={slotProps.root?.spacing ?? 2}>
      {showScore
        ? (slots.score?.(result) ?? (
            <Typography {...slotProps.score}>
              {resolvedLabels.totalScore}: {result.score} / {result.total}
            </Typography>
          ))
        : null}
      {!showScore || result.passed === undefined
        ? null
        : (slots.status?.(result.passed) ?? (
            <Typography {...slotProps.status}>
              {result.passed ? resolvedLabels.passed : resolvedLabels.notPassed}
            </Typography>
          ))}
      {result.questions.map((question) => (
        <Fragment key={question.fieldId}>
          {slots.question?.(question) ?? (
            <Card {...slotProps.questionCard}>
              <CardContent {...slotProps.questionContent}>
                <Typography {...slotProps.questionTitle} component={slotProps.questionTitle?.component ?? "h3"}>
                  {question.title}
                </Typography>
                <Typography {...slotProps.questionStatus}>
                  {question.correct ? resolvedLabels.correct : resolvedLabels.incorrect}
                </Typography>
                <Typography {...slotProps.correctOption}>
                  {resolvedLabels.correctOption}: {question.correctOption}
                </Typography>
                {question.explanation ? (
                  <Typography {...slotProps.explanation}>{question.explanation}</Typography>
                ) : null}
                <Typography {...slotProps.points}>
                  {question.earned} / {question.points}
                </Typography>
              </CardContent>
            </Card>
          )}
        </Fragment>
      ))}
    </Stack>
  );
}
