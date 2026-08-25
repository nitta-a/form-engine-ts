import type { BuilderFieldsetProps } from "@form-engine-ts/react";
import { Box, Typography } from "@mui/material";
import type { ComponentType } from "react";
import type { MuiAdapterOptions } from "../types";
import { resolveMuiAdapterOptions } from "../types";

export function createMuiFieldsetAdapter(options?: MuiAdapterOptions): ComponentType<BuilderFieldsetProps> {
  const resolved = resolveMuiAdapterOptions(options);
  return function MuiFieldset({ className, legend, disabled, children }: BuilderFieldsetProps) {
    return (
      <Box
        component="fieldset"
        className={className}
        disabled={disabled}
        sx={{
          border: 0,
          m: 0,
          p: 0,
          minWidth: 0,
          display: "grid",
          gap: resolved.dense ? 1 : 2,
          "& > div:not(.MuiStack-root):not(.MuiPaper-root)": {
            display: "grid",
            gap: resolved.dense ? 1 : 2
          }
        }}
      >
        {legend === undefined ? null : (
          <Typography component="legend" variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
            {legend}
          </Typography>
        )}
        {children}
      </Box>
    );
  };
}

export const MuiFieldsetAdapter = createMuiFieldsetAdapter();
