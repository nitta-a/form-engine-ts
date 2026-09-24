import type { BuilderFieldEditorPreviewSlotProps, FormBuilderSlots } from "@form-engine-ts/react";
import { CardActionArea, Stack, Typography } from "@mui/material";
import type { ComponentType } from "react";
import { useResolvedMuiAdapterOptions } from "../context";
import type { MuiAdapterOptions } from "../types";

export function createMuiFieldEditorPreviewSlot(
  options?: MuiAdapterOptions
): ComponentType<BuilderFieldEditorPreviewSlotProps> {
  return function MuiFieldEditorPreview({ field, index, onSelect }: BuilderFieldEditorPreviewSlotProps) {
    const resolved = useResolvedMuiAdapterOptions(options);
    const questionPreviewProps = resolved.muiSlotProps?.questionPreview;

    return (
      <CardActionArea
        {...questionPreviewProps}
        data-mui-slot="question-preview"
        data-field-id={field.id}
        onClick={onSelect}
        sx={
          questionPreviewProps?.sx ?? {
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
            display: "block",
            p: resolved.dense ? 1.25 : 2,
            textAlign: "left",
            "&:hover": { bgcolor: "action.hover" },
            "&:focus-visible": {
              outline: "2px solid",
              outlineColor: "primary.main",
              outlineOffset: 2
            }
          }
        }
      >
        <Stack direction="row" spacing={1} alignItems="center">
          {resolved.fieldEditorOptions?.showQuestionNumber === false ? null : (
            <Typography component="span" variant="body2" color="text.secondary" aria-hidden="true">
              {index + 1}.
            </Typography>
          )}
          <Typography component="span" variant="body1">
            {field.title}
          </Typography>
        </Stack>
      </CardActionArea>
    );
  };
}

export const MuiFieldEditorPreviewSlot: NonNullable<FormBuilderSlots["fieldEditorPreview"]> =
  createMuiFieldEditorPreviewSlot();
