export interface MuiAdapterOptions {
  readonly size?: "small" | "medium";
  readonly variant?: "outlined" | "filled" | "standard";
  readonly buttonVariant?: "contained" | "outlined" | "text";
  readonly fullWidth?: boolean;
  readonly dense?: boolean;
}

export interface ResolvedMuiAdapterOptions {
  readonly size: "small" | "medium";
  readonly variant: "outlined" | "filled" | "standard";
  readonly buttonVariant: "contained" | "outlined" | "text";
  readonly fullWidth: boolean;
  readonly dense: boolean;
}

export function resolveMuiAdapterOptions(options: MuiAdapterOptions = {}): ResolvedMuiAdapterOptions {
  return {
    size: options.size ?? "medium",
    variant: options.variant ?? "outlined",
    buttonVariant: options.buttonVariant ?? "contained",
    fullWidth: options.fullWidth ?? true,
    dense: options.dense ?? false
  };
}
