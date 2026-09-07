import {
  contentMetadataToJson,
  type FormSchema,
  getFormContentMode,
  readPollMetadata,
  readQuizMetadata
} from "@form-engine-ts/core";
import { Checkbox, FormControlLabel, MenuItem, Stack, TextField } from "@mui/material";

export interface ContentModeSettingsProps {
  readonly schema: FormSchema;
  readonly onChange?: (schema: FormSchema) => void;
  readonly locale?: string;
  readonly readOnly?: boolean;
}
export function ContentModeSettings({ schema, onChange, locale = "en", readOnly = false }: ContentModeSettingsProps) {
  const ja = locale.startsWith("ja");
  const mode = getFormContentMode(schema.metadata);
  const poll = readPollMetadata(schema.metadata);
  const quiz = readQuizMetadata(schema.metadata);
  const raw = schema.metadata?.[mode];
  const existing =
    raw !== null && typeof raw === "object" && !Array.isArray(raw) ? Object.fromEntries(Object.entries(raw)) : {};
  const {
    resultVisibility: _visibility,
    strictOneVotePerUser: _strict,
    showExplanation: _timing,
    passingScore: _passing,
    ...unknownSettings
  } = existing;
  const update = (settings: object) =>
    onChange?.({
      ...schema,
      metadata: contentMetadataToJson({ ...schema.metadata, [mode]: { ...unknownSettings, ...settings } })
    });
  if (mode === "survey") return null;
  return (
    <Stack spacing={2}>
      {mode === "poll" ? (
        <>
          <TextField
            select
            label={ja ? "結果公開タイミング" : "Result visibility"}
            value={poll.resultVisibility}
            disabled={readOnly}
            onChange={(event) => update({ ...poll, resultVisibility: event.target.value })}
          >
            <MenuItem value="after_submit">{ja ? "送信後" : "After submission"}</MenuItem>
            <MenuItem value="always">{ja ? "常に公開" : "Always"}</MenuItem>
            <MenuItem value="closed_only">{ja ? "締切後" : "After closing"}</MenuItem>
            <MenuItem value="private">{ja ? "非公開" : "Private"}</MenuItem>
          </TextField>
          <FormControlLabel
            label={ja ? "一人一票" : "One vote per user"}
            control={
              <Checkbox
                disabled={readOnly}
                checked={poll.strictOneVotePerUser ?? false}
                onChange={(_, checked) => update({ ...poll, strictOneVotePerUser: checked })}
              />
            }
          />
        </>
      ) : (
        <>
          <TextField
            select
            label={ja ? "解説表示タイミング" : "Explanation timing"}
            value={quiz.showExplanation}
            disabled={readOnly}
            onChange={(event) => update({ ...quiz, showExplanation: event.target.value })}
          >
            <MenuItem value="after_submit">{ja ? "送信後" : "After submission"}</MenuItem>
            <MenuItem value="immediate">{ja ? "選択直後" : "Immediately"}</MenuItem>
          </TextField>
          <TextField
            type="number"
            label={ja ? "合格ライン点数" : "Passing score"}
            value={quiz.passingScore ?? ""}
            disabled={readOnly}
            onChange={(event) => {
              const { passingScore: _removed, ...rest } = quiz;
              update(event.target.value === "" ? rest : { ...rest, passingScore: Number(event.target.value) });
            }}
          />
        </>
      )}
    </Stack>
  );
}
