import type { FormAnalytics, FormSchema, PollRuntimeAdapter } from "@form-engine-ts/core";
import { toSurveyResponseSummary } from "@form-engine-ts/custom-survey-client";
import { MuiSurveyResponseSummary } from "@form-engine-ts/mui";
import { usePollResults } from "@form-engine-ts/react";
import { Alert, Button } from "@mui/material";
export interface PollResultsProps {
  readonly schema: FormSchema;
  readonly locale: string;
  readonly adapter: PollRuntimeAdapter<FormAnalytics>;
  readonly submitted: boolean;
  readonly closed: boolean;
  readonly canViewResults: boolean;
  readonly revision: number;
}
export function PollResults(props: PollResultsProps) {
  const result = usePollResults({ ...props, submissionRevision: props.revision });
  const ja = props.locale.startsWith("ja");
  if (!result.enabled) return null;
  if (result.error)
    return (
      <Alert severity="error">
        {result.error.message}
        <Button onClick={result.reload}>{ja ? "集計を再取得" : "Retry results"}</Button>
      </Alert>
    );
  if (result.loading || !result.data) return <p role="status">{ja ? "集計中" : "Loading results"}</p>;
  return (
    <MuiSurveyResponseSummary
      data={toSurveyResponseSummary(result.data, props.schema, props.locale)}
      locale={props.locale}
    />
  );
}
