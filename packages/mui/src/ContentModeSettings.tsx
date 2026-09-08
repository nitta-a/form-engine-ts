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
import type { MuiContentModeControls } from "./contentModeTypes";
import { contentTranslation } from "./contentTranslation";
import { useResolvedMuiAdapterOptions } from "./context";

export interface ContentModeSettingsProps {
  readonly schema: FormSchema;
  readonly onChange?: (schema: FormSchema) => void;
  readonly locale?: string;
  readonly readOnly?: boolean;
  readonly components?: Partial<FormBuilderComponents>;
  readonly translate?: (key: string) => string;
  readonly controls?: Pick<
    MuiContentModeControls,
    "resultVisibility" | "strictOneVotePerUser" | "showExplanation" | "passingScore"
  >;
}
export function ContentModeSettings({
  schema,
  onChange,
  locale = "en",
  readOnly = false,
  components,
  translate,
  controls
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
          {controls?.resultVisibility === "hidden" ? null : (
            <Select
              id={`${id}-visibility`}
              label={t("builder.content.resultVisibility")}
              value={poll.resultVisibility}
              disabled={readOnly || controls?.resultVisibility === "readOnly"}
              options={[
                { value: "after_submit", label: t("builder.content.after_submit") },
                { value: "always", label: t("builder.content.always") },
                { value: "closed_only", label: t("builder.content.closed_only") },
                { value: "private", label: t("builder.content.private") }
              ]}
              onChange={(value) => {
                if (controls?.resultVisibility !== "readOnly") update({ ...poll, resultVisibility: value });
              }}
            />
          )}
          {controls?.strictOneVotePerUser === "hidden" ? null : (
            <Checkbox
              label={t("builder.content.strictOneVotePerUser")}
              disabled={readOnly || controls?.strictOneVotePerUser === "readOnly"}
              checked={poll.strictOneVotePerUser ?? false}
              onChange={(checked) => {
                if (controls?.strictOneVotePerUser !== "readOnly") update({ ...poll, strictOneVotePerUser: checked });
              }}
            />
          )}
        </>
      ) : (
        <>
          {controls?.showExplanation === "hidden" ? null : (
            <Select
              id={`${id}-timing`}
              label={t("builder.content.showExplanation")}
              value={quiz.showExplanation}
              disabled={readOnly || controls?.showExplanation === "readOnly"}
              options={[
                { value: "after_submit", label: t("builder.content.after_submit") },
                { value: "immediate", label: t("builder.content.immediate") }
              ]}
              onChange={(value) => {
                if (controls?.showExplanation !== "readOnly") update({ ...quiz, showExplanation: value });
              }}
            />
          )}
          {controls?.passingScore === "hidden" ? null : (
            <>
              <Checkbox
                label={t("builder.content.enablePassingScore")}
                disabled={readOnly || controls?.passingScore === "readOnly"}
                checked={quiz.passingScore !== undefined}
                onChange={(checked) => {
                  if (controls?.passingScore === "readOnly") return;
                  if (checked) update({ ...quiz, passingScore: quiz.passingScore ?? 0 });
                  else {
                    const { passingScore: _removed, ...rest } = quiz;
                    update(rest);
                  }
                }}
              />
              <TextInput
                type="number"
                label={t("builder.content.passingScore")}
                value={quiz.passingScore === undefined ? "" : String(quiz.passingScore)}
                disabled={readOnly || controls?.passingScore === "readOnly"}
                onChange={(value) => {
                  if (controls?.passingScore === "readOnly") return;
                  const { passingScore: _removed, ...rest } = quiz;
                  if (value === "") update(rest);
                  else if (Number.isFinite(Number(value))) update({ ...rest, passingScore: Number(value) });
                }}
              />
            </>
          )}
        </>
      )}
    </Stack>
  );
}
