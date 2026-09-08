import type { FormSchema } from "@form-engine-ts/core";
import { MuiFormBuilder, type MuiFormBuilderValidationState } from "@form-engine-ts/mui/builder";
import { Button, Stack } from "@mui/material";
import { useState } from "react";
export interface ContentEditorProps {
  readonly schema: FormSchema;
  readonly locale: string;
  readonly save: (schema: FormSchema) => Promise<void>;
  readonly onAnswer: (schema: FormSchema) => void;
}
export function ContentEditor({ schema, locale, save, onAnswer }: ContentEditorProps) {
  const [draft, setDraft] = useState(schema);
  const [saved, setSaved] = useState(schema);
  const [validation, setValidation] = useState<MuiFormBuilderValidationState>();
  const ja = locale.startsWith("ja");
  return (
    <Stack spacing={2}>
      <MuiFormBuilder
        schema={draft}
        onChange={setDraft}
        locale={locale}
        contentModeOptions={{ showSelector: true, onValidationChange: setValidation }}
        i18n={{ locale }}
      />
      <Button
        disabled={validation?.valid !== true}
        onClick={() =>
          void save(draft).then(() => {
            setSaved(draft);
          })
        }
      >
        {ja ? "保存" : "Save"}
      </Button>
      <Button disabled={validation?.valid !== true || draft !== saved} onClick={() => onAnswer(saved)}>
        {ja ? "回答画面を開く" : "Open answer screen"}
      </Button>
    </Stack>
  );
}
