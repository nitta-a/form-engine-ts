import { createInitialSchemaByMode, type FormSchema } from "@form-engine-ts/core";
import { type SurveyAiCreationLabels, SurveyAiCreationPanel } from "@form-engine-ts/custom-survey-client";
import { Button, Dialog, DialogContent, DialogTitle, TextField } from "@mui/material";
import { useMemo, useState } from "react";
import { mockAuthoringAssistantAdapter } from "./mockAuthoringAssistantAdapter";
import { mockCreationAssistantAdapter } from "./mockCreationAssistantAdapter";
import { previewCreationPolicy } from "./previewPolicy";

const previewEnglishSurveyAiLabels: SurveyAiCreationLabels = {
  title: "AI survey creation assistant",
  conversation: "Conversation",
  initialNotice:
    "This AI assistant helps you create a survey. Tell us what you would like to learn, or choose a suggestion below.",
  initialPrompt: "What would you like to know with this survey?",
  initialQuickReplies: [
    { id: "satisfaction", label: "I want to know satisfaction", value: "I want to know satisfaction" },
    { id: "improvement", label: "I want to know improvement needs", value: "I want to know improvement needs" }
  ],
  assistant: "Assistant",
  user: "You",
  purposeInput: "Tell us what you want to learn",
  messageInput: "Tell us more",
  send: "Send",
  retry: "Retry",
  cancel: "Cancel",
  generate: "Create with this information",
  generating: "Generating survey…",
  applying: "Applying survey…",
  error: (code) => code,
  brief: "Survey brief",
  showBrief: "Show survey brief",
  hideBrief: "Hide survey brief",
  audience: "Audience",
  questionCount: "Questions",
  notSet: "Not set",
  review: "Draft review",
  questionType: "Type",
  required: "Required",
  optional: "Optional",
  choices: "Choices",
  removeQuestion: "Remove question",
  preview: "Preview",
  previewTitle: "Survey preview",
  previewNotice: "You are viewing the current draft. Answers cannot be submitted from this preview.",
  closePreview: "Close preview",
  createSurvey: "Open in editor",
  emptyQuestions: "No questions",
  fieldType: (type) => type
};

function previewSurveyAiLabels(locale: string): SurveyAiCreationLabels {
  if (!locale.startsWith("ja")) return previewEnglishSurveyAiLabels;
  return {
    ...previewEnglishSurveyAiLabels,
    title: "AIでアンケートを作成",
    conversation: "AIとのやり取り",
    initialNotice:
      "AIアシスタントにアンケートの作成を依頼できます。知りたいことを入力するか、候補から選択してください。",
    initialPrompt: "このアンケートで何を知りたいですか？",
    initialQuickReplies: [
      { id: "satisfaction", label: "満足度を知りたい", value: "満足度を知りたい" },
      { id: "improvement", label: "改善点を知りたい", value: "改善点を知りたい" }
    ],
    assistant: "AI",
    user: "あなた",
    purposeInput: "このアンケートで知りたいことを入力してください。",
    messageInput: "候補にない回答を入力",
    send: "送信",
    retry: "再試行",
    cancel: "キャンセル",
    generate: "この情報で作成",
    generating: "アンケートを作成中…",
    applying: "アンケートを反映中…",
    error: (code) => `エラー: ${code}`,
    brief: "アンケート概要",
    showBrief: "アンケート概要を表示",
    hideBrief: "アンケート概要を非表示",
    audience: "対象者",
    questionCount: "質問数",
    notSet: "未設定",
    review: "作成内容の確認",
    questionType: "種類",
    required: "必須",
    optional: "任意",
    choices: "選択肢",
    removeQuestion: "質問を削除",
    preview: "回答画面をプレビュー",
    previewTitle: "回答画面プレビュー",
    previewNotice: "現在編集中の内容を表示しています。プレビューから回答は送信されません。",
    closePreview: "プレビューを閉じる",
    createSurvey: "アンケートを作成",
    emptyQuestions: "質問がありません"
  };
}

interface SurveyCreationAssistantProps {
  readonly locale: string;
  readonly disabled?: boolean;
  readonly onComplete: (schema: FormSchema) => void | Promise<void>;
}

export function SurveyCreationAssistant({ locale, disabled = false, onComplete }: SurveyCreationAssistantProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingSchema, setPendingSchema] = useState<FormSchema | null>(null);
  const [sessionId, setSessionId] = useState("ai-created-survey");
  const labels = previewSurveyAiLabels(locale);
  const isJapanese = locale.startsWith("ja");
  const surveyTheme = isJapanese ? "顧客満足度アンケート" : "Customer satisfaction survey";
  const dialogTitle = isJapanese ? labels.title : "Create survey with AI";
  const initialSchema = useMemo(
    () => createInitialSchemaByMode("survey", { id: sessionId, title: surveyTheme, locale }),
    [locale, sessionId, surveyTheme]
  );
  const complete = async (createdSchema: FormSchema) => {
    setPendingSchema(createdSchema);
    setSaving(true);
    setSaveError(null);
    try {
      await onComplete(createdSchema);
      setOpen(false);
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <Button
        variant="contained"
        disabled={disabled}
        onClick={() => {
          setSaveError(null);
          setPendingSchema(null);
          setSessionId(`survey-${globalThis.crypto.randomUUID()}`);
          setOpen(true);
        }}
      >
        {isJapanese ? "AIでアンケートを作成" : "Create survey with AI"}
      </Button>
      <Dialog
        className="preview-ai-creation-dialog"
        fullWidth
        maxWidth="sm"
        open={open}
        onClose={() => {
          if (!saving) setOpen(false);
        }}
      >
        <DialogTitle>{dialogTitle}</DialogTitle>
        <DialogContent dividers>
          <p className="preview-ai-creation-theme">
            {isJapanese
              ? "アンケートのテーマ: 顧客体験とサービス改善"
              : "Survey theme: Customer experience and service improvement"}
          </p>
          <p className="preview-ai-creation-notice">
            {isJapanese
              ? "デモでは固定のAI候補を使います。作成した質問は反映前に確認できます。"
              : "This demo uses fixed AI suggestions. Review the questions before opening them in the editor."}
          </p>
          {saving ? <p role="status">{isJapanese ? "アンケートを保存中…" : "Saving questionnaire…"}</p> : null}
          {saveError === null ? null : <p role="alert">{saveError}</p>}
          {pendingSchema === null ? (
            <SurveyAiCreationPanel
              key={`${sessionId}:${locale}`}
              creationAdapter={mockCreationAssistantAdapter}
              authoringAdapter={mockAuthoringAssistantAdapter}
              initialSchema={initialSchema}
              sourceLocale={locale}
              policy={previewCreationPolicy}
              labels={labels}
              showBrief={false}
              renderMessageInput={({ id, value, disabled, placeholder, onChange }) => (
                <TextField
                  id={id}
                  value={value}
                  disabled={disabled}
                  placeholder={placeholder}
                  onChange={(event) => onChange(event.target.value)}
                  fullWidth
                  size="small"
                />
              )}
              onCancel={() => setOpen(false)}
              onComplete={(createdSchema) => {
                if (!saving) void complete(createdSchema);
              }}
            />
          ) : (
            <section
              className="preview-ai-save-draft"
              aria-label={isJapanese ? "作成したアンケート" : "Created questionnaire"}
            >
              <h3>{pendingSchema.title}</h3>
              <p>
                {pendingSchema.fields.length} {isJapanese ? "問のアンケートを作成しました。" : "questions are ready."}
              </p>
              {saveError === null ? null : (
                <Button variant="contained" disabled={saving} onClick={() => void complete(pendingSchema)}>
                  {isJapanese ? "アンケートの保存を再試行" : "Retry saving questionnaire"}
                </Button>
              )}
              <Button disabled={saving} onClick={() => setOpen(false)}>
                {isJapanese ? "閉じる" : "Close"}
              </Button>
            </section>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
