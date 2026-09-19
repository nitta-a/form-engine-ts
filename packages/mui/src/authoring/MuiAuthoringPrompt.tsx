import type { AuthoringIntent, AuthoringRequest, AuthoringTarget } from "@form-engine-ts/core";
import { FormEngineI18nProviderScopeContext, useFormEngineI18n } from "@form-engine-ts/react";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { createContext, useContext, useState } from "react";

const fallbackProviderScope = createContext(false);

export interface MuiAuthoringPromptProps {
  readonly onSubmit: (request: AuthoringRequest) => unknown;
  readonly disabled?: boolean;
  readonly label?: string;
  readonly submitLabel?: string;
  readonly intent?: AuthoringIntent;
  readonly target?: AuthoringTarget;
  readonly createRequest?: (prompt: string) => AuthoringRequest;
}

export function MuiAuthoringPrompt({
  onSubmit,
  disabled = false,
  label,
  submitLabel,
  intent = "add_questions",
  target,
  createRequest
}: MuiAuthoringPromptProps) {
  const { translator } = useFormEngineI18n();
  const hasProvider = useContext(FormEngineI18nProviderScopeContext ?? fallbackProviderScope);
  const [prompt, setPrompt] = useState("");
  const resolvedLabel = label ?? (hasProvider ? translator("authoring.prompt.label") : "Describe the form change");
  const resolvedSubmitLabel = submitLabel ?? (hasProvider ? translator("authoring.prompt.submit") : "Ask AI");
  return (
    <Stack
      component="form"
      direction="row"
      spacing={1}
      onSubmit={(event) => {
        event.preventDefault();
        if (prompt.trim()) {
          const request = createRequest?.(prompt) ?? {
            intent,
            prompt,
            ...(target === undefined ? {} : { target })
          };
          void onSubmit(request);
        }
      }}
    >
      <TextField
        fullWidth
        size="small"
        label={resolvedLabel}
        value={prompt}
        disabled={disabled}
        onChange={(event) => setPrompt(event.target.value)}
      />
      <Button type="submit" variant="contained" disabled={disabled || prompt.trim().length === 0}>
        {resolvedSubmitLabel}
      </Button>
    </Stack>
  );
}
