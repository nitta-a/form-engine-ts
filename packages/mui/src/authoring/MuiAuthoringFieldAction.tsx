import type { AuthoringRequest, FormField } from "@form-engine-ts/core";
import { FormEngineI18nProviderScopeContext, useFormEngineI18n } from "@form-engine-ts/react";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import { createContext, useContext, useState } from "react";

const fallbackProviderScope = createContext(false);

export type MuiAuthoringFieldActionName = "rewrite" | "shorten" | "generate-options";

export interface MuiAuthoringFieldActionProps {
  readonly field: FormField;
  readonly onRequest: (request: AuthoringRequest) => unknown;
  readonly actions?: readonly MuiAuthoringFieldActionName[];
  readonly disabled?: boolean;
}

const prompts: Record<MuiAuthoringFieldActionName, string> = {
  rewrite: "Improve this question",
  shorten: "Shorten this question",
  "generate-options": "Generate answer options"
};
const choiceFieldTypes = new Set(["select", "radio", "multi-select"]);

export function MuiAuthoringFieldAction({ field, onRequest, actions, disabled = false }: MuiAuthoringFieldActionProps) {
  const { translator } = useFormEngineI18n();
  const hasProvider = useContext(FormEngineI18nProviderScopeContext ?? fallbackProviderScope);
  const [open, setOpen] = useState(false);
  const resolvedActions = actions ?? [
    "rewrite",
    "shorten",
    ...(choiceFieldTypes.has(field.type) ? ["generate-options" as const] : [])
  ];
  const text = (key: string, fallback: string) => (hasProvider ? translator(key) : fallback);
  const request = (action: MuiAuthoringFieldActionName) => {
    const intent = action === "generate-options" ? "generate_options" : "rewrite_field";
    void onRequest({
      intent,
      prompt: prompts[action],
      target: { kind: "field", fieldId: field.id },
      context: { action }
    });
  };
  return (
    <Stack component="span" direction="row" spacing={0.5}>
      <Button size="small" disabled={disabled} onClick={() => setOpen((value) => !value)}>
        {text("authoring.action.ai", "✨ AI")}
      </Button>
      {open
        ? resolvedActions.map((action) => (
            <Button key={action} size="small" disabled={disabled} onClick={() => request(action)}>
              {text(
                action === "rewrite"
                  ? "authoring.action.rewrite"
                  : action === "shorten"
                    ? "authoring.action.shorten"
                    : "authoring.action.generateOptions",
                prompts[action]
              )}
            </Button>
          ))
        : null}
    </Stack>
  );
}
