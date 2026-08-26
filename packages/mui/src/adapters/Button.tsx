import type { BuilderButtonProps } from "@form-engine-ts/react";
import { Button } from "@mui/material";
import type { ComponentType } from "react";
import { useResolvedMuiAdapterOptions } from "../context";
import type { MuiAdapterOptions } from "../types";

export function createMuiButtonAdapter(options?: MuiAdapterOptions): ComponentType<BuilderButtonProps> {
  return function MuiButton({
    id,
    className,
    disabled,
    readOnly,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedBy,
    "aria-labelledby": ariaLabelledBy,
    onClick,
    noWrap,
    children,
    title,
    variant,
    action,
    targetId
  }: BuilderButtonProps) {
    const resolved = useResolvedMuiAdapterOptions(options);
    const buttonSlotProps = resolved.muiSlotProps?.button;
    return (
      <Button
        {...buttonSlotProps}
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
        variant={buttonSlotProps?.variant ?? resolved.buttonVariants?.[variant ?? "primary"] ?? resolved.buttonVariant}
        fullWidth={resolved.buttonFullWidth ?? false}
        sx={{ whiteSpace: noWrap === false ? "normal" : "nowrap" }}
      >
        {children}
      </Button>
    );
  };
}

export const MuiButtonAdapter = createMuiButtonAdapter();
