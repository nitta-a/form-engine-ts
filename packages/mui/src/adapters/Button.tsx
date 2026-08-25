import type { BuilderButtonProps } from "@form-engine-ts/react";
import { Button } from "@mui/material";
import type { ComponentType } from "react";
import type { MuiAdapterOptions } from "../types";
import { resolveMuiAdapterOptions } from "../types";

export function createMuiButtonAdapter(options?: MuiAdapterOptions): ComponentType<BuilderButtonProps> {
  const resolved = resolveMuiAdapterOptions(options);
  return function MuiButton({
    id,
    className,
    disabled,
    readOnly,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedBy,
    "aria-labelledby": ariaLabelledBy,
    onClick,
    children,
    title,
    variant,
    action,
    targetId
  }: BuilderButtonProps) {
    return (
      <Button
        id={id}
        className={className}
        type="button"
        size={resolved.size}
        disabled={disabled || readOnly}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-labelledby={ariaLabelledBy}
        title={title}
        data-builder-action={action}
        data-target-id={targetId}
        onClick={onClick}
        color={variant === "danger" ? "error" : "primary"}
        variant={resolved.buttonVariant}
        fullWidth={resolved.fullWidth}
      >
        {children}
      </Button>
    );
  };
}

export const MuiButtonAdapter = createMuiButtonAdapter();
