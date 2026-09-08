import {
  aggregateResponses,
  createSubmission,
  type FormAnalytics,
  type FormSchema,
  type FormStorageAdapter,
  getFormContentMode,
  type PollRuntimeAdapter,
  readPollMetadata
} from "@form-engine-ts/core";
import { MuiContentRenderer } from "@form-engine-ts/mui/renderer";
import { FormProvider } from "@form-engine-ts/react";
import { mockTranslator } from "@form-engine-ts/translator-mock";
import { Alert, Button, Checkbox, FormControlLabel, Stack } from "@mui/material";
import { useMemo, useRef, useState } from "react";

function browserIdentity(formId: string) {
  const key = `form-engine-preview_identity:${formId}`;
  const stored = localStorage.getItem(key);
  if (stored) return stored;
  const value = crypto.randomUUID();
  localStorage.setItem(key, value);
  return value;
}

export interface ContentAnswerProps {
  readonly schema: FormSchema;
  readonly locale: string;
  readonly storage: FormStorageAdapter;
}
function AnswerBody(
  props: ContentAnswerProps & {
    readonly adapter: PollRuntimeAdapter<FormAnalytics>;
    readonly closed: boolean;
    readonly canViewResults: boolean;
    readonly revision: number;
  }
) {
  return (
    <MuiContentRenderer
      i18n={{ locale: props.locale }}
      contentModeOptions={{
        poll: {
          adapter: props.adapter,
          closed: props.closed,
          canViewResults: props.canViewResults,
          submissionRevision: props.revision
        }
      }}
      slots={{
        renderSubmitError: ({ error, onRetry }) => (
          <Alert severity="error">
            {error.message}
            <Button onClick={onRetry}>{props.locale.startsWith("ja") ? "再送信" : "Retry submission"}</Button>
          </Alert>
        )
      }}
    />
  );
}
export function ContentAnswer({ schema, locale, storage }: ContentAnswerProps) {
  const [closed, setClosed] = useState(false);
  const [canViewResults, setCanViewResults] = useState(true);
  const [failResults, setFailResults] = useState(false);
  const [failSubmit, setFailSubmit] = useState(false);
  const [revision, setRevision] = useState(0);
  const submitting = useRef(false);
  const ja = locale.startsWith("ja");
  const mode = getFormContentMode(schema.metadata);
  const adapter = useMemo<PollRuntimeAdapter<FormAnalytics>>(
    () => ({
      loadResults: async (current, signal) => {
        if (failResults) throw new Error(ja ? "集計の取得に失敗しました" : "Results request failed");
        const submissions = await storage.listSubmissions(current.id, current.version);
        signal.throwIfAborted();
        return aggregateResponses(current, submissions);
      },
      canVote: async (current) => {
        if (closed) return false;
        if (!readPollMetadata(current.metadata).strictOneVotePerUser) return true;
        const voter = browserIdentity(current.id);
        const records = await storage.listSchemas();
        const versions = records.filter((item) => item.id === current.id);
        const groups = await Promise.all(versions.map((item) => storage.listSubmissions(item.id, item.version)));
        return !groups.flat().some((item) => item.metadata?.voter === voter);
      }
    }),
    [storage, closed, failResults, ja]
  );
  return (
    <Stack spacing={2}>
      {mode === "poll" ? (
        <>
          <FormControlLabel
            label={ja ? "締切済み" : "Closed"}
            control={<Checkbox checked={closed} onChange={(_, checked) => setClosed(checked)} />}
          />
          <FormControlLabel
            label={ja ? "結果の閲覧権限" : "Result access"}
            control={<Checkbox checked={canViewResults} onChange={(_, checked) => setCanViewResults(checked)} />}
          />
          <FormControlLabel
            label={ja ? "集計エラーを再現" : "Simulate results error"}
            control={<Checkbox checked={failResults} onChange={(_, checked) => setFailResults(checked)} />}
          />
          <p>
            {ja
              ? "一人一票のデモはこのブラウザー内で再現します。"
              : "One-vote enforcement in this demo is limited to this browser."}
          </p>
        </>
      ) : null}
      <FormControlLabel
        label={ja ? "送信エラーを再現" : "Simulate submission error"}
        control={<Checkbox checked={failSubmit} onChange={(_, checked) => setFailSubmit(checked)} />}
      />
      <FormProvider
        schema={schema}
        locale={locale}
        translator={mockTranslator}
        onSubmit={async (values, context) => {
          if (submitting.current) throw new Error("Submission in progress");
          submitting.current = true;
          try {
            if (failSubmit) throw new Error(ja ? "送信に失敗しました" : "Submission failed");
            if (mode === "poll" && !(await adapter.canVote(schema)))
              throw new Error(ja ? "締切済み、または投票済みです" : "Voting is closed or you have already voted");
            const submission = createSubmission(schema, values, {
              id: crypto.randomUUID(),
              locale,
              submittedAt: context.submittedAt,
              metadata: { source: "preview", voter: browserIdentity(schema.id) }
            });
            await storage.saveSubmission(submission);
            setRevision((current) => current + 1);
          } finally {
            submitting.current = false;
          }
        }}
      >
        <AnswerBody
          schema={schema}
          locale={locale}
          storage={storage}
          adapter={adapter}
          closed={closed}
          canViewResults={canViewResults}
          revision={revision}
        />
      </FormProvider>
    </Stack>
  );
}
