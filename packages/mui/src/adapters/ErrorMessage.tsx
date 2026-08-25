import type { BuilderErrorMessageProps } from "@form-engine-ts/react";
import { Alert } from "@mui/material";
import type { ComponentType } from "react";
import type { MuiAdapterOptions } from "../types";

export function createMuiErrorMessageAdapter(_options?: MuiAdapterOptions): ComponentType<BuilderErrorMessageProps> {
  return function MuiErrorMessage({
    id,
    className,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedBy,
    "aria-labelledby": ariaLabelledBy,
    message
  }: BuilderErrorMessageProps) {
    return (
      <Alert
        id={id}
        className={className}
        severity="error"
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-labelledby={ariaLabelledBy}
        sx={{ my: 1 }}
      >
        {message}
      </Alert>
    );
  };
}

export const MuiErrorMessageAdapter = createMuiErrorMessageAdapter();
