import type { BuilderSectionProps } from "@form-engine-ts/react";
import { Paper, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import type { ComponentType } from "react";
import { useResolvedMuiAdapterOptions } from "../context";
import type { MuiAdapterOptions } from "../types";

export function createMuiSectionAdapter(options?: MuiAdapterOptions): ComponentType<BuilderSectionProps> {
  return function MuiSection({
    id,
    className,
    title,
    description,
    headingId,
    "aria-label": ariaLabel,
    onClickCapture,
    children
  }: BuilderSectionProps) {
    const resolved = useResolvedMuiAdapterOptions(options);
    const standardSx = {
      p: resolved.dense ? 1.5 : 2,
      mb: resolved.dense ? 1 : 2,
      border: 1,
      borderColor: "divider",
      borderRadius: 1,
      display: "grid",
      gap: resolved.dense ? 1 : 2,
      "& > div:not(.MuiStack-root):not(.MuiPaper-root)": {
        display: "grid",
        gap: resolved.dense ? 1 : 2
      }
    } as const;
    const customSx = resolved.muiSlotProps?.paper?.sx;
    const sx: SxProps<Theme> =
      customSx === undefined
        ? standardSx
        : Array.isArray(customSx)
          ? [standardSx, ...customSx]
          : [standardSx, customSx];
    return (
      <Paper
        {...resolved.muiSlotProps?.paper}
        id={id}
        className={className}
        elevation={0}
        aria-label={ariaLabel}
        aria-labelledby={title === undefined ? undefined : headingId}
        onClickCapture={onClickCapture}
        sx={sx}
      >
        {title === undefined ? null : (
          <Typography id={headingId} variant="subtitle1" fontWeight="bold">
            {title}
          </Typography>
        )}
        {description === undefined ? null : (
          <Typography variant="body2" color="text.secondary" sx={{ mb: resolved.dense ? 0.5 : 1.5 }}>
            {description}
          </Typography>
        )}
        {children}
      </Paper>
    );
  };
}

export const MuiSectionAdapter = createMuiSectionAdapter();
