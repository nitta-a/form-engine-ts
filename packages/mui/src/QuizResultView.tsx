import type { QuizResult } from "@form-engine-ts/core";
import { Card, CardContent, Stack, Typography } from "@mui/material";
export interface QuizResultViewProps {
  readonly result: QuizResult;
  readonly locale?: string;
  readonly showScore?: boolean;
}
export function QuizResultView({ result, locale = "en", showScore = true }: QuizResultViewProps) {
  const ja = locale.startsWith("ja");
  return (
    <Stack spacing={2}>
      {showScore ? (
        <Typography>
          {ja ? "合計得点" : "Total score"}: {result.score} / {result.total}
        </Typography>
      ) : null}
      {!showScore || result.passed === undefined ? null : (
        <Typography>{result.passed ? (ja ? "合格" : "Passed") : ja ? "不合格" : "Not passed"}</Typography>
      )}
      {result.questions.map((question) => (
        <Card key={question.fieldId}>
          <CardContent>
            <Typography component="h3">{question.title}</Typography>
            <Typography>{question.correct ? (ja ? "正解" : "Correct") : ja ? "不正解" : "Incorrect"}</Typography>
            <Typography>
              {ja ? "正解の選択肢" : "Correct option"}: {question.correctOption}
            </Typography>
            {question.explanation ? <Typography>{question.explanation}</Typography> : null}
            <Typography>
              {question.earned} / {question.points}
            </Typography>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
