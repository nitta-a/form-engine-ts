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
import { ContentRenderer, type ContentRendererClassNames, FormProvider } from "@form-engine-ts/react";
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
    readonly rendererKind: "mui" | "tailwind";
  }
) {
  const contentModeOptions = {
    poll: {
      adapter: props.adapter,
      closed: props.closed,
      canViewResults: props.canViewResults,
      submissionRevision: props.revision
    }
  };
  if (props.rendererKind === "mui") {
    return (
      <MuiContentRenderer
        i18n={{ locale: props.locale }}
        contentModeOptions={contentModeOptions}
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
  const classNames: ContentRendererClassNames = {
    form: "mx-auto grid max-w-2xl gap-6 rounded-xl bg-white p-6 shadow-sm",
    header: "grid gap-2",
    headerTitle: "text-2xl font-bold text-slate-900",
    headerDescription: "text-slate-600",
    pageHeader: "grid gap-1",
    pageTitle: "text-xl font-semibold text-slate-900",
    fields: "grid gap-5",
    field: "grid gap-2",
    fieldLabel: "font-medium text-slate-800",
    fieldInput:
      "rounded-md border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200",
    choiceGroup: "grid gap-3 rounded-lg border border-slate-200 p-4",
    choiceLegend: "font-medium text-slate-800",
    choiceOptions: "grid gap-2",
    choiceOption: "flex items-center gap-2 rounded-md p-2 hover:bg-slate-50",
    help: "text-sm text-slate-500",
    error: "text-sm text-red-700",
    navigation: "flex flex-wrap gap-3",
    previousButton: "rounded-md border border-slate-300 px-4 py-2",
    nextButton: "rounded-md bg-slate-800 px-4 py-2 text-white",
    submitButton: "rounded-md bg-blue-600 px-4 py-2 font-medium text-white",
    status: "grid gap-3",
    completion: "rounded-lg bg-emerald-50 p-4 text-emerald-900",
    pollResults: "grid gap-3 rounded-lg border border-slate-200 p-4",
    pollResultOption: "grid gap-1",
    pollResultProgress: "w-full accent-blue-600",
    quizQuestionCorrect: "border-emerald-500 bg-emerald-50",
    quizQuestionIncorrect: "border-red-500 bg-red-50",
    quizFeedback: "rounded-md border p-3 text-sm",
    quizStatus: "font-semibold",
    quizSummary: "rounded-lg bg-slate-50 p-4"
  };
  return (
    <ContentRenderer
      contentModeOptions={contentModeOptions}
      classNames={classNames}
      slots={{
        renderSubmitError: ({ error, onRetry }) => (
          <div className="rounded-md border border-red-300 bg-red-50 p-3 text-red-800" role="alert">
            <span>{error.message}</span>{" "}
            <button className="underline" type="button" onClick={onRetry}>
              {props.locale.startsWith("ja") ? "再送信" : "Retry submission"}
            </button>
          </div>
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
  const [rendererKind, setRendererKind] = useState<"mui" | "tailwind">("mui");
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
      <fieldset className="renderer-demo-controls">
        <legend>{ja ? "回答UI" : "Answer UI"}</legend>
        <label>
          <input
            type="radio"
            name={`renderer-${schema.id}`}
            checked={rendererKind === "mui"}
            onChange={() => setRendererKind("mui")}
          />{" "}
          MUI
        </label>
        <label>
          <input
            type="radio"
            name={`renderer-${schema.id}`}
            checked={rendererKind === "tailwind"}
            onChange={() => setRendererKind("tailwind")}
          />{" "}
          Tailwind
        </label>
      </fieldset>
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
          rendererKind={rendererKind}
        />
      </FormProvider>
    </Stack>
  );
}
