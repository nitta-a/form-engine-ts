import {
  type FormSchema,
  getContentModePolicy,
  getFormContentMode,
  validateContentMode,
  validateFormSchema
} from "@form-engine-ts/core";
import { SurveyEditor } from "@form-engine-ts/custom-survey-client";
import {
  ContentModeSettings,
  createMuiBuilderComponents,
  QuizFieldEditor,
  QuizOptionEditor
} from "@form-engine-ts/mui";
import { Alert, Button, Stack } from "@mui/material";
import { useState } from "react";
export interface ContentEditorProps {
  readonly schema: FormSchema;
  readonly locale: string;
  readonly save: (schema: FormSchema) => Promise<void>;
  readonly onAnswer: (schema: FormSchema) => void;
}
const components = createMuiBuilderComponents();
export function ContentEditor({ schema, locale, save, onAnswer }: ContentEditorProps) {
  const [draft, setDraft] = useState(schema);
  const [saved, setSaved] = useState(schema);
  const mode = getFormContentMode(draft.metadata);
  const issues = [...validateContentMode(draft), ...validateFormSchema(draft).issues];
  const ja = locale.startsWith("ja");
  return (
    <Stack spacing={2}>
      {issues.map((issue) => (
        <Alert severity="warning" key={`${issue.path}-${issue.message}`}>
          {issue.path}: {issue.message}
        </Alert>
      ))}
      <SurveyEditor
        schema={schema}
        onChange={setDraft}
        locale={locale}
        components={components}
        policy={getContentModePolicy(mode)}
        defaultFieldType={mode === "survey" ? "text" : "radio"}
        {...(mode === "poll"
          ? { addFieldDisabledReason: ja ? "投票は1問固定です" : "Polls have exactly one question." }
          : {})}
        builderSlots={mode === "quiz" ? { fieldEditorAfter: QuizFieldEditor, optionEditorAfter: QuizOptionEditor } : {}}
        saveLabel={ja ? "保存" : "Save"}
        adapter={{
          updateSurveyDraft: async (next) => {
            const errors = validateContentMode(next);
            if (errors.length) throw new Error(errors.map((issue) => issue.message).join(" "));
            await save(next);
            setSaved(next);
          },
          translateSurveyPreview: async ({ schema: next }) => next
        }}
        slots={{
          toolbar: ({ save: saveDraft, state }) => (
            <Button disabled={state.status === "loading"} onClick={() => void saveDraft()}>
              {ja ? "保存" : "Save"}
            </Button>
          ),
          responseSettings: (props) => (
            <ContentModeSettings
              schema={props.schema}
              {...(props.onChange ? { onChange: props.onChange } : {})}
              locale={locale}
            />
          )
        }}
      />
      <Button disabled={issues.length > 0 || draft !== saved} onClick={() => onAnswer(saved)}>
        {ja ? "回答画面を開く" : "Open answer screen"}
      </Button>
    </Stack>
  );
}
