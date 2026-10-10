import {
  type FormContentMode,
  type FormSchema,
  getFormContentMode,
  getFormTemplates,
  readQuizFieldMetadata,
  resolveLocalizedSchema
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
import { useEffect, useState } from "react";
import { StorageSwitch } from "../respondent/StorageSwitch";
import { type StorageKind, usePreviewWorkspace } from "../workspace/PreviewWorkspaceContext";
import { ContentAnswer } from "./ContentAnswer";
import { ContentEditor } from "./ContentEditor";
import { useContentLibrary } from "./useContentLibrary";

const modes: readonly FormContentMode[] = ["survey", "poll", "quiz"];
export interface ContentLibraryProps {
  readonly onOpenWorkspace?: () => void;
  readonly active?: boolean;
}
export function ContentLibrary({ onOpenWorkspace, active = true }: ContentLibraryProps) {
  const { storage, locale, storageKind, setStorageKind, openSchema, workspaceReady } = usePreviewWorkspace();
  return (
    <ContentLibraryBody
      key={storageKind}
      storage={storage}
      locale={locale}
      storageKind={storageKind}
      setStorageKind={setStorageKind}
      openSchema={openSchema}
      active={active}
      workspaceReady={workspaceReady}
      {...(onOpenWorkspace === undefined ? {} : { onOpenWorkspace })}
    />
  );
}
function ContentLibraryBody({
  storage,
  locale,
  storageKind,
  setStorageKind,
  openSchema,
  active = true,
  workspaceReady,
  onOpenWorkspace
}: Pick<
  ReturnType<typeof usePreviewWorkspace>,
  "storage" | "locale" | "storageKind" | "setStorageKind" | "openSchema"
> &
  ContentLibraryProps & { readonly workspaceReady: boolean }) {
  const library = useContentLibrary(storage);
  const { refresh } = library;
  useEffect(() => {
    if (active && workspaceReady) void refresh();
  }, [active, refresh, workspaceReady]);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<FormContentMode>("survey");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>();
  const [title, setTitle] = useState("");
  const [creationId, setCreationId] = useState<string>();
  const [answer, setAnswer] = useState<FormSchema>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [dirty, setDirty] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [pendingStorageKind, setPendingStorageKind] = useState<StorageKind>();
  const ja = locale.startsWith("ja");
  const templates = getFormTemplates({ mode, locale });
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);
  const search = query.trim().toLocaleLowerCase(locale);
  const matchesSearch = (schema: FormSchema) => {
    const localized = resolveLocalizedSchema(schema, locale);
    return `${localized.title} ${localized.description ?? ""}`.toLocaleLowerCase(locale).includes(search);
  };
  const visibleSchemas = library.schemas.filter(matchesSearch);
  const openInWorkspace = async (schema: FormSchema) => {
    setBusy(true);
    setError(undefined);
    try {
      await openSchema(schema);
      library.setSelected(undefined);
      setAnswer(undefined);
      setDirty(false);
      onOpenWorkspace?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };
  const backToList = () => {
    library.setSelected(undefined);
    setAnswer(undefined);
    setError(undefined);
    setDirty(false);
    setConfirmLeave(false);
    void refresh();
  };
  const saveSchema = async (schema: FormSchema) => {
    setBusy(true);
    try {
      await library.save(schema);
    } finally {
      setBusy(false);
    }
  };
  const changeStorage = (kind: StorageKind) => {
    if (busy || kind === storageKind) return;
    if (dirty) {
      setPendingStorageKind(kind);
      setConfirmLeave(true);
      return;
    }
    setStorageKind(kind);
  };
  const label = (value: FormContentMode) =>
    ({ survey: ja ? "アンケート" : "Survey", poll: ja ? "投票" : "Poll", quiz: ja ? "クイズ" : "Quiz" })[value];
  const renderSurveyCard = (schema: FormSchema) => {
    const localized = resolveLocalizedSchema(schema, locale);
    return (
      <Card component="article" className="survey-card" key={`${schema.id}:${schema.version}`}>
        <CardActionArea disabled={busy} aria-label={localized.title} onClick={() => library.setSelected(schema)}>
          <CardContent>
            <div className="survey-card-heading">
              <Chip size="small" label={label(getFormContentMode(schema.metadata))} />
              <span>v{schema.version}</span>
            </div>
            <h3>{localized.title}</h3>
            <p className="survey-card-description">
              {localized.description ||
                (ja
                  ? "質問を編集して、回答の収集を始めましょう。"
                  : "Edit your questions and start collecting feedback.")}
            </p>
            <div className="survey-card-meta">
              <span>
                {schema.fields.length} {ja ? "問" : "questions"}
              </span>
              <span>
                {schema.pages?.length ?? 1} {ja ? "ページ" : "pages"}
              </span>
            </div>
          </CardContent>
        </CardActionArea>
        <div className="survey-card-actions">
          <Button disabled={busy} onClick={() => void openInWorkspace(schema)}>
            {ja ? "ワークスペースで開く" : "Use in workspace"}
          </Button>
          <Button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setError(undefined);
              void library
                .duplicate(schema, ja ? `${localized.title}（コピー）` : `${localized.title} (copy)`)
                .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
                .finally(() => setBusy(false));
            }}
          >
            {ja ? "複製" : "Duplicate"}
          </Button>
        </div>
      </Card>
    );
  };
  return (
    <Stack spacing={3} className="survey-library">
      {library.error || error ? <Alert severity="error">{library.error ?? error}</Alert> : null}
      {library.selected ? (
        <>
          <div className="library-editor-header">
            <Button
              disabled={busy}
              onClick={() => {
                setPendingStorageKind(undefined);
                if (dirty) setConfirmLeave(true);
                else backToList();
              }}
            >
              {ja ? "一覧に戻る" : "Back to list"}
            </Button>
            <h2>{resolveLocalizedSchema(library.selected, locale).title}</h2>
            <p>
              {answer
                ? ja
                  ? "お客様が実際に回答する画面を確認できます。"
                  : "Experience the survey as your customers will see it."
                : ja
                  ? "質問を整えて保存したら、ワークスペースで回答と分析を確認しましょう。"
                  : "Refine your questions, then open the workspace to collect and analyze responses."}
            </p>
          </div>
          {answer ? (
            <>
              <Button onClick={() => setAnswer(undefined)}>{ja ? "編集に戻る" : "Back to editor"}</Button>
              <ContentAnswer
                key={`${answer.id}:${answer.version}`}
                schema={answer}
                locale={locale}
                storage={storage}
                storageKind={storageKind}
              />
            </>
          ) : (
            <ContentEditor
              key={`${library.selected.id}:${library.selected.version}`}
              schema={library.selected}
              locale={locale}
              save={saveSchema}
              onAnswer={setAnswer}
              initiallySaved={library.allSchemas.some(
                (schema) => schema.id === library.selected?.id && schema.version === library.selected.version
              )}
              onOpenWorkspace={openInWorkspace}
              openingWorkspace={busy}
              onDirtyChange={setDirty}
              active={active}
            />
          )}
        </>
      ) : (
        <>
          <div className="page-intro">
            <p className="eyebrow">{ja ? "顧客の声を、次の改善へ" : "FROM CUSTOMER VOICE TO ACTION"}</p>
            <h2>{ja ? "アンケートライブラリ" : "Survey library"}</h2>
            <p>
              {ja
                ? "アンケートを作成し、お客様の回答を集め、サービス改善につなげましょう。"
                : "Create surveys, collect customer feedback, and turn the results into better service."}
            </p>
          </div>
          <div className="library-starter">
            <div className="library-starter-copy">
              <span className="eyebrow">{ja ? "おすすめの始め方" : "A GOOD PLACE TO START"}</span>
              <h3>{ja ? "まずは、顧客満足度を知る。" : "Start with customer satisfaction."}</h3>
              <p>
                {ja
                  ? "総合評価・良かった点・改善してほしい点の3問から、すぐに始められます。"
                  : "A focused three-question template for ratings, highlights, and ideas for improvement."}
              </p>
            </div>
            <Button
              variant="contained"
              disabled={busy}
              onClick={() => {
                setMode("survey");
                setSelectedTemplateId("satisfaction-survey");
                setTitle(ja ? "顧客満足度アンケート" : "Customer satisfaction survey");
                setOpen(true);
              }}
            >
              {ja ? "満足度テンプレートを使う" : "Use satisfaction template"}
            </Button>
          </div>
          <div className="library-toolbar">
            <TextField
              className="library-search"
              label={ja ? "アンケートを検索" : "Search surveys"}
              placeholder={ja ? "タイトルや説明で検索" : "Search by title or description"}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              size="small"
            />
            <Button variant="contained" disabled={busy} onClick={() => setOpen(true)}>
              {ja ? "新規作成" : "Create form"}
            </Button>
          </div>
          <Tabs
            value={library.filter}
            onChange={(_, value: string) => library.changeFilter(value)}
            aria-label={ja ? "フォーム種別" : "Content mode"}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab value="all" label={ja ? "すべて" : "All"} />
            {modes.map((value) => (
              <Tab key={value} value={value} label={label(value)} />
            ))}
          </Tabs>
          <p className="library-result-count" role="status">
            {library.loading
              ? ja
                ? "アンケートを読み込み中…"
                : "Loading surveys…"
              : ja
                ? `${visibleSchemas.length}件のフォーム`
                : `${visibleSchemas.length} forms`}
          </p>
          {!library.loading && visibleSchemas.length === 0 ? (
            <div className="library-empty">
              <h3>{ja ? "該当するアンケートがありません" : "No surveys found"}</h3>
              <p>
                {query.trim()
                  ? ja
                    ? "検索キーワードや種別を変更してください。"
                    : "Try another search or content type."
                  : ja
                    ? "テンプレートや白紙から、最初のアンケートを作成しましょう。"
                    : "Create your first survey from a template or a blank form."}
              </p>
              {query.trim() ? (
                <Button onClick={() => setQuery("")}>{ja ? "検索をクリア" : "Clear search"}</Button>
              ) : null}
            </div>
          ) : null}
          <div className="survey-card-grid">{visibleSchemas.map(renderSurveyCard)}</div>
        </>
      )}
      <details className="content-demo-settings">
        <summary>{ja ? "デモの保存先" : "Demo storage"}</summary>
        <StorageSwitch value={storageKind} locale={locale} onChange={changeStorage} />
      </details>
      <Dialog open={confirmLeave} onClose={() => setConfirmLeave(false)}>
        <DialogTitle>{ja ? "未保存の変更を破棄しますか？" : "Discard changes?"}</DialogTitle>
        <DialogContent>
          {ja ? "保存していない質問や設定の変更は失われます。" : "Your unsaved questions and settings will be lost."}
        </DialogContent>
        <DialogActions>
          <Button autoFocus onClick={() => setConfirmLeave(false)}>
            {ja ? "編集を続ける" : "Continue editing"}
          </Button>
          <Button
            color="error"
            onClick={() => {
              if (pendingStorageKind) setStorageKind(pendingStorageKind);
              else backToList();
            }}
          >
            {ja ? "変更を破棄" : "Discard changes"}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        className="survey-creation-dialog"
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
            <TextField
              autoFocus
              fullWidth
              label={ja ? "タイトル" : "Title"}
              helperText={
                ja ? "チームで見つけやすい名前を付けてください。" : "Give this survey a name your team can recognize."
              }
              disabled={busy}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <fieldset className="creation-mode-picker">
              <legend>{ja ? "種別を選択" : "Choose a mode"}</legend>
              {modes.map((value) => (
                <Card key={value} sx={{ border: 2, borderColor: mode === value ? "primary.main" : "transparent" }}>
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
            <fieldset className="creation-template-picker">
              <legend>{ja ? "開始方法を選択" : "Choose how to start"}</legend>
              <Card sx={{ border: 2, borderColor: selectedTemplateId === undefined ? "primary.main" : "transparent" }}>
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
                <Card
                  key={template.id}
                  sx={{
                    border: 2,
                    borderColor: selectedTemplateId === template.id ? "primary.main" : "transparent"
                  }}
                >
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
