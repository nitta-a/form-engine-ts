import type { ChoiceGroupSlotProps } from "@form-engine-ts/react";
import { FormControl, FormHelperText, FormLabel, Paper } from "@mui/material";
import { useResolvedMuiAdapterOptions } from "../context";

export function MuiChoiceGroupSlot({
  field,
  title,
  description,
  required,
  error,
  disabled,
  children,
  className,
  quizResult
}: ChoiceGroupSlotProps) {
  const resolved = useResolvedMuiAdapterOptions();
  const slotProps = resolved.muiSlotProps?.byType?.[field.type]?.choiceGroup;
  return (
    <Paper
      {...slotProps}
      className={[className, slotProps?.className].filter(Boolean).join(" ")}
      data-field-id={field.id}
      data-field-type={field.type}
      data-quiz-result={quizResult}
      variant={slotProps?.variant ?? "outlined"}
      sx={[
        {
          borderColor:
            quizResult === "correct"
              ? "success.main"
              : quizResult === "incorrect"
                ? "error.main"
                : error === undefined
                  ? "divider"
                  : "error.main",
          borderRadius: 2,
          mb: 2,
          p: 2
        },
        ...(slotProps?.sx === undefined ? [] : Array.isArray(slotProps.sx) ? slotProps.sx : [slotProps.sx])
      ]}
    >
      <FormControl component="fieldset" error={error !== undefined} fullWidth required={required} disabled={disabled}>
        <FormLabel component="legend" sx={{ fontWeight: "bold", mb: description === undefined ? 1 : 0.5 }}>
          {title}
        </FormLabel>
        {description === undefined ? null : <FormHelperText sx={{ mt: 0, mb: 1 }}>{description}</FormHelperText>}
        {children}
        {error === undefined ? null : <FormHelperText error>{error.message}</FormHelperText>}
      </FormControl>
    </Paper>
  );
}
