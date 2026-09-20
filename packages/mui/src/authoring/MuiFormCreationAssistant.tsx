import type { AuthoringRequest, CreationQuickReply, FormPolicy, FormSchema } from "@form-engine-ts/core";
import {
  type UseFormCreationAssistantOptions,
  type UseFormCreationAssistantResult,
  useFormCreationAssistant
} from "@form-engine-ts/react";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { type ReactNode, useState } from "react";

export interface MuiFormCreationAssistantProps
  extends Omit<UseFormCreationAssistantOptions, "initialSchema" | "policy" | "onComplete"> {
  readonly initialSchema: FormSchema;
  readonly policy?: FormPolicy;
  readonly onComplete?: (schema: FormSchema) => void;
  readonly renderBrief?: (brief: ReturnType<typeof useFormCreationAssistant>["brief"]) => ReactNode;
  readonly renderConversation?: (assistant: UseFormCreationAssistantResult) => ReactNode;
  readonly renderDraftReview?: (assistant: UseFormCreationAssistantResult) => ReactNode;
}

function DraftReview({
  schema,
  onApply,
  onRevise,
  disabled
}: {
  readonly schema: FormSchema;
  readonly onApply: () => void;
  readonly onRevise: (request: AuthoringRequest) => void;
  readonly disabled: boolean;
}) {
  const [prompt, setPrompt] = useState("");
  return (
    <Card component="section" aria-label="Draft review">
      <CardContent>
        <Stack spacing={1}>
          <Typography variant="h6">{schema.title}</Typography>
          {schema.description === undefined ? null : <Typography>{schema.description}</Typography>}
          {schema.fields.map((field) => (
            <Stack key={field.id} spacing={0.25}>
              <Typography>
                {field.title} ({field.type}) {field.required ? "*" : ""}
              </Typography>
              {"options" in field ? (
                <Typography variant="body2">{field.options.map((option) => option.label).join(", ")}</Typography>
              ) : null}
            </Stack>
          ))}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              size="small"
              fullWidth
              label="Ask AI to revise this draft"
              value={prompt}
              disabled={disabled}
              onChange={(event) => setPrompt(event.target.value)}
            />
            <Button
              variant="outlined"
              disabled={disabled || prompt.trim().length === 0}
              onClick={() => {
                onRevise({ intent: "improve_text", prompt });
                setPrompt("");
              }}
            >
              Ask AI
            </Button>
          </Stack>
          <Button variant="contained" disabled={disabled} onClick={onApply}>
            Open in editor
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

function BriefSummary({ brief }: { readonly brief: ReturnType<typeof useFormCreationAssistant>["brief"] }) {
  return (
    <Stack spacing={1} component="section" aria-label="Current survey brief">
      <Typography variant="h6">Current survey brief</Typography>
      <Typography>Purpose: {brief.purpose || "Not set"}</Typography>
      <Typography>Audience: {brief.audience || "Not set"}</Typography>
      <Typography>Goals: {brief.goals?.join(", ") || "Not set"}</Typography>
      <Typography>Questions: {brief.constraints?.targetQuestionCount ?? "Not set"}</Typography>
      <Typography>Duration: {brief.constraints?.targetDurationMinutes ?? "Not set"} minutes</Typography>
    </Stack>
  );
}

export function MuiFormCreationAssistant({
  creationAdapter,
  authoringAdapter,
  initialSchema,
  policy,
  maxClarificationTurns,
  onComplete,
  renderBrief,
  renderConversation,
  renderDraftReview
}: MuiFormCreationAssistantProps) {
  const assistant = useFormCreationAssistant({
    creationAdapter,
    authoringAdapter,
    initialSchema,
    ...(policy === undefined ? {} : { policy }),
    ...(maxClarificationTurns === undefined ? {} : { maxClarificationTurns }),
    ...(onComplete === undefined ? {} : { onComplete })
  });
  const [message, setMessage] = useState("");
  const send = () => {
    const value = message;
    setMessage("");
    void assistant.sendMessage(value);
  };
  const quickReply = (reply: CreationQuickReply) => void assistant.sendMessage(reply.value);
  return (
    <Card component="section" aria-label="AI survey creation assistant">
      <CardContent>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 7 }}>
            {renderConversation === undefined ? (
              <Stack spacing={1}>
                <Typography variant="h5">Create a survey with AI</Typography>
                <Stack component="section" aria-live="polite" spacing={0.75}>
                  {assistant.messages.map((item) => (
                    <Typography key={`${item.role}-${item.content}`} data-message-role={item.role}>
                      <strong>{item.role === "user" ? "You" : "Assistant"}:</strong> {item.content}
                    </Typography>
                  ))}
                </Stack>
                {assistant.quickReplies.length === 0 ? null : (
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {assistant.quickReplies.map((reply) => (
                      <Button key={reply.id} variant="outlined" onClick={() => quickReply(reply)}>
                        {reply.label}
                      </Button>
                    ))}
                  </Stack>
                )}
                <Stack
                  component="form"
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  onSubmit={(event) => {
                    event.preventDefault();
                    send();
                  }}
                >
                  <TextField
                    fullWidth
                    label="Tell us what you want to learn"
                    value={message}
                    disabled={assistant.status === "responding"}
                    onChange={(event) => setMessage(event.target.value)}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={message.trim().length === 0 || assistant.status === "responding"}
                  >
                    Send
                  </Button>
                </Stack>
                {assistant.status === "error" ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography role="alert" color="error">
                      {assistant.error?.code}
                    </Typography>
                    <Button size="small" onClick={() => void assistant.retry()}>
                      Retry
                    </Button>
                  </Stack>
                ) : null}
                {assistant.canGenerate ? (
                  <Button
                    variant="outlined"
                    onClick={() => void assistant.generateDraft()}
                    disabled={assistant.status === "generating"}
                  >
                    Create with this information
                  </Button>
                ) : null}
                <Button variant="text" onClick={assistant.cancel}>
                  Cancel
                </Button>
                <Button variant="text" onClick={() => onComplete?.(assistant.schema)}>
                  Skip AI and open editor
                </Button>
              </Stack>
            ) : (
              renderConversation(assistant)
            )}
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            {renderBrief === undefined ? <BriefSummary brief={assistant.brief} /> : renderBrief(assistant.brief)}
          </Grid>
        </Grid>
        {assistant.status === "reviewing" && assistant.suggestion !== undefined ? (
          <>
            <Divider sx={{ my: 2 }} />
            {renderDraftReview === undefined ? (
              <DraftReview
                schema={assistant.schema}
                disabled={false}
                onApply={() => assistant.applySuggestion()}
                onRevise={(request) => void assistant.reviseDraft(request)}
              />
            ) : (
              renderDraftReview(assistant)
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
