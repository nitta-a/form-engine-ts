import type { BuilderToolbarSlotProps, FormBuilderSlots } from "@form-engine-ts/react";
import { Stack } from "@mui/material";
import type { ComponentType } from "react";
import type { MuiAdapterOptions } from "../types";
import { resolveMuiAdapterOptions } from "../types";

export function createMuiToolbarSlot(options?: MuiAdapterOptions): ComponentType<BuilderToolbarSlotProps> {
  const resolved = resolveMuiAdapterOptions(options);
  return function MuiToolbar({
    kind,
    index,
    total,
    title,
    onMoveUp,
    onMoveDown,
    onRemove,
    readOnly,
    components
  }: BuilderToolbarSlotProps) {
    const { IconButton } = components;
    return (
      <Stack
        data-mui-slot="toolbar"
        direction="row"
        spacing={resolved.dense ? 0.5 : 1}
        alignItems="center"
        sx={{ mb: resolved.dense ? 1 : 2 }}
      >
        <IconButton
          actionType="moveUp"
          title={`Move ${title} up`}
          disabled={readOnly || index === 0}
          onClick={onMoveUp}
        />
        <IconButton
          actionType="moveDown"
          title={`Move ${title} down`}
          disabled={readOnly || index === total - 1}
          onClick={onMoveDown}
        />
        <IconButton
          actionType="delete"
          title={`Delete ${title}`}
          disabled={readOnly || (kind !== "page" && total <= 1)}
          onClick={onRemove}
        />
      </Stack>
    );
  };
}

export const MuiToolbarSlot: NonNullable<FormBuilderSlots["toolbar"]> = createMuiToolbarSlot();
