import type { FormSchema } from "./types";

export type FormAcceptanceStatus = "open" | "not_yet_open" | "closed" | "limit_reached";

export type FormAcceptanceResult =
  | { readonly status: "open"; readonly accepted: true }
  | { readonly status: Exclude<FormAcceptanceStatus, "open">; readonly accepted: false };

export function getFormAcceptanceStatus(
  schema: FormSchema,
  options: { readonly now?: Date; readonly submissionCount?: number } = {}
): FormAcceptanceResult {
  const settings = schema.submissionSettings;
  const now = options.now ?? new Date();
  if (settings?.openAt !== undefined && now < new Date(settings.openAt)) {
    return { status: "not_yet_open", accepted: false };
  }
  if (settings?.closeAt !== undefined && now >= new Date(settings.closeAt)) {
    return { status: "closed", accepted: false };
  }
  if (settings?.maxResponses !== undefined && (options.submissionCount ?? 0) >= settings.maxResponses) {
    return { status: "limit_reached", accepted: false };
  }
  return { status: "open", accepted: true };
}
