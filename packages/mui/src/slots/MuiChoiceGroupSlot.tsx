import type { ChoiceGroupSlotProps } from "@form-engine-ts/react";
import { FormControl, FormHelperText, FormLabel, Paper } from "@mui/material";

export function MuiChoiceGroupSlot({
  title,
  description,
  required,
  error,
  disabled,
  children,
  className
}: ChoiceGroupSlotProps) {
  return (
    <Paper
      className={className}
      variant="outlined"
      sx={{
        borderColor: error === undefined ? "divider" : "error.main",
        borderRadius: 2,
        mb: 2,
        p: 2
      }}
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
