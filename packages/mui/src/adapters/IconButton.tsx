import type { BuilderActionIconType, BuilderIconButtonProps } from "@form-engine-ts/react";
import { IconButton, Tooltip } from "@mui/material";
import type { ComponentType } from "react";
import type { MuiAdapterOptions } from "../types";
import { resolveMuiAdapterOptions } from "../types";

const ACTION_LABELS: Readonly<Record<BuilderActionIconType, string>> = {
  moveUp: "上へ移動",
  moveDown: "下へ移動",
  delete: "削除",
  add: "追加",
  edit: "編集",
  settings: "設定",
  translate: "翻訳",
  close: "閉じる",
  dragHandle: "並べ替え"
};

export function createMuiIconButtonAdapter(options?: MuiAdapterOptions): ComponentType<BuilderIconButtonProps> {
  const resolved = resolveMuiAdapterOptions(options);
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
    const actionLabel = actionType === undefined ? "操作" : ACTION_LABELS[actionType];
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
