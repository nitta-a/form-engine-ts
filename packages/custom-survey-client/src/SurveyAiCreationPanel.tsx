import type {
  AuthoringAssistantAdapter,
  CreationAssistantAdapter,
  CreationQuickReply,
  FormPolicy,
  FormSchema,
  QuestionType
} from "@form-engine-ts/core";
import {
  type CreationAssistantErrorCode,
  FormRenderer,
  type UseFormCreationAssistantResult,
  useFormBuilder,
  useFormCreationAssistant
} from "@form-engine-ts/react";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";

export interface SurveyAiCreationLabels {
  readonly title: string;
  readonly conversation: string;
  readonly assistant: string;
  readonly user: string;
  readonly purposeInput: string;
  readonly messageInput: string;
  readonly send: string;
  readonly retry: string;
  readonly cancel: string;
  readonly generate: string;
  readonly generating: string;
  readonly applying: string;
  readonly error: (code: CreationAssistantErrorCode) => string;
  readonly brief: string;
  readonly audience: string;
  readonly questionCount: string;
  readonly notSet: string;
  readonly review: string;
  readonly questionType: string;
  readonly required: string;
  readonly optional: string;
  readonly choices: string;
  readonly removeQuestion: string;
  readonly preview: string;
  readonly previewTitle: string;
  readonly closePreview: string;
  readonly createSurvey: string;
  readonly emptyQuestions: string;
  readonly fieldType: (type: QuestionType) => string;
}

export interface SurveyAiCreationPanelProps {
  readonly initialSchema: FormSchema;
  readonly sourceLocale: string;
  readonly policy?: FormPolicy;
  readonly creationAdapter: CreationAssistantAdapter;
  readonly authoringAdapter: AuthoringAssistantAdapter;
  readonly labels: SurveyAiCreationLabels;
  readonly onComplete: (schema: FormSchema) => void;
}

export interface SurveyEditorPreviewDialogProps {
  readonly open: boolean;
  readonly schema: FormSchema;
  readonly sourceLocale: string;
  readonly policy?: FormPolicy;
  readonly labels: Pick<SurveyAiCreationLabels, "previewTitle" | "closePreview" | "createSurvey">;
  readonly onClose: () => void;
  readonly onCreate: () => void;
}

function focusableElements(root: HTMLElement): readonly HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  );
}

function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>, dialog: HTMLDivElement, onClose: () => void) {
  if (event.key === "Escape") {
    event.preventDefault();
    onClose();
    return;
  }
  if (event.key !== "Tab") return;
  const elements = focusableElements(dialog);
  if (elements.length === 0) {
    event.preventDefault();
    dialog.focus();
    return;
  }
  const first = elements[0];
  const last = elements.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

function applyQuestionReview(schema: FormSchema, reviewedSchema: FormSchema): FormSchema {
  if (reviewedSchema.pages === undefined) {
    const { pages: _pages, ...withoutPages } = schema;
    return { ...withoutPages, fields: reviewedSchema.fields };
  }
  return { ...schema, fields: reviewedSchema.fields, pages: reviewedSchema.pages };
}

export function SurveyEditorPreviewDialog({
  open,
  schema,
  sourceLocale,
  policy,
  labels,
  onClose,
  onCreate
}: SurveyEditorPreviewDialogProps): React.JSX.Element | null {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const titleId = `${useId()}-preview-title`;

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const focusTimer = globalThis.setTimeout(() => {
      const first = dialog?.querySelector<HTMLElement>("[data-dialog-close]") ?? undefined;
      (first ?? dialog)?.focus();
    }, 0);
    return () => {
      globalThis.clearTimeout(focusTimer);
      previousFocus.current?.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (dialogRef.current !== null) handleDialogKeyDown(event, dialogRef.current, onClose);
      }}
    >
      <div>
        <h2 id={titleId}>{labels.previewTitle}</h2>
        <FormRenderer
          schema={schema}
          locale={sourceLocale}
          {...(policy === undefined ? {} : { policy })}
          onSubmit={() => undefined}
        />
        <div>
          <button type="button" data-dialog-close="true" onClick={onClose}>
            {labels.closePreview}
          </button>
          <button type="button" onClick={onCreate}>
            {labels.createSurvey}
          </button>
        </div>
      </div>
    </div>
  );
}

function BriefSummary({
  brief,
  labels,
  headingId
}: {
  readonly brief: UseFormCreationAssistantResult["brief"];
  readonly labels: SurveyAiCreationLabels;
  readonly headingId: string;
}) {
  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId}>{labels.brief}</h3>
      <dl>
        <dt>{labels.audience}</dt>
        <dd>{brief.audience ?? labels.notSet}</dd>
        <dt>{labels.questionCount}</dt>
        <dd>{brief.constraints?.targetQuestionCount ?? labels.notSet}</dd>
      </dl>
    </section>
  );
}

function Conversation({
  assistant,
  labels,
  message,
  onMessageChange,
  onSend,
  onQuickReply,
  disabled,
  headingId,
  messageId
}: {
  readonly assistant: UseFormCreationAssistantResult;
  readonly labels: SurveyAiCreationLabels;
  readonly message: string;
  readonly onMessageChange: (value: string) => void;
  readonly onSend: () => void;
  readonly onQuickReply: (reply: CreationQuickReply) => void;
  readonly disabled: boolean;
  readonly headingId: string;
  readonly messageId: string;
}) {
  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId}>{labels.conversation}</h3>
      <div aria-live="polite">
        {assistant.messages.map((item) => (
          <p key={`${item.role}-${item.content}`}>
            <strong>{item.role === "user" ? labels.user : labels.assistant}:</strong> {item.content}
          </p>
        ))}
      </div>
      {assistant.quickReplies.length === 0 ? null : (
        <div>
          {assistant.quickReplies.map((reply) => (
            <button key={reply.id} type="button" onClick={() => onQuickReply(reply)} disabled={disabled}>
              {reply.label}
            </button>
          ))}
        </div>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
      >
        <label htmlFor={messageId}>{assistant.messages.length === 0 ? labels.purposeInput : labels.messageInput}</label>
        <textarea
          id={messageId}
          value={message}
          disabled={disabled}
          onChange={(event) => onMessageChange(event.target.value)}
        />
        <button type="submit" disabled={disabled || message.trim().length === 0}>
          {labels.send}
        </button>
      </form>
    </section>
  );
}

function Review({
  schema,
  labels,
  onRemove,
  onPreview,
  onCreate,
  headingId
}: {
  readonly schema: FormSchema;
  readonly labels: SurveyAiCreationLabels;
  readonly onRemove: (fieldId: string) => void;
  readonly onPreview: () => void;
  readonly onCreate: () => void;
  readonly headingId: string;
}) {
  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId}>{labels.review}</h3>
      {schema.fields.length === 0 ? <p>{labels.emptyQuestions}</p> : null}
      <ol>
        {schema.fields.map((field) => (
          <li key={field.id}>
            <h4>{field.title}</h4>
            <p>
              {labels.questionType}: {labels.fieldType(field.type)};{" "}
              {field.required ? labels.required : labels.optional}
            </p>
            {"options" in field ? (
              <div>
                <span>{labels.choices}</span>
                <ul>
                  {field.options.map((option) => (
                    <li key={option.id}>{option.label}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <button type="button" onClick={() => onRemove(field.id)} disabled={schema.fields.length <= 1}>
              {labels.removeQuestion}
            </button>
          </li>
        ))}
      </ol>
      <button type="button" onClick={onPreview}>
        {labels.preview}
      </button>
      <button type="button" onClick={onCreate}>
        {labels.createSurvey}
      </button>
    </section>
  );
}

export function SurveyAiCreationPanel({
  initialSchema,
  sourceLocale,
  policy,
  creationAdapter,
  authoringAdapter,
  labels,
  onComplete
}: SurveyAiCreationPanelProps): React.JSX.Element {
  const panelId = useId();
  const assistant = useFormCreationAssistant({
    creationAdapter,
    authoringAdapter,
    initialSchema,
    ...(policy === undefined ? {} : { policy })
  });
  const [message, setMessage] = useState("");
  const [draftRequested, setDraftRequested] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [reviewSchema, setReviewSchema] = useState(initialSchema);
  const [removedFieldIds, setRemovedFieldIds] = useState<ReadonlySet<string>>(new Set());
  const lastSuggestionId = useRef<string | undefined>(undefined);
  const effectiveReviewSchema = removedFieldIds.size === 0 ? assistant.schema : reviewSchema;
  const reviewBuilder = useFormBuilder({
    schema: effectiveReviewSchema,
    onChange: setReviewSchema,
    ...(policy === undefined ? {} : { policy })
  });

  useEffect(() => {
    const suggestionId = assistant.suggestion?.id;
    if (suggestionId === undefined || suggestionId === lastSuggestionId.current) return;
    lastSuggestionId.current = suggestionId;
    setRemovedFieldIds(new Set());
  }, [assistant.suggestion?.id]);

  const sendMessage = () => {
    const value = message;
    setMessage("");
    setDraftRequested(false);
    void assistant.sendMessage(value);
  };

  const generateDraft = () => {
    setDraftRequested(true);
    void assistant.generateDraft();
  };

  const createSurvey = () => {
    const result = assistant.applySuggestion();
    if (result?.success !== true) return;
    const finalSchema =
      removedFieldIds.size === 0 ? result.schema : applyQuestionReview(result.schema, reviewBuilder.schema);
    onComplete(finalSchema);
  };

  const statusMessage =
    assistant.status === "generating"
      ? labels.generating
      : assistant.status === "applying"
        ? labels.applying
        : undefined;

  return (
    <section aria-labelledby={`${panelId}-title`}>
      <h2 id={`${panelId}-title`}>{labels.title}</h2>
      <div role="status" aria-live="polite">
        {statusMessage}
      </div>
      <div>
        <Conversation
          assistant={assistant}
          labels={labels}
          message={message}
          onMessageChange={setMessage}
          onSend={sendMessage}
          onQuickReply={(reply) => {
            setDraftRequested(false);
            void assistant.sendMessage(reply.value);
          }}
          disabled={assistant.status === "responding" || assistant.status === "generating"}
          headingId={`${panelId}-conversation`}
          messageId={`${panelId}-message`}
        />
        <BriefSummary brief={assistant.brief} labels={labels} headingId={`${panelId}-brief`} />
      </div>
      {assistant.status === "error" && assistant.error !== undefined ? (
        <div role="alert" aria-live="assertive">
          {labels.error(assistant.error.code)} ({assistant.error.code})
          <button type="button" onClick={() => void (draftRequested ? assistant.generateDraft() : assistant.retry())}>
            {labels.retry}
          </button>
        </div>
      ) : null}
      {assistant.canGenerate && assistant.status !== "reviewing" ? (
        <button type="button" onClick={generateDraft} disabled={assistant.status === "generating"}>
          {labels.generate}
        </button>
      ) : null}
      {assistant.status === "reviewing" ? (
        <Review
          schema={effectiveReviewSchema}
          labels={labels}
          onRemove={(fieldId) => {
            const result = reviewBuilder.removeField(fieldId);
            if (result.success) setRemovedFieldIds((current) => new Set(current).add(fieldId));
          }}
          onPreview={() => setPreviewOpen(true)}
          onCreate={createSurvey}
          headingId={`${panelId}-review`}
        />
      ) : null}
      {assistant.status !== "reviewing" ? (
        <button type="button" onClick={assistant.cancel} disabled={assistant.status === "idle"}>
          {labels.cancel}
        </button>
      ) : null}
      <SurveyEditorPreviewDialog
        open={previewOpen}
        schema={effectiveReviewSchema}
        sourceLocale={sourceLocale}
        {...(policy === undefined ? {} : { policy })}
        labels={labels}
        onClose={() => setPreviewOpen(false)}
        onCreate={() => {
          setPreviewOpen(false);
          createSurvey();
        }}
      />
    </section>
  );
}
