import { type FormContentMode, type FormSchema, getFormContentMode } from "@form-engine-ts/core";
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
  const [title, setTitle] = useState("");
  const [answer, setAnswer] = useState<FormSchema>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const ja = locale.startsWith("ja");
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
          if (!busy) setOpen(false);
        }}
        fullWidth
      >
        <DialogTitle>{ja ? "フォームを作成" : "Create a form"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <fieldset>
              <legend>{ja ? "種別を選択" : "Choose a mode"}</legend>
              {modes.map((value) => (
                <Card key={value}>
                  <CardActionArea aria-pressed={mode === value} onClick={() => setMode(value)}>
                    <CardContent>{label(value)}</CardContent>
                  </CardActionArea>
                </Card>
              ))}
            </fieldset>
            <TextField
              label={ja ? "タイトル" : "Title"}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setOpen(false)}>
            {ja ? "キャンセル" : "Cancel"}
          </Button>
          <Button
            disabled={!title.trim() || busy}
            onClick={() => {
              setBusy(true);
              setError(undefined);
              void library
                .create(mode, title.trim(), locale)
                .then(
                  () => {
                    setOpen(false);
                    setTitle("");
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
