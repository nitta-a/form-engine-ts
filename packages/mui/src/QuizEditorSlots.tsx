import { contentMetadataToJson, type FormSchema, readQuizFieldMetadata } from "@form-engine-ts/core";
import type { BuilderFieldEditorSlotProps, BuilderOptionEditorSlotProps } from "@form-engine-ts/react";
import { FormControlLabel, Radio, Stack } from "@mui/material";

import { contentTranslation } from "./contentTranslation";
import { useResolvedMuiAdapterOptions } from "./context";

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
  readOnly,
  translate
}: BuilderOptionEditorSlotProps) {
  const quiz = readQuizFieldMetadata(field.metadata);
  const t = contentTranslation(currentLocale, translate);
  const resolved = useResolvedMuiAdapterOptions();
  const radioSlotProps = resolved.muiSlotProps?.radio;
  const radioInputProps = radioSlotProps?.inputProps;
  return (
    <FormControlLabel
      label={t("builder.content.correctAnswer")}
      control={
        <Radio
          {...radioSlotProps}
          size={radioSlotProps?.size ?? resolved.size}
          name={`quiz-correct-${field.id}`}
          checked={quiz.correctOptionId === option.id}
          disabled={readOnly}
          inputProps={{
            ...radioInputProps,
            "aria-label": `${t("builder.content.correctAnswer")}: ${option.label}`
          }}
          onChange={() => {
            if (!readOnly) onChange?.(updateQuiz(schema, field.id, { ...quiz, correctOptionId: option.id }));
          }}
        />
      }
    />
  );
}
export function QuizFieldEditor({
  schema,
  field,
  onChange,
  currentLocale,
  readOnly,
  components,
  translate
}: BuilderFieldEditorSlotProps) {
  const quiz = readQuizFieldMetadata(field.metadata);
  const t = contentTranslation(currentLocale, translate);
  const resolved = useResolvedMuiAdapterOptions();
  const { TextArea, TextInput } = components;
  const update = (value: object) => {
    if (!readOnly) onChange?.(updateQuiz(schema, field.id, value));
  };
  return (
    <Stack {...resolved.muiSlotProps?.stack} spacing={resolved.dense ? 1 : 2}>
      <TextArea
        label={t("builder.content.explanation")}
        value={quiz.explanation ?? ""}
        disabled={readOnly}
        onChange={(value) => update({ ...quiz, explanation: value })}
      />
      <TextInput
        label={t("builder.content.points")}
        type="number"
        value={String(quiz.points ?? 1)}
        disabled={readOnly}
        onChange={(value) => {
          if (Number.isFinite(Number(value))) update({ ...quiz, points: Number(value) });
        }}
      />
    </Stack>
  );
}
