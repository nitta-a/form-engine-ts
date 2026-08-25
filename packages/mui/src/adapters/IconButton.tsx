import type { BuilderActionIconType, BuilderIconButtonProps } from "@form-engine-ts/react";
import { IconButton, Tooltip } from "@mui/material";
import type { ComponentType } from "react";
import { useResolvedMuiAdapterOptions } from "../context";
import type { MuiAdapterOptions } from "../types";

const FALLBACK_ACTION_LABELS: Readonly<Record<BuilderActionIconType, string>> = {
  moveUp: "Move up",
  moveDown: "Move down",
  delete: "Delete",
  add: "Add",
  edit: "Edit",
  settings: "Settings",
  translate: "Translate",
  close: "Close",
  dragHandle: "Reorder"
};

export function createMuiIconButtonAdapter(options?: MuiAdapterOptions): ComponentType<BuilderIconButtonProps> {
  return function MuiIconButton({
    id,
    className,
    disabled,
    readOnly,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedBy,
    "aria-labelledby": ariaLabelledBy,
    onClick,
    icon,
    actionType,
    title
  }: BuilderIconButtonProps) {
    const resolved = useResolvedMuiAdapterOptions(options);
    const actionLabel =
      actionType === undefined
        ? "Action"
        : (resolved.getActionLabel?.(actionType) ?? FALLBACK_ACTION_LABELS[actionType]);
    const tooltip = title ?? actionLabel;
    const color = actionType === "delete" ? "error" : actionType === "add" ? "primary" : "default";
    return (
      <Tooltip title={tooltip}>
        <span>
          <IconButton
            id={id}
            className={className}
            type="button"
            size={resolved.size}
            color={color}
            disabled={disabled || readOnly}
            aria-label={ariaLabel ?? tooltip}
            aria-describedby={ariaDescribedBy}
            aria-labelledby={ariaLabelledBy}
            onClick={onClick}
          >
            {icon}
          </IconButton>
        </span>
      </Tooltip>
    );
  };
}

export const MuiIconButtonAdapter = createMuiIconButtonAdapter();
