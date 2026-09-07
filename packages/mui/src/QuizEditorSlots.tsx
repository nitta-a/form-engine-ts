import { contentMetadataToJson, type FormSchema, readQuizFieldMetadata } from "@form-engine-ts/core";
import type { BuilderFieldEditorSlotProps, BuilderOptionEditorSlotProps } from "@form-engine-ts/react";
import { FormControlLabel, Radio, Stack, TextField } from "@mui/material";

function updateQuiz(schema: FormSchema, fieldId: string, quiz: object): FormSchema {
  return {
    ...schema,
    fields: schema.fields.map((field) => {
      if (field.id !== fieldId) return field;
      const raw = field.metadata?.quiz;
      const previous =
        raw !== null && typeof raw === "object" && !Array.isArray(raw) ? Object.fromEntries(Object.entries(raw)) : {};
      return { ...field, metadata: contentMetadataToJson({ ...field.metadata, quiz: { ...previous, ...quiz } }) };
    })
  };
}
export function QuizOptionEditor({
  schema,
  field,
  option,
  onChange,
  currentLocale,
  readOnly
}: BuilderOptionEditorSlotProps) {
  const quiz = readQuizFieldMetadata(field.metadata);
  return (
    <FormControlLabel
      label={currentLocale.startsWith("ja") ? "正解" : "Correct answer"}
      control={
        <Radio
          name={`quiz-correct-${field.id}`}
          checked={quiz.correctOptionId === option.id}
          disabled={readOnly}
          inputProps={{
            "aria-label": `${currentLocale.startsWith("ja") ? "正解" : "Correct answer"}: ${option.label}`
          }}
          onChange={() => onChange?.(updateQuiz(schema, field.id, { ...quiz, correctOptionId: option.id }))}
        />
      }
    />
  );
}
export function QuizFieldEditor({ schema, field, onChange, currentLocale, readOnly }: BuilderFieldEditorSlotProps) {
  const quiz = readQuizFieldMetadata(field.metadata);
  const ja = currentLocale.startsWith("ja");
  const update = (value: object) => onChange?.(updateQuiz(schema, field.id, value));
  return (
    <Stack spacing={2}>
      <TextField
        label={ja ? "解説" : "Explanation"}
        multiline
        value={quiz.explanation ?? ""}
        disabled={readOnly}
        onChange={(event) => update({ ...quiz, explanation: event.target.value })}
      />
      <TextField
        label={ja ? "配点" : "Points"}
        type="number"
        value={quiz.points ?? 1}
        disabled={readOnly}
        onChange={(event) => update({ ...quiz, points: Number(event.target.value) })}
      />
    </Stack>
  );
}
