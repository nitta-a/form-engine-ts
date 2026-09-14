import {
  type FormContentMode,
  type FormSchema,
  getFormContentMode,
  getFormTemplates,
  readQuizFieldMetadata
} from "@form-engine-ts/core";
import {
  Alert,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Tab,
  Tabs,
  TextField
} from "@mui/material";
import { useState } from "react";
import { StorageSwitch } from "../respondent/StorageSwitch";
import { usePreviewWorkspace } from "../workspace/PreviewWorkspaceContext";
import { ContentAnswer } from "./ContentAnswer";
import { ContentEditor } from "./ContentEditor";
import { useContentLibrary } from "./useContentLibrary";

const modes: readonly FormContentMode[] = ["survey", "poll", "quiz"];
export function ContentLibrary() {
  const { storage, locale, storageKind, setStorageKind } = usePreviewWorkspace();
  return (
    <ContentLibraryBody
      key={storageKind}
      storage={storage}
      locale={locale}
      storageKind={storageKind}
      setStorageKind={setStorageKind}
    />
  );
}
function ContentLibraryBody({
  storage,
  locale,
  storageKind,
  setStorageKind
}: Pick<ReturnType<typeof usePreviewWorkspace>, "storage" | "locale" | "storageKind" | "setStorageKind">) {
  const library = useContentLibrary(storage);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<FormContentMode>("survey");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>();
  const [title, setTitle] = useState("");
  const [creationId, setCreationId] = useState<string>();
  const [answer, setAnswer] = useState<FormSchema>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const ja = locale.startsWith("ja");
  const templates = getFormTemplates({ mode, locale });
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);
  const label = (value: FormContentMode) =>
    ({ survey: ja ? "アンケート" : "Survey", poll: ja ? "投票" : "Poll", quiz: ja ? "クイズ" : "Quiz" })[value];
  return (
    <Stack spacing={2}>
      <StorageSwitch value={storageKind} locale={locale} onChange={setStorageKind} />
      {library.error || error ? <Alert severity="error">{library.error ?? error}</Alert> : null}
      {library.selected ? (
        <>
          <Button
            onClick={() => {
              library.setSelected(undefined);
              setAnswer(undefined);
            }}
          >
            {ja ? "一覧に戻る" : "Back to list"}
          </Button>
          <h2>{library.selected.title}</h2>
          {answer ? (
            <>
              <Button onClick={() => setAnswer(undefined)}>{ja ? "編集に戻る" : "Back to editor"}</Button>
              <ContentAnswer key={`${answer.id}:${answer.version}`} schema={answer} locale={locale} storage={storage} />
            </>
          ) : (
            <ContentEditor
              key={`${library.selected.id}:${library.selected.version}`}
              schema={library.selected}
              locale={locale}
              save={library.save}
              onAnswer={setAnswer}
            />
          )}
        </>
      ) : (
        <>
          <Tabs
            value={library.filter}
            onChange={(_, value: string) => library.changeFilter(value)}
            aria-label={ja ? "フォーム種別" : "Content mode"}
          >
            <Tab value="all" label={ja ? "すべて" : "All"} />
            {modes.map((value) => (
              <Tab key={value} value={value} label={label(value)} />
            ))}
          </Tabs>
          <Button onClick={() => setOpen(true)}>{ja ? "新規作成" : "Create form"}</Button>
          {library.schemas.map((schema) => (
            <Card key={`${schema.id}:${schema.version}`}>
              <CardActionArea onClick={() => library.setSelected(schema)}>
                <CardContent>
                  {schema.title} <Chip label={label(getFormContentMode(schema.metadata))} /> v{schema.version}
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </>
      )}
      <Dialog
        open={open}
        onClose={() => {
          if (!busy) {
            setOpen(false);
            setMode("survey");
            setSelectedTemplateId(undefined);
            setTitle("");
            setCreationId(undefined);
            setError(undefined);
          }
        }}
        fullWidth
      >
        <DialogTitle>{ja ? "フォームを作成" : "Create a form"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            {error ? <Alert severity="error">{error}</Alert> : null}
            <fieldset>
              <legend>{ja ? "種別を選択" : "Choose a mode"}</legend>
              {modes.map((value) => (
                <Card key={value}>
                  <CardActionArea
                    disabled={busy}
                    aria-pressed={mode === value}
                    onClick={() => {
                      setMode(value);
                      setSelectedTemplateId(undefined);
                    }}
                  >
                    <CardContent>{label(value)}</CardContent>
                  </CardActionArea>
                </Card>
              ))}
            </fieldset>
            <fieldset>
              <legend>{ja ? "開始方法を選択" : "Choose how to start"}</legend>
              <Card>
                <CardActionArea
                  disabled={busy}
                  aria-pressed={selectedTemplateId === undefined}
                  onClick={() => setSelectedTemplateId(undefined)}
                >
                  <CardContent>
                    <strong>{ja ? "白紙から作成" : "Start from a blank form"}</strong>
                    <div>{ja ? "質問を自分で追加します。" : "Add the questions yourself."}</div>
                  </CardContent>
                </CardActionArea>
              </Card>
              {templates.map((template) => (
                <Card key={template.id}>
                  <CardActionArea
                    disabled={busy}
                    aria-pressed={selectedTemplateId === template.id}
                    onClick={() => setSelectedTemplateId(template.id)}
                  >
                    <CardContent>
                      <strong>{template.name}</strong>
                      <div>{template.description}</div>
                      <div>
                        {template.schema.fields.length} {ja ? "問" : "questions"}
                      </div>
                    </CardContent>
                  </CardActionArea>
                </Card>
              ))}
            </fieldset>
            {selectedTemplate === undefined ? (
              <Alert severity="info">{ja ? "白紙のフォームを作成します。" : "A blank form will be created."}</Alert>
            ) : (
              <Card
                variant="outlined"
                aria-label={ja ? `${selectedTemplate.name}の内容` : `${selectedTemplate.name} contents`}
              >
                <CardContent>
                  <strong>{ja ? "テンプレートの内容" : "Template contents"}</strong>
                  <p>{selectedTemplate.description}</p>
                  <Divider />
                  <ul>
                    {selectedTemplate.schema.fields.map((field) => {
                      const options = "options" in field ? field.options : [];
                      const quiz = mode === "quiz" ? readQuizFieldMetadata(field.metadata) : undefined;
                      const correctOption = options.find((option) => option.id === quiz?.correctOptionId);
                      return (
                        <li key={field.id}>
                          {field.title}
                          {options.length > 0 ? `: ${options.map((option) => option.label).join(", ")}` : ""}
                          {correctOption === undefined ? null : (
                            <div>
                              {ja ? "正解" : "Correct answer"}: {correctOption.label}
                              {quiz?.explanation ? ` (${quiz.explanation})` : ""}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            )}
            <TextField
              label={ja ? "タイトル" : "Title"}
              disabled={busy}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            disabled={busy}
            onClick={() => {
              setOpen(false);
              setMode("survey");
              setSelectedTemplateId(undefined);
              setTitle("");
              setCreationId(undefined);
              setError(undefined);
            }}
          >
            {ja ? "キャンセル" : "Cancel"}
          </Button>
          <Button
            disabled={!title.trim() || busy}
            onClick={() => {
              setBusy(true);
              setError(undefined);
              const id = creationId ?? crypto.randomUUID();
              setCreationId(id);
              void library
                .create(mode, title.trim(), locale, selectedTemplate, id)
                .then(
                  () => {
                    setOpen(false);
                    setTitle("");
                    setMode("survey");
                    setSelectedTemplateId(undefined);
                    setCreationId(undefined);
                  },
                  (cause: unknown) => setError(String(cause))
                )
                .finally(() => setBusy(false));
            }}
          >
            {ja ? "作成" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
