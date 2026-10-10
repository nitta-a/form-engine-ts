import type { FormSchema } from "@form-engine-ts/core";
import { MuiFormBuilder, type MuiFormBuilderValidationState } from "@form-engine-ts/mui/builder";
import { Alert, Button, Stack } from "@mui/material";
import { useEffect, useState } from "react";
export interface ContentEditorProps {
  readonly schema: FormSchema;
  readonly locale: string;
  readonly save: (schema: FormSchema) => Promise<void>;
  readonly onAnswer: (schema: FormSchema) => void;
  readonly initiallySaved?: boolean;
  readonly onOpenWorkspace?: (schema: FormSchema) => Promise<void>;
  readonly openingWorkspace?: boolean;
  readonly onDirtyChange?: (dirty: boolean) => void;
  readonly active?: boolean;
}
export function ContentEditor({
  schema,
  locale,
  save,
  onAnswer,
  initiallySaved = true,
  onOpenWorkspace,
  openingWorkspace = false,
  onDirtyChange,
  active = true
}: ContentEditorProps) {
  const [draft, setDraft] = useState(schema);
  const [saved, setSaved] = useState<FormSchema | undefined>(initiallySaved ? schema : undefined);
  const [validation, setValidation] = useState<MuiFormBuilderValidationState>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const ja = locale.startsWith("ja");
  const unchanged = draft === saved;
  useEffect(() => {
    onDirtyChange?.(!unchanged);
  }, [onDirtyChange, unchanged]);
  const ready = validation?.valid === true && unchanged && !saving && !openingWorkspace;
  const saveDraft = async () => {
    setSaving(true);
    setError(undefined);
    try {
      await save(draft);
      setSaved(draft);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Stack spacing={2}>
      {active ? (
        <MuiFormBuilder
          schema={draft}
          onChange={setDraft}
          locale={locale}
          contentModeOptions={{ showSelector: true, onValidationChange: setValidation }}
          localizationOptions={{
            emptyStateMessage: ja
              ? "翻訳言語はまだ設定されていません。言語を追加すると翻訳を編集できます。"
              : "Add a language to edit translated questions."
          }}
          i18n={{ locale }}
        />
      ) : null}
      {error ? <Alert severity="error">{error}</Alert> : null}
      <div className="editor-actions">
        <p role="status" className="editor-save-status">
          {saving
            ? ja
              ? "保存中…"
              : "Saving…"
            : unchanged
              ? ja
                ? "変更は保存されています"
                : "All changes saved"
              : ja
                ? "未保存の変更があります。回答を集める前に保存してください。"
                : "Unsaved changes. Save before collecting responses."}
        </p>
        <Button
          variant="contained"
          disabled={validation?.valid !== true || saving || openingWorkspace}
          onClick={() => void saveDraft()}
        >
          {ja ? "保存" : "Save"}
        </Button>
        <Button disabled={!ready} onClick={() => saved && onAnswer(saved)}>
          {ja ? "回答画面を開く" : "Open answer screen"}
        </Button>
        {onOpenWorkspace ? (
          <Button variant="outlined" disabled={!ready} onClick={() => saved && void onOpenWorkspace(saved)}>
            {ja ? "ワークスペースで開く" : "Use in workspace"}
          </Button>
        ) : null}
      </div>
    </Stack>
  );
}
