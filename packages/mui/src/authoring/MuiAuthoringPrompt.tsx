import type { AuthoringRequest } from "@form-engine-ts/core";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useState } from "react";

export interface MuiAuthoringPromptProps {
  readonly onSubmit: (request: AuthoringRequest) => void | Promise<void>;
  readonly disabled?: boolean;
  readonly label?: string;
  readonly submitLabel?: string;
}

export function MuiAuthoringPrompt({
  onSubmit,
  disabled = false,
  label = "Describe the form change",
  submitLabel = "Ask AI"
}: MuiAuthoringPromptProps) {
  const [prompt, setPrompt] = useState("");
  return (
    <Stack
      component="form"
      direction="row"
      spacing={1}
      onSubmit={(event) => {
        event.preventDefault();
        if (prompt.trim()) void onSubmit({ intent: "add_questions", prompt });
      }}
    >
      <TextField
        fullWidth
        size="small"
        label={label}
        value={prompt}
        disabled={disabled}
        onChange={(event) => setPrompt(event.target.value)}
      />
      <Button type="submit" variant="contained" disabled={disabled || prompt.trim().length === 0}>
        {submitLabel}
      </Button>
    </Stack>
  );
}
