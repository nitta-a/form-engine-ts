import {
  contentMetadataToJson,
  type FormSchema,
  getFormContentMode,
  readPollMetadata,
  readQuizMetadata
} from "@form-engine-ts/core";
import type { FormBuilderComponents } from "@form-engine-ts/react";
import { Stack } from "@mui/material";
import { useId } from "react";
import { MuiCheckboxAdapter, MuiSelectAdapter, MuiTextInputAdapter } from "./adapters";
import { contentTranslation } from "./contentTranslation";
import { useResolvedMuiAdapterOptions } from "./context";

export interface ContentModeSettingsProps {
  readonly schema: FormSchema;
  readonly onChange?: (schema: FormSchema) => void;
  readonly locale?: string;
  readonly readOnly?: boolean;
  readonly components?: Partial<FormBuilderComponents>;
  readonly translate?: (key: string) => string;
}
export function ContentModeSettings({
  schema,
  onChange,
  locale = "en",
  readOnly = false,
  components,
  translate
}: ContentModeSettingsProps) {
  const id = useId();
  const t = contentTranslation(locale, translate);
  const resolved = useResolvedMuiAdapterOptions();
  const Select = components?.Select ?? MuiSelectAdapter;
  const Checkbox = components?.Checkbox ?? MuiCheckboxAdapter;
  const TextInput = components?.TextInput ?? MuiTextInputAdapter;
  const mode = getFormContentMode(schema.metadata);
  const poll = readPollMetadata(schema.metadata);
  const quiz = readQuizMetadata(schema.metadata);
  const raw = schema.metadata?.[mode];
  const existing =
    raw !== null && typeof raw === "object" && !Array.isArray(raw) ? Object.fromEntries(Object.entries(raw)) : {};
  const update = (settings: object) => {
    if (readOnly) return;
    const previous = { ...existing };
    if (mode === "quiz") delete previous.passingScore;
    onChange?.({
      ...schema,
      metadata: contentMetadataToJson({ ...schema.metadata, [mode]: { ...previous, ...settings } })
    });
  };
  if (mode === "survey") return null;
  return (
    <Stack {...resolved.muiSlotProps?.stack} spacing={resolved.dense ? 1 : 2}>
      {mode === "poll" ? (
        <>
          <Select
            id={`${id}-visibility`}
            label={t("builder.content.resultVisibility")}
            value={poll.resultVisibility}
            disabled={readOnly}
            options={[
              { value: "after_submit", label: t("builder.content.after_submit") },
              { value: "always", label: t("builder.content.always") },
              { value: "closed_only", label: t("builder.content.closed_only") },
              { value: "private", label: t("builder.content.private") }
            ]}
            onChange={(value) => update({ ...poll, resultVisibility: value })}
          />
          <Checkbox
            label={t("builder.content.strictOneVotePerUser")}
            disabled={readOnly}
            checked={poll.strictOneVotePerUser ?? false}
            onChange={(checked) => update({ ...poll, strictOneVotePerUser: checked })}
          />
        </>
      ) : (
        <>
          <Select
            id={`${id}-timing`}
            label={t("builder.content.showExplanation")}
            value={quiz.showExplanation}
            disabled={readOnly}
            options={[
              { value: "after_submit", label: t("builder.content.after_submit") },
              { value: "immediate", label: t("builder.content.immediate") }
            ]}
            onChange={(value) => update({ ...quiz, showExplanation: value })}
          />
          <TextInput
            type="number"
            label={t("builder.content.passingScore")}
            value={quiz.passingScore === undefined ? "" : String(quiz.passingScore)}
            disabled={readOnly}
            onChange={(value) => {
              const { passingScore: _removed, ...rest } = quiz;
              if (value === "") update(rest);
              else if (Number.isFinite(Number(value))) update({ ...rest, passingScore: Number(value) });
            }}
          />
        </>
      )}
    </Stack>
  );
}
